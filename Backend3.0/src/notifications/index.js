import { NotificationService } from '../services/notification.service.js';
import { renderNotification } from './templates.js';

const notificationService = new NotificationService();

// The push counterpart to socket/emitters.js, and deliberately the same shape:
// `(recipientId, event, payload)`. A call site reads
//
//   emitToDriver(driverId, 'bid:accepted', payload);
//   notifyDriver(driverId, 'bid:accepted', payload);
//
// so the socket event and the push can never quietly diverge, and adding a push to an existing
// transition is one line directly under the emit it belongs to.
//
// SYNCHRONOUS AND FIRE-AND-FORGET, exactly like the emitters. Every caller is a controller that has
// already committed its database write and is about to return 200; making them await a round trip
// to Google would put Firebase's latency — and Firebase's outages — on the critical path of
// accepting a bid. The promise is consumed here and its failure logged, never rethrown.
//
// Returns true when a push was dispatched, false when this event/audience pair has no template.
// The false case is normal: most socket events are UI bookkeeping and deliberately do not push.
const notify = (audience, ids, event, payload) => {
  const message = renderNotification(event, audience, payload);
  if (!message) return false;

  notificationService
    .send(audience, ids, message)
    .catch((error) => console.error(`Push failed [${audience} ${event}]: ${error.message}`));

  return true;
};

export const notifyDriver = (driverId, event, payload) => notify('driver', [driverId], event, payload);

export const notifyUser = (userId, event, payload) => notify('user', [userId], event, payload);

// The fan-out: one template, many drivers, each push rendered from that driver's OWN payload.
//
// `recipients` is [{ driverId, payload }]. Dispatch needs the per-driver shape because the ride
// card carries `distanceFromDriverKm`, which differs for every driver in the ring and would have to
// be dropped from a shared multicast body. Fire-and-forget like the singular helpers above, and
// still one database query and one Firebase round trip per 500 drivers.
export const notifyDriversEach = (recipients, event) => {
  const entries = (recipients || []).reduce((acc, { driverId, payload }) => {
    const message = renderNotification(event, 'driver', payload);
    if (message) acc.push({ id: driverId, message });
    return acc;
  }, []);

  if (!entries.length) return false;

  notificationService
    .sendEach('driver', entries)
    .catch((error) => console.error(`Push failed [driver ${event}]: ${error.message}`));

  return true;
};
