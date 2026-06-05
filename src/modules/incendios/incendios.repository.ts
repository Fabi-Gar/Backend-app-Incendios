import { AppDataSource } from '../../db/data-source'
import { Incendio } from './entities/incendio.entity'

export class IncendiosRepository {
  /**
   * Obtiene la base de los select fields y los joins comunes para listar incendios complejos.
   */
  private static getBaseListQuery() {
    return `
      SELECT
        i.incendio_uuid,
        i.titulo,
        i.descripcion,
        i.centroide,
        i.creado_en,
        i.requiere_aprobacion,
        i.aprobado,
        i.aprobado_en,
        i.rechazado_en,
        i.motivo_rechazo,
        i.reportado_en,
        i.reportado_por_nombre,
        i.telefono,
        i.lugar_poblado,
        jsonb_build_object(
          'usuario_uuid', u.usuario_uuid,
          'nombre', u.nombre,
          'apellido', u.apellido,
          'email', u.email
        ) AS creado_por,
        CASE
          WHEN d.nombre IS NOT NULL THEN
            jsonb_build_object(
              'departamento_uuid', d.departamento_uuid,
              'nombre', d.nombre
            )
          ELSE NULL
        END AS departamento,
        CASE
          WHEN m.nombre IS NOT NULL THEN
            jsonb_build_object(
              'municipio_uuid', m.municipio_uuid,
              'nombre', m.nombre
            )
          ELSE NULL
        END AS municipio,
        CASE
          WHEN med.nombre IS NOT NULL THEN
            jsonb_build_object(
              'medio_uuid', med.medio_uuid,
              'nombre', med.nombre
            )
          ELSE NULL
        END AS medio,
        CASE
          WHEN d.nombre IS NOT NULL OR m.nombre IS NOT NULL THEN
            jsonb_build_object(
              'region_uuid', NULL,
              'nombre',
              trim(
                COALESCE(d.nombre,'') ||
                CASE WHEN d.nombre IS NOT NULL AND m.nombre IS NOT NULL THEN ' / ' ELSE '' END ||
                COALESCE(m.nombre,'')
              )
            )
          ELSE NULL
        END AS region,
        CASE WHEN i.reportado_en IS NULL THEN NULL ELSE
          jsonb_build_object(
            'reportado_por_nombre', i.reportado_por_nombre,
            'reportado_en', i.reportado_en,
            'telefono', i.telefono
          )
        END AS reporte_info
      FROM incendios i
      LEFT JOIN usuarios u ON u.usuario_uuid = i.creado_por_uuid
      LEFT JOIN departamentos d ON d.departamento_uuid = i.departamento_uuid
      LEFT JOIN municipios m ON m.municipio_uuid = i.municipio_uuid
      LEFT JOIN catalogo_medios med ON med.medio_uuid = i.medio_uuid
    `
  }

  static async findMios(usuarioUuid: string, q: string, page: number, pageSize: number) {
    const totalRows = await AppDataSource.query(
      `
      SELECT COUNT(*)::int AS total
      FROM incendios i
      WHERE i.eliminado_en IS NULL
        AND (i.creado_por_uuid = $1 OR i.reportado_por_uuid = $1)
        AND ($2 = '' OR i.titulo ILIKE '%' || $2 || '%')
      `,
      [usuarioUuid, q]
    )
    const total = totalRows?.[0]?.total ?? 0

    const items = await AppDataSource.query(
      `
      ${this.getBaseListQuery()}
      WHERE i.eliminado_en IS NULL
        AND (i.creado_por_uuid = $1 OR i.reportado_por_uuid = $1)
        AND ($2 = '' OR i.titulo ILIKE '%' || $2 || '%')
      ORDER BY i.creado_en DESC
      LIMIT $3 OFFSET $4
      `,
      [usuarioUuid, q, pageSize, (page - 1) * pageSize]
    )

    return { total, page, pageSize, items }
  }

  static async findSinAprobar(q: string, page: number, pageSize: number) {
    const totalRows = await AppDataSource.query(
      `
      SELECT COUNT(*)::int AS total
      FROM incendios i
      WHERE i.eliminado_en IS NULL
        AND i.aprobado = FALSE
        AND ($1 = '' OR i.titulo ILIKE '%' || $1 || '%')
      `,
      [q]
    )
    const total = totalRows?.[0]?.total ?? 0

    const items = await AppDataSource.query(
      `
      ${this.getBaseListQuery()}
      WHERE i.eliminado_en IS NULL
        AND i.aprobado = FALSE
        AND ($1 = '' OR i.titulo ILIKE '%' || $1 || '%')
      ORDER BY i.creado_en DESC
      LIMIT $2 OFFSET $3
      `,
      [q, pageSize, (page - 1) * pageSize]
    )

    return { total, page, pageSize, items }
  }
}
