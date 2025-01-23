import admin from 'firebase-admin';
import 'dotenv/config.js';
import { serviceAccount } from './firebaseadmin.js';


// const serviceAccount = {
//     "type": process.env.type,
//     "project_id": process.env.project_id,
//     "private_key_id": process.env.private_key_id,
//     "private_key": process.env.private_key,
//     "client_email": process.env.client_email,
//     "client_id": process.env.client_id,
//     "auth_uri": process.env.auth_uri,
//     "token_uri": process.token_uri,
//     "auth_provider_x509_cert_url": process.auth_provider_x509_cert_url,
//     "client_x509_cert_url": process.client_x509_cert_url,
//     "universe_domain": process.universe_domain
// }


export const firebaseadmin = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });


