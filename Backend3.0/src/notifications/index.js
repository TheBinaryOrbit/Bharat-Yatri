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

// One template, one multicast, many devices — the dispatch fan-out's path.
export const notifyDrivers = (driverIds, event, payload) => notify('driver', driverIds, event, payload);

export const notifyUser = (userId, event, payload) => notify('user', [userId], event, payload);
