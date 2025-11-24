// src/services/firebasePush.service.ts
import admin from 'firebase-admin';
import path from 'path';

let initialized = false;

export function initFirebase() {
  if (initialized) return;

  try {
    const serviceAccount = require(path.resolve(
      process.cwd(), 
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './config/firebase-service-account.json'
    ));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    initialized = true;
    console.log('✅ Firebase inicializado');
  } catch (error: any) {
    console.error('❌ Error inicializando Firebase:', error.message);
    throw error;
  }
}

export async function sendFirebasePush(
  tokens: string[],
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
) {
  if (!initialized) {
    throw new Error('Firebase no está inicializado');
  }

  if (!tokens.length) return;

  const message: admin.messaging.MulticastMessage = {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data || {},
    android: {
      priority: 'high',
      notification: {
        channelId: 'default',
        sound: 'default',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
        },
      },
    },
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  console.log(`✅ ${response.successCount}/${tokens.length} notificaciones enviadas`);

  if (response.failureCount > 0) {
    console.error(`⚠️ ${response.failureCount} fallidas`);
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.error(`  - Token: ${tokens[idx].substring(0, 30)}...`);
        console.error(`    Error: ${resp.error?.message}`);
      }
    });
  }

  return response;
}