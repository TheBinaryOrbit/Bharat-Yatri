import { maybeGetMessaging } from '../config/firebase.js';

// FCM caps a multicast at 500 tokens. A QuickRide fan-out is a handful of nearby drivers, so this
// only ever bites on a broadcast, but a silent 400 on ride 501 would be a miserable thing to debug.
const MULTICAST_LIMIT = 500;

// The codes that mean "this device is gone" rather than "this send failed". Everything else —
// quota, transient network, an internal error — is retried by the caller's next event, and pruning
// a live token because of a blip would silence a driver permanently.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

// messaging/invalid-argument is the awkward one, and it is why this check reads the message.
//
// FCM returns that single code for BOTH a malformed registration token ("The registration token is
// not a valid FCM registration token") and a malformed payload. Treating the code alone as a dead
// device would let one bug in our copy wipe every token we hold; ignoring it entirely leaves
// garbage a client once posted stored forever, failing and logging on every future send.
//
// So: invalid-argument counts as dead only when Firebase says the REGISTRATION TOKEN is what it
// objected to. A payload complaint names the offending field instead and is left alone.
const isDeadToken = (error) => {
  if (DEAD_TOKEN_CODES.has(error?.code)) return true;

  return error?.code === 'messaging/invalid-argument' && /registration token/i.test(error?.message || '');
};

// FCM rejects a data payload whose values are not strings, and does it per-message rather than
// per-field, so one stray number kills the whole send. Everything is coerced here, once, at the
// edge — no caller should have to remember. null/undefined entries are dropped rather than sent
// as the strings "null"/"undefined", which an app would have to special-case.
const stringifyData = (data = {}) =>
  Object.entries(data).reduce((acc, [key, value]) => {
    if (value === null || value === undefined) return acc;
    acc[key] = value instanceof Date ? value.toISOString() : String(value);
    return acc;
  }, {});

const chunk = (items, size) => {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
};

// The transport, and nothing else. It knows about tokens and Firebase; it does not know what a
// ride, a driver or a bid is. NotificationService above it owns recipients and copy.
export class FcmService {
  isEnabled = () => Boolean(maybeGetMessaging());

  // Both a `notification` block and a `data` block, on purpose.
  //
  // Data-only messages are not shown by the OS while the app is backgrounded or killed — the app
  // has to be alive to build the banner — and a driver whose app is closed is exactly who a new
  // ride needs to reach. The notification block gets the banner drawn by the system; the data
  // block rides along and is what the app reads on tap to decide where to navigate.
  buildMessage = ({ title, body, data }) => ({
    notification: { title, body },
    data: stringifyData(data),
    android: {
      // 'high' is what wakes a dozing device. These are time-critical by nature: a ride card is
      // worthless once the 5-minute auction has run out.
      priority: 'high',
      notification: {
        sound: 'default',
        // The apps must create this channel with a high importance, or Android silently downgrades
        // every one of these to a no-sound notification.
        channelId: 'bharat_yatri_rides',
      },
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: { aps: { sound: 'default' } },
    },
  });

  // Responses come back positionally aligned with the tokens we sent, so a failure can always be
  // traced back to the device that caused it. Shared by both send paths below.
  collectBatchResult = (response, batchTokens, result, type) => {
    result.successCount += response.successCount;
    result.failureCount += response.failureCount;

    response.responses.forEach((sent, index) => {
      if (sent.success) return;

      if (isDeadToken(sent.error)) {
        result.deadTokens.push(batchTokens[index]);
        return;
      }

      console.error(`FCM send failed [${type}] ${sent.error?.code}: ${sent.error?.message}`);
    });
  };

  // Sends one message to many devices and reports which tokens are dead.
  //
  // Never throws. Push is an enhancement on top of the socket layer, and a Firebase outage must
  // not turn a successful ride assignment into a 500 for the rider who made it happen.
  sendToTokens = async (tokens, { title, body, data }) => {
    const messaging = maybeGetMessaging();
    const targets = [...new Set((tokens || []).filter(Boolean))];

    if (!messaging || !targets.length) {
      return { successCount: 0, failureCount: 0, deadTokens: [] };
    }

    const message = this.buildMessage({ title, body, data });
    const result = { successCount: 0, failureCount: 0, deadTokens: [] };

    for (const batch of chunk(targets, MULTICAST_LIMIT)) {
      try {
        const response = await messaging.sendEachForMulticast({ ...message, tokens: batch });
        this.collectBatchResult(response, batch, result, data?.type);
      } catch (error) {
        // A whole-batch failure: bad credentials, no network, Firebase down.
        result.failureCount += batch.length;
        console.error(`FCM multicast failed [${data?.type}]: ${error.message}`);
      }
    }

    return result;
  };

  // Many devices, a DIFFERENT message each — the fan-out where the payload is personalised.
  //
  // `sendToTokens` above cannot express this: a multicast is one message body replicated, so
  // anything that varies per driver (`distanceFromDriverKm`) has to be dropped from it. Firebase's
  // sendEach takes up to 500 distinct messages in a single HTTP call, so paying for personalisation
  // costs the same one round trip per 500 drivers that the multicast did — not one call per driver.
  //
  // `items` is [{ token, title, body, data }]. Same contract as sendToTokens: never throws, reports
  // dead tokens.
  sendEachToTokens = async (items) => {
    const messaging = maybeGetMessaging();

    // Last write wins on a duplicate token, mirroring the de-duplication sendToTokens does — two
    // drivers sharing a handset is a data problem, not a reason to buzz it twice.
    const byToken = new Map();
    (items || []).forEach((item) => {
      if (item?.token) byToken.set(item.token, item);
    });

    const targets = [...byToken.values()];
    if (!messaging || !targets.length) {
      return { successCount: 0, failureCount: 0, deadTokens: [] };
    }

    const type = targets[0]?.data?.type;
    const result = { successCount: 0, failureCount: 0, deadTokens: [] };

    for (const batch of chunk(targets, MULTICAST_LIMIT)) {
      try {
        const response = await messaging.sendEach(
          batch.map((item) => ({ ...this.buildMessage(item), token: item.token }))
        );
        this.collectBatchResult(response, batch.map((item) => item.token), result, type);
      } catch (error) {
        result.failureCount += batch.length;
        console.error(`FCM sendEach failed [${type}]: ${error.message}`);
      }
    }

    return result;
  };
}
