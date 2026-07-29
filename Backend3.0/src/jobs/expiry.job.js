import { env } from '../config/env.js';
import { QuickRideService } from '../services/quickRide.service.js';
import { QuickRideBidService } from '../services/quickRideBid.service.js';
import { RideAudienceService } from '../services/rideAudience.service.js';
import { emitToDriver, emitToUser } from '../socket/emitters.js';
import { closeRideRoom } from '../socket/rideRoom.js';

const quickRideService = new QuickRideService();
const quickRideBidService = new QuickRideBidService();
const rideAudienceService = new RideAudienceService();

let timer = null;
let isRunning = false;

// Bids die after BID_TTL_SECONDS and rides after RIDE_PENDING_TTL_SECONDS.
//
// Mongo's own TTL monitor only runs about once a minute, far too coarse for a 60s bid, so this
// sweeper is what actually enforces the deadlines; the TTL index on bids is only a crash backstop.
// Every read path still filters on expiresAt as well, so a request landing between ticks never
// sees a dead ride or bid.
const expireBids = async () => {
  const expired = await quickRideBidService.findExpiredBids();
  if (!expired.length) return;

  await quickRideBidService.deleteByIds(expired.map((bid) => bid._id));

  expired.forEach((bid) => {
    const payload = { bidId: String(bid._id), quickRideId: String(bid.quickRideId?._id ?? bid.quickRideId) };

    // The rider's list drops the card; the driver's UI re-enables bidding.
    if (bid.quickRideId?.bookedBy) emitToUser(bid.quickRideId.bookedBy, 'bid:expired', payload);
    emitToDriver(bid.requestedBy, 'bid:expired', payload);
  });
};

const expireRides = async () => {
  const expired = await quickRideService.findExpiredSearchingRides();
  if (!expired.length) return;

  const rideIds = expired.map((ride) => ride._id);
  await quickRideService.markRidesExpired(rideIds);

  for (const ride of expired) {
    // Bids on a dead ride are unfulfillable; their drivers are told before the rows go.
    const doomed = await quickRideBidService.deleteOtherBidsForRide(ride._id, null);
    doomed.forEach((bid) => emitToDriver(bid.requestedBy, 'ride:expired', { rideId: String(ride._id) }));

    // Non-bidders were previously left to watch their own countdown run out. The card is now pulled
    // on the same tick that kills the ride, so every screen agrees on when it died.
    await rideAudienceService.notifyAndDrain(
      ride._id,
      'ride:expired',
      { rideId: String(ride._id) },
      { exclude: doomed.map((bid) => bid.requestedBy) }
    );

    emitToUser(ride.bookedBy, 'ride:expired', { rideId: String(ride._id) });
    await closeRideRoom(ride._id, 'expired');
  }
};

const tick = async () => {
  if (isRunning) return; // a slow tick must not overlap the next one
  isRunning = true;

  try {
    await expireBids();
    await expireRides();
  } catch (error) {
    // Swallowed deliberately: one bad tick must not kill the interval
    console.error('Expiry sweep error:', error.message);
  } finally {
    isRunning = false;
  }
};

// NOTE: this is an in-process interval. Behind more than one Node instance every replica sweeps,
// which is correct (deletes are idempotent, the ride update is filtered on rideStatus) but
// duplicative. Move it to a Redis lock or a BullMQ repeatable job when scaling out — the same
// pass that adds @socket.io/redis-adapter for ride rooms.
export const startExpirySweeper = () => {
  if (timer) return timer;

  timer = setInterval(tick, env.EXPIRY_SWEEP_INTERVAL_MS);
  console.log(`✅ Expiry sweeper started (every ${env.EXPIRY_SWEEP_INTERVAL_MS}ms)`);
  return timer;
};

export const stopExpirySweeper = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};
