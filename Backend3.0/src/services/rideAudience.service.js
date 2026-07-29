import { redis } from '../config/redis.js';
import { env } from '../config/env.js';
import { emitToDriver } from '../socket/emitters.js';

const audienceKey = (rideId) => `ride:dispatched:${rideId}`;

// Everyone a ride was pushed to, remembered so it can be pulled back off their screens later.
//
// Bidding is the wrong signal for this. A driver who saw the ride card and did not bid has nothing
// in the database tying them to that ride, so before this existed their only way of losing a
// cancelled ride was watching the countdown run out — the card sat there, tappable, on a ride that
// no longer existed. Dispatch is the only writer; the ride's terminal transitions are the readers.
//
// Redis rather than Mongo because the set is short-lived, write-heavy during the fan-out, and
// worthless once the ride is over. It expires on its own, so nothing accumulates if a ride ends
// through a path that forgets to drain it.
export class RideAudienceService {
  remember = async (rideId, driverIds) => {
    const ids = (driverIds || []).map(String).filter(Boolean);
    if (!ids.length) return;

    const key = audienceKey(rideId);

    // Re-dispatch on a fare raise adds to the set rather than replacing it: a driver who saw the
    // ride at the old price still has the card and still has to be told when it dies.
    await redis
      .pipeline()
      .sadd(key, ...ids)
      .expire(key, env.RIDE_PENDING_TTL_SECONDS + 60)
      .exec();
  };

  list = async (rideId) => redis.smembers(audienceKey(rideId));

  // Read-and-forget. The audience exists to be told exactly once, and every caller is a terminal
  // transition, so reading it and dropping it in one round trip is the only usage that makes sense.
  drain = async (rideId) => {
    const key = audienceKey(rideId);
    const results = await redis.pipeline().smembers(key).del(key).exec();
    const [error, members] = results?.[0] || [];
    return error ? [] : members || [];
  };

  // The one call every terminal transition makes: tell everyone still holding a card that the ride
  // is over, then forget them.
  //
  // `exclude` is what keeps this from double-notifying. The three callers all have their own list
  // of drivers they just emitted to for a *better* reason — a losing bidder gets `ride:taken` with
  // their own `bidId`, the assigned driver is told directly, the cancelling driver needs no event
  // at all — and those emits carry more than the audience payload can. So the specific emit wins
  // and this fills in the silent majority: the drivers who only ever saw the card.
  notifyAndDrain = async (rideId, event, payload, { exclude = [] } = {}) => {
    const audience = await this.drain(rideId);
    if (!audience.length) return [];

    const skip = new Set(exclude.map((id) => String(id?._id ?? id ?? '')).filter(Boolean));
    const targets = audience.filter((driverId) => !skip.has(String(driverId)));

    targets.forEach((driverId) => emitToDriver(driverId, event, payload));
    return targets;
  };

  forget = async (rideId) => redis.del(audienceKey(rideId));
}
