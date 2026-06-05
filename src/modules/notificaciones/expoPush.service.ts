import { Expo } from 'expo-server-sdk';
import type { PushPayload } from './push.types';

const expo = new Expo();

export async function sendExpoPush(
  to: string[], 
  payload: PushPayload
): Promise<void> {
  if (!to || to.length === 0) {
    console.log('⏭️ No hay tokens para enviar');
    return;
  }

  console.log(`📤 Enviando a ${to.length} dispositivo(s) usando Expo Push`);

  const messages = [];
  for (const pushToken of to) {
    // Validar token de Expo
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(`Token push inválido: ${pushToken}`);
      continue;
    }
    messages.push({
      to: pushToken,
      sound: 'default' as const,
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });
  }

  const chunks = expo.chunkPushNotifications(messages);
  
  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
      console.log(`✅ Chunk enviado a Expo (${chunk.length} mensajes)`);
    } catch (error) {
      console.error('❌ Error enviando chunk a Expo:', error);
    }
  }
}