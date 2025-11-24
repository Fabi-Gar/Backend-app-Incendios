// Helper para obtener usuarios suscritos a un incendio
import { AppDataSource } from '../../db/data-source'

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

    // 1. Obtener departamento y municipio del incendio (desde tabla incendios)
    const incendioData = await AppDataSource.query(
      `SELECT i.departamento_uuid, i.municipio_uuid
       FROM incendios i
       WHERE i.incendio_uuid = $1 AND i.eliminado_en IS NULL
       LIMIT 1`,
      [incendio_uuid]
    )

    if (!incendioData?.[0]) {
      console.warn(`[getSubscribedUsers] No se encontró incendio ${incendio_uuid}`)
      return []
    }

    const { departamento_uuid, municipio_uuid } = incendioData[0]

    // 2. Buscar usuarios suscritos a ese departamento o municipio
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
      departamento_uuid,
      municipio_uuid
    ])

    return usuarios.map((u: any) => u.usuario_uuid)
  } catch (error) {
    console.error('[getSubscribedUsers] Error obteniendo usuarios suscritos:', error)
    return []
  }
}