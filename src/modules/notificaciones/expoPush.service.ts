// src/services/expoPush.service.ts
// Ahora usa Firebase internamente
import { sendFirebasePush } from './firebasePush.service';
import type { PushPayload } from './push.types';

export async function sendExpoPush(
  to: string[], 
  payload: PushPayload
): Promise<void> {
  if (!to || to.length === 0) {
    console.log('⏭️ No hay tokens para enviar');
    return;
  }

  console.log(`📤 Enviando a ${to.length} dispositivo(s)`);

  await sendFirebasePush(to, {
    title: payload.title,
    body: payload.body,
    data: payload.data as Record<string, string> || {},
  });
}