import { env } from '../config/env.js';
import { redis } from '../config/redis.js';
import { OutstationRideService } from '../services/outstationRide.service.js';
import { notifyDriver } from '../notifications/index.js';

const outstationRideService = new OutstationRideService();

let timer = null;
let isRunning = false;

// One key per (ride, rung). Redis rather than a field on the ride for the same reasons the
// dispatch audience lives there: it is short-lived bookkeeping that is worthless once the trip
// happens, and it expires on its own if a ride ends through a path that never cleans up.
const reminderKey = (rideId, offsetMinutes) => `outstation:reminded:${rideId}:${offsetMinutes}`;

// SET NX is the whole idempotence story. It is atomic, so two Node instances sweeping the same
// minute cannot both win, and the loser simply moves on — which is what makes this job safe to
// run in more than one replica, unlike the expiry sweeper next door.
//
// The TTL outlives the trip it guards: the rung's own lead time, plus a day for the pickup itself
// to come and go. A key that vanished early would let the same reminder fire twice.
const claimRung = async (rideId, offsetMinutes) => {
  const ttlSeconds = offsetMinutes * 60 + 24 * 60 * 60;
  const claimed = await redis.set(reminderKey(rideId, offsetMinutes), '1', 'EX', ttlSeconds, 'NX');

  return claimed === 'OK';
};

// "Your trip leaves in 3 hours / 2 hours / 1 hour / 30 minutes", from
// OUTSTATION_REMINDER_OFFSETS_MINUTES. The ladder is data, not code: adding a 15-minute rung is
// an env change and nothing else.
//
// The subtle part is what happens after downtime. If the process was asleep for two hours, a trip
// now 50 minutes out is simultaneously "due" for the 180, 120 and 60 rungs, and firing all three
// would put three banners on one driver's phone in one second. So each ride fires only the
// TIGHTEST rung that is due, and the wider ones it slept past are claimed silently — burnt, not
// sent. The driver gets one accurate "in 1 hour", not a burst of stale ones.
const sweepReminders = async () => {
  const offsets = env.OUTSTATION_REMINDER_OFFSETS_MINUTES;
  if (!offsets.length) return;

  const horizonMinutes = offsets[offsets.length - 1];
  const rides = await outstationRideService.findRidesDueForReminder(horizonMinutes);
  if (!rides.length) return;

  for (const ride of rides) {
    if (!ride.assignedTo) continue;

    const minutesUntilPickup = (new Date(ride.pickupAt).getTime() - Date.now()) / 60000;

    // Ascending, so the first entry is always the tightest rung that has come due.
    const dueRungs = offsets.filter((offset) => minutesUntilPickup <= offset);
    if (!dueRungs.length) continue;

    const [tightest, ...sleptPast] = dueRungs;

    // Burn the wider rungs first. Claim results are deliberately ignored: in steady state they
    // were claimed on an earlier tick and this is a no-op, and after downtime the point is only
    // to stop them firing later.
    await Promise.all(sleptPast.map((offset) => claimRung(ride._id, offset)));

    if (!(await claimRung(ride._id, tightest))) continue;

    notifyDriver(ride.assignedTo, 'outstation:reminder', {
      rideId: String(ride._id),
      pickupAt: ride.pickupAt,
      pickupLocationName: ride.pickupLocationName,
      dropLocationName: ride.dropLocationName,
      // What the copy renders — the rung, not the raw remaining minutes. A driver reminded at
      // 2h58m should read "Trip in 3 hours", not "Trip in 2 hours 58 min".
      leadMinutes: tightest,
    });
  }
};

const tick = async () => {
  if (isRunning) return; // a slow tick must not overlap the next one
  isRunning = true;

  try {
    await sweepReminders();
  } catch (error) {
    // Swallowed deliberately: one bad tick must not kill the interval
    console.error('Outstation reminder sweep error:', error.message);
  } finally {
    isRunning = false;
  }
};

// Minute-grained on purpose. A 3-hour reminder does not care about seconds, and this scans every
// upcoming assigned trip — there is no reason for it to share the expiry sweeper's 5s cadence.
export const startReminderSweeper = () => {
  if (timer) return timer;
  if (!env.OUTSTATION_REMINDER_OFFSETS_MINUTES.length) {
    console.warn('⚠️  Outstation reminders disabled (OUTSTATION_REMINDER_OFFSETS_MINUTES is empty)');
    return null;
  }

  timer = setInterval(tick, env.REMINDER_SWEEP_INTERVAL_MS);
  console.log(
    `✅ Outstation reminder sweeper started (every ${env.REMINDER_SWEEP_INTERVAL_MS}ms, rungs: ${env.OUTSTATION_REMINDER_OFFSETS_MINUTES.join('/')} min)`
  );
  return timer;
};

export const stopReminderSweeper = () => {
  if (!timer) return;
  clearInterval(timer);
  timer = null;
};
