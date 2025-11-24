// src/modules/notificaciones/fcmPush.service.ts
import * as admin from 'firebase-admin';

// Asegúrate de que Firebase Admin esté inicializado en tu app
// Debería estar en src/config/firebase.ts o similar

interface FCMNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Enviar notificaciones push usando Firebase Cloud Messaging
 */
export async function sendFCMPush(
  tokens: string[],
  notification: FCMNotification
): Promise<{ success: number; failed: number }> {
  
  if (!tokens || tokens.length === 0) {
    console.log('⚠️ No hay tokens para enviar notificaciones');
    return { success: 0, failed: 0 };
  }

  console.log(`📤 Enviando notificación FCM a ${tokens.length} dispositivo(s)`);
  console.log('   Título:', notification.title);
  console.log('   Cuerpo:', notification.body);

  let successCount = 0;
  let failedCount = 0;

  // Firebase permite enviar hasta 500 tokens por batch
  const BATCH_SIZE = 500;
  
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: batch,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: notification.data || {},
        android: {
          priority: 'high',
          notification: {
            channelId: 'default',
            sound: 'default',
            priority: 'high',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      
      successCount += response.successCount;
      failedCount += response.failureCount;

      // Log de errores específicos
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`❌ Error enviando a token ${idx}:`, resp.error?.message);
          
          // Si el token es inválido, podrías marcarlo como inactivo en la BD
          if (resp.error?.code === 'messaging/invalid-registration-token' ||
              resp.error?.code === 'messaging/registration-token-not-registered') {
            console.warn(`⚠️ Token inválido detectado: ${batch[idx].substring(0, 20)}...`);
            // TODO: Marcar token como inactivo en la base de datos
          }
        }
      });

    } catch (error) {
      console.error('❌ Error enviando batch de notificaciones:', error);
      failedCount += batch.length;
    }
  }

  console.log(`✅ ${successCount}/${tokens.length} notificaciones enviadas`);
  
  if (failedCount > 0) {
    console.warn(`⚠️ ${failedCount} notificaciones fallaron`);
  }

  return { success: successCount, failed: failedCount };
}

/**
 * Enviar notificación a un solo dispositivo
 */
export async function sendFCMPushToDevice(
  token: string,
  notification: FCMNotification
): Promise<boolean> {
  try {
    const message: admin.messaging.Message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
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
            badge: 1,
          },
        },
      },
    };

    await admin.messaging().send(message);
    console.log('✅ Notificación enviada correctamente');
    return true;
  } catch (error: any) {
    console.error('❌ Error enviando notificación:', error.message);
    
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.warn('⚠️ Token inválido o no registrado');
    }
    
    return false;
  }
}