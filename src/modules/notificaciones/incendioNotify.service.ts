// src/services/incendioNotify.service.ts
import { PushPrefsRepo } from './pushPrefs.repo';
import { sendFCMPush } from './fcmPush.service';

// 1. Notificar al creador cuando su incendio es aprobado
export async function notifyIncendioAprobado(incendio: {
  id: string | number;
  titulo?: string;
  creadorUserId: string;
}) {
  const prefs = await PushPrefsRepo.getByUserId(incendio.creadorUserId);
  
  // ✅ Verificar si el usuario quiere recibir notificaciones de aprobación
  if (!prefs || !prefs.avisarmeAprobado) {
    console.log(`⏭️ Usuario ${incendio.creadorUserId} no quiere notificaciones de aprobación`);
    return;
  }

  const tokens = (prefs?.tokens || []).filter(t => t.active).map(t => t.token);
  if (tokens.length === 0) return;

  await sendFCMPush(tokens, {
    title: '✅ Tu incendio fue aprobado',
    body: incendio.titulo || 'Toca para ver detalles',
    data: {
      type: 'incendio_aprobado',
      incendio_id: String(incendio.id),
      deeplink: `/incendios/detalles?id=${incendio.id}`,
    },
  });
}

// 2. Notificar cuando hay actualización en un incendio
export async function notifyIncendioActualizado(incendio: {
  id: string | number;
  titulo?: string;
  creadorUserId: string;
  seguidoresUserIds?: string[];
  cambios?: string;
}) {
  const userIds = new Set<string>([String(incendio.creadorUserId)]);
  (incendio.seguidoresUserIds || []).forEach(u => userIds.add(String(u)));
  
  // ✅ Filtrar tokens de usuarios que quieren recibir actualizaciones
  const tokens = await PushPrefsRepo.getTokensForUserIdsWithPref(
    Array.from(userIds),
    'avisarmeActualizaciones'
  );
  
  if (!tokens.length) return;

  await sendFCMPush(tokens, {
    title: '📢 Actualización de incendio',
    body: incendio.cambios 
      ? `${incendio.titulo || 'Incendio'} - ${incendio.cambios}`
      : incendio.titulo || 'Hay cambios en el incendio',
    data: {
      type: 'incendio_actualizado',
      incendio_id: String(incendio.id),
      deeplink: `/incendios/detalles?id=${incendio.id}`,
    },
  });
}

// 3. Notificar cierre/finalización de incendio
export async function notifyIncendioCerrado(incendio: {
  id: string | number;
  titulo?: string;
  creadorUserId: string;
  seguidoresUserIds?: string[];
  resumenCierre?: string;
}) {
  const userIds = new Set<string>([String(incendio.creadorUserId)]);
  (incendio.seguidoresUserIds || []).forEach(u => userIds.add(String(u)));
  
  // ✅ Filtrar tokens de usuarios que quieren recibir notificaciones de cierre
  const tokens = await PushPrefsRepo.getTokensForUserIdsWithPref(
    Array.from(userIds),
    'avisarmeCierres'
  );
  
  if (!tokens.length) return;

  await sendFCMPush(tokens, {
    title: '✅ Incendio cerrado',
    body: incendio.resumenCierre 
      ? `${incendio.titulo || 'Incendio'} - ${incendio.resumenCierre}`
      : `${incendio.titulo || 'Incendio'} ha sido cerrado`,
    data: {
      type: 'incendio_cerrado',
      incendio_id: String(incendio.id),
      deeplink: `/incendios/detalles?id=${incendio.id}`,
    },
  });
}

// 4. Notificar nuevo incendio por MUNICIPIO
export async function notifyIncendioNuevoMunicipio(incendio: {
  id: string | number;
  titulo?: string;
  municipioCode: string;
  departamentoCode?: string;
  ubicacion?: string;
}) {
  const tokens = await PushPrefsRepo.getTokensByMunicipio(incendio.municipioCode);
  if (!tokens.length) return;

  const locationText = incendio.ubicacion ? ` en ${incendio.ubicacion}` : '';

  await sendFCMPush(tokens, {
    title: '🔥 Nuevo incendio en tu municipio',
    body: `${incendio.titulo || 'Incendio reportado'}${locationText}`,
    data: {
      type: 'incendio_nuevo_municipio',
      municipio: incendio.municipioCode,
      departamento: incendio.departamentoCode || '',
      incendio_id: String(incendio.id),
      deeplink: `/incendios/detalles?id=${incendio.id}`,
    },
  });
}

// 5. Notificar por departamento
export async function notifyIncendioNuevoDepartamento(incendio: {
  id: string | number;
  titulo?: string;
  departamentoCode: string;
  municipioNombre?: string;
}) {
  const tokens = await PushPrefsRepo.getTokensByRegion(incendio.departamentoCode);
  if (!tokens.length) return;

  const locationText = incendio.municipioNombre ? ` en ${incendio.municipioNombre}` : '';

  await sendFCMPush(tokens, {
    title: '🔥 Nuevo incendio en tu región',
    body: `${incendio.titulo || 'Incendio reportado'}${locationText}`,
    data: {
      type: 'incendio_nuevo_departamento',
      departamento: incendio.departamentoCode,
      incendio_id: String(incendio.id),
      deeplink: `/incendios/detalles?id=${incendio.id}`,
    },
  });
}

// 6. Notificar a administradores sobre incendio pendiente
export async function notifyAdminsIncendioPendiente(incendio: {
  id: string | number;
  titulo?: string;
  creadoPor: string;
}) {
  const { AppDataSource } = await import('../../db/data-source');
  const { Notificacion } = await import('./entities/notificacion.entity');
  
  const admins = await AppDataSource.query(
    `SELECT u.usuario_uuid
     FROM usuarios u
     WHERE u.is_admin = true AND u.eliminado_en IS NULL`
  );

  const adminIds = admins.map((a: any) => a.usuario_uuid);
  if (adminIds.length === 0) return;

  const notiRepo = AppDataSource.getRepository(Notificacion);

  // 1. Guardar notificaciones en BD (para la campanita)
  for (const adminId of adminIds) {
    await notiRepo.save({
      usuario_uuid: adminId,
      tipo: 'incendio_pendiente_aprobacion',
      titulo: '⚠️ Nuevo incendio pendiente de aprobación',
      mensaje: `"${incendio.titulo}" requiere tu aprobación`,
      payload: {
        incendio_id: String(incendio.id),
        creado_por: incendio.creadoPor,
      },
    });
  }

  // 2. Enviar Push a los admins
  const tokens = await PushPrefsRepo.getTokensForUserIds(adminIds);
  if (tokens.length > 0) {
    await sendFCMPush(tokens, {
      title: '⚠️ Nuevo incendio pendiente',
      body: `"${incendio.titulo}" requiere aprobación`,
      data: {
        tipo: 'incendio_pendiente_aprobacion',
        incendio_id: String(incendio.id),
        deeplink: `/admin/incendios/${incendio.id}`,
      },
    });
  }
}