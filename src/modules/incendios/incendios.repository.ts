import { AppDataSource } from '../../db/data-source'
import { Incendio } from './entities/incendio.entity'

export class IncendiosRepository {
  /**
   * Obtiene la base de los select fields y los joins comunes para listar incendios complejos.
   */
  private static getBaseListQuery() {
    // NOTA: tras el refactor relacional, los datos de ubicación viven en
    // `incendio_localizaciones` (departamento/municipio como texto) y los del
    // reporte en `incendio_responsables`. Mantenemos el shape plano que espera
    // el frontend (departamento/municipio/region/medio como objetos {nombre}).
    return `
      SELECT
        i.incendio_uuid,
        i.titulo,
        i.descripcion,
        CASE WHEN i.centroide IS NOT NULL
          THEN ST_AsGeoJSON(i.centroide)::jsonb
          ELSE NULL
        END AS centroide,
        i.creado_en,
        i.requiere_aprobacion,
        i.aprobado,
        i.aprobado_en,
        i.rechazado_en,
        i.motivo_rechazo,
        i.inab_objectid,
        i.inab_globalid,
        r.fecha_hora_aviso AS reportado_en,
        r.reportado_por    AS reportado_por_nombre,
        r.telefono         AS telefono,
        loc.lugar_poblado  AS lugar_poblado,
        loc.finca          AS finca,
        jsonb_build_object(
          'usuario_uuid', u.usuario_uuid,
          'nombre', u.nombre,
          'apellido', u.apellido,
          'email', u.email
        ) AS creado_por,
        CASE
          WHEN NULLIF(loc.departamento, '') IS NOT NULL THEN
            jsonb_build_object(
              'departamento_uuid', NULL,
              'nombre', loc.departamento
            )
          ELSE NULL
        END AS departamento,
        CASE
          WHEN NULLIF(loc.municipio, '') IS NOT NULL THEN
            jsonb_build_object(
              'municipio_uuid', NULL,
              'nombre', loc.municipio
            )
          ELSE NULL
        END AS municipio,
        CASE
          WHEN NULLIF(r.medio_aviso, '') IS NOT NULL THEN
            jsonb_build_object(
              'medio_uuid', NULL,
              'nombre', r.medio_aviso
            )
          ELSE NULL
        END AS medio,
        CASE
          WHEN NULLIF(loc.departamento, '') IS NOT NULL OR NULLIF(loc.municipio, '') IS NOT NULL THEN
            jsonb_build_object(
              'region_uuid', NULL,
              'nombre',
              trim(
                COALESCE(loc.departamento,'') ||
                CASE WHEN NULLIF(loc.departamento,'') IS NOT NULL AND NULLIF(loc.municipio,'') IS NOT NULL THEN ' / ' ELSE '' END ||
                COALESCE(loc.municipio,'')
              )
            )
          ELSE NULL
        END AS region,
        CASE
          WHEN r.fecha_hora_aviso IS NULL AND r.reportado_por IS NULL AND r.telefono IS NULL THEN NULL
          ELSE jsonb_build_object(
            'reportado_por_nombre', r.reportado_por,
            'reportado_en', r.fecha_hora_aviso,
            'telefono', r.telefono
          )
        END AS reporte_info,
        (
          SELECT f.url
          FROM fotos_reporte f
          WHERE f.incendio_uuid = i.incendio_uuid AND f.eliminado_en IS NULL
          ORDER BY f.creado_en ASC
          LIMIT 1
        ) AS foto_portada
      FROM incendios i
      LEFT JOIN usuarios u ON u.usuario_uuid = i.creado_por_uuid
      LEFT JOIN incendio_localizaciones loc ON loc.incendio_uuid = i.incendio_uuid
      LEFT JOIN incendio_responsables r ON r.incendio_uuid = i.incendio_uuid
    `
  }

  static async findMios(usuarioUuid: string, q: string, page: number, pageSize: number) {
    const totalRows = await AppDataSource.query(
      `
      SELECT COUNT(*)::int AS total
      FROM incendios i
      WHERE i.eliminado_en IS NULL
        AND i.creado_por_uuid = $1
        AND ($2 = '' OR i.titulo ILIKE '%' || $2 || '%')
      `,
      [usuarioUuid, q]
    )
    const total = totalRows?.[0]?.total ?? 0

    const items = await AppDataSource.query(
      `
      ${this.getBaseListQuery()}
      WHERE i.eliminado_en IS NULL
        AND i.creado_por_uuid = $1
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
