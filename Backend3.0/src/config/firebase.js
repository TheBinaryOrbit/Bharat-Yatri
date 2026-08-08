import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { env } from './env.js';

// The Firebase Admin app, held in its own module for the same reason socket/io.js exists: the
// notification layer needs the messaging handle without importing the boot sequence back.
let messaging = null;

// Non-fatal by design, unlike connectDB/connectRedis. A missing Google Maps key stops the server
// because no ride can be priced without it; a missing Firebase key only means devices are not
// nudged. Sockets still carry every one of these events, so the product works — quieter.
export const initFirebase = () => {
  if (messaging) return messaging;

  if (!env.PUSH_ENABLED) {
    console.warn('⚠️  Push notifications disabled (PUSH_ENABLED=false)');
    return null;
  }

  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = env;

  if (!FIREBASE_PROJECT_ID || !FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) {
    console.warn(
      '⚠️  Push notifications disabled — set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY'
    );
    return null;
  }

  try {
    // The modular (firebase-admin/app) API rather than the legacy `admin.*` namespace: this
    // package is ESM, and the namespace default export does not carry `apps` under it.
    //
    // getApps() guards against a double init in watch mode, where a stale module can linger and
    // initializeApp would throw on the duplicate default app.
    const app = getApps().length
      ? getApp()
      : initializeApp({
          credential: cert({
            projectId: FIREBASE_PROJECT_ID,
            clientEmail: FIREBASE_CLIENT_EMAIL,
            privateKey: FIREBASE_PRIVATE_KEY,
          }),
        });

    messaging = getMessaging(app);
    console.log(`✅ Firebase Cloud Messaging ready (project ${FIREBASE_PROJECT_ID})`);
    return messaging;
  } catch (error) {
    console.error(`❌ Firebase init failed — push disabled: ${error.message}`);
    return null;
  }
};

// For every code path that may legitimately run before (or without) Firebase: scripts, tests,
// and a deployment that simply has no service account configured.
export const maybeGetMessaging = () => messaging;
