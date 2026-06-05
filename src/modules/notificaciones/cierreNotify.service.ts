// src/modules/notificaciones/cierreNotify.service.ts
import { PushPrefsRepo } from './pushPrefs.repo';
import { sendExpoPush } from './expoPush.service';
import type { CierreUpdateType } from './push.types';
import { loggers } from '../../utils/logger';

async function tokensParaCierre(
  incendio: { id: string | number; creadorUserId: string; seguidoresUserIds?: string[] },
  primerReportanteUserId?: string | null
) {
  const userIds = new Set<string>([String(incendio.creadorUserId)]);
  if (primerReportanteUserId) userIds.add(String(primerReportanteUserId));
  (incendio.seguidoresUserIds || []).forEach(u => userIds.add(String(u)));
  
  loggers.notificacion.debug({ userIds: Array.from(userIds) }, 'Buscando tokens para cierre');

  // ✅ Filtrar tokens de usuarios que quieren recibir notificaciones de cierre
  const tokens = await PushPrefsRepo.getTokensForUserIdsWithPref(
    Array.from(userIds),
    'avisarmeCierres'
  );

  loggers.notificacion.debug({ tokensCount: tokens.length }, 'Tokens encontrados para cierre');
  
  return tokens;
}

export async function notifyCierreEvento(params: {
  type: CierreUpdateType;
  incendio: {
    id: string | number;
    titulo?: string;
    creadorUserId: string;
    seguidoresUserIds?: string[];
  };
  autorNombre?: string;
  resumen?: string;
  primerReportanteUserId?: string | null;
}) {
  const { type, incendio, autorNombre, resumen, primerReportanteUserId } = params;

  loggers.notificacion.info({
    type,
    incendio_id: incendio.id,
    seguidores: incendio.seguidoresUserIds?.length || 0
  }, 'Iniciando notificación de cierre');

  const tokens = await tokensParaCierre(incendio, primerReportanteUserId);

  if (!tokens.length) {
    loggers.notificacion.debug('No hay tokens activos para notificar evento de cierre');
    return;
  }

  const titles: Record<CierreUpdateType, string> = {
    cierre_iniciado:   '🔄 Se inició el cierre',
    cierre_actualizado:'📝 Cierre actualizado',
    cierre_finalizado: '✅ Cierre finalizado',
    cierre_reabierto:  '🔓 Cierre reabierto',
  };

  const body = [
    incendio.titulo || 'Incendio',
    autorNombre ? `• por ${autorNombre}` : null,
    resumen ? `• ${resumen}` : null,
  ].filter(Boolean).join(' ');

  loggers.notificacion.info({
    tokens: tokens.length,
    title: titles[type],
    body
  }, 'Enviando notificación de cierre');

  // ✅ Usar FCM en lugar de Expo
  await sendExpoPush(tokens, {
    title: titles[type],
    body,
    data: {
      type,
      incendio_id: String(incendio.id),
      deeplink: `/incendios/detalles?id=${incendio.id}`,
    },
  });

  loggers.notificacion.info('Notificaciones de cierre enviadas correctamente');
}

export async function notifyCierreFinalizadoARegion(params: {
  incendio: { id: string | number; titulo?: string; regionCode: string };
}) {
  loggers.notificacion.info({ regionCode: params.incendio.regionCode }, 'Notificando cierre a región');

  const tokens = await PushPrefsRepo.getTokensByRegion(params.incendio.regionCode);

  if (!tokens.length) {
    loggers.notificacion.debug('No hay tokens suscritos a la región');
    return;
  }

  loggers.notificacion.info({ tokens: tokens.length }, 'Enviando notificación regional');
  
  // ✅ Usar FCM en lugar de Expo
  await sendExpoPush(tokens, {
    title: '✅ Incendio finalizado en tu zona',
    body: params.incendio.titulo || 'Toca para ver detalles',
    data: {
      type: 'cierre_finalizado',
      region: params.incendio.regionCode,
      incendio_id: String(params.incendio.id),
      deeplink: `/incendios/detalles?id=${params.incendio.id}`,
    },
  });

  loggers.notificacion.info('Notificación regional enviada');
}