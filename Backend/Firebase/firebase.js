import admin from 'firebase-admin';
import 'dotenv/config.js';
import { serviceAccount } from './firebaseadmin.js';



export const firebaseadmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });


