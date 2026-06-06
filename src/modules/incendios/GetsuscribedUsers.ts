// Helper para obtener usuarios suscritos a un incendio
import { AppDataSource } from '../../db/data-source'
import { loggers } from '../../utils/logger'

export async function getSubscribedUsers(
  incendio_uuid: string,
  tipoNotificacion: 'avisarmeAprobado' | 'avisarmeActualizaciones' | 'avisarmeCierres'
): Promise<string[]> {
  try {
    const columnMap: Record<string, string> = {
      avisarmeAprobado: 'avisarme_aprobado',
      avisarmeActualizaciones: 'avisarme_actualizaciones',
      avisarmeCierres: 'avisarme_cierres'
    };

    const columnName = columnMap[tipoNotificacion];

    // 1. Obtener departamento y municipio del incendio
    //    (tras el refactor viven como texto en incendio_localizaciones)
    const incendioData = await AppDataSource.query(
      `SELECT loc.departamento, loc.municipio
       FROM incendios i
       LEFT JOIN incendio_localizaciones loc ON loc.incendio_uuid = i.incendio_uuid
       WHERE i.incendio_uuid = $1 AND i.eliminado_en IS NULL
       LIMIT 1`,
      [incendio_uuid]
    )

    if (!incendioData?.[0]) {
      loggers.subscriptions.warn({ incendio_uuid }, 'No se encontró incendio')
      return []
    }

    const { departamento, municipio } = incendioData[0]

    // 2. Buscar usuarios suscritos a ese departamento o municipio (por nombre)
    // que tengan activado el tipo de notificación específico
    const query = `
      SELECT DISTINCT up.user_id as usuario_uuid
      FROM user_push_prefs up
      WHERE up.${columnName} = true
        AND (
          $1 = ANY(up.departamentos_suscritos)
          OR $2 = ANY(up.municipios_suscritos)
        )
    `

    const usuarios = await AppDataSource.query(query, [
      departamento,
      municipio
    ])

    return usuarios.map((u: any) => u.usuario_uuid)
  } catch (error) {
    loggers.subscriptions.error({ err: error, incendio_uuid, tipoNotificacion }, 'Error obteniendo usuarios suscritos')
    return []
  }
}