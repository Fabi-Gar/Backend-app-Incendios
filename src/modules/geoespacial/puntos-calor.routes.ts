// src/modules/geoespacial/puntos-calor.routes.ts
import { Router } from 'express'
import { AppDataSource } from '../../db/data-source'
import { z } from 'zod'

const router = Router()

/**
 * Esquema de query:
 * - page/pageSize: paginación
 * - incendio_uuid: filtra por FK
 * - min_confidence: filtra confianza mínima (0..100 típicamente en VIIRS)
 * - hours: últimas N horas usando el timestamp derivado (acq_date + acq_time)
 * - bbox: lon_min,lat_min,lon_max,lat_max (WGS84)
 * - near/km: punto [lon,lat] y radio en km
 * - order: 'recientes' | 'confianza' | 'frp'
 * - as: 'geojson' para salida FeatureCollection
 */
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),

  incendio_uuid: z.string().uuid().optional(),
  min_confidence: z.coerce.number().min(0).max(100).optional(),
  hours: z.coerce.number().min(1).max(168).optional(), // últimas N horas

  bbox: z.string().transform(s => s.split(',').map(Number)).pipe(z.array(z.number()).length(4)).optional(),
  near: z.string().transform(s => s.split(',').map(Number)).pipe(z.array(z.number()).length(2)).optional(),
  km: z.coerce.number().min(0.1).max(500).optional(),

  order: z.enum(['recientes', 'confianza', 'frp']).default('recientes'),
  as: z.enum(['geojson']).optional(),
})

// --- HEATMAP: /puntos-calor/heatmap ---
const heatmapSchema = z.object({
  grid: z.coerce.number().min(0.005).max(1).default(0.05),
  hours: z.coerce.number().min(1).max(168).optional(),
  bbox: z.string().transform(s => s.split(',').map(Number)).pipe(z.array(z.number()).length(4)).optional(),
  near: z.string().transform(s => s.split(',').map(Number)).pipe(z.array(z.number()).length(2)).optional(),
  km: z.coerce.number().min(0.1).max(500).optional(),
  min_confidence: z.coerce.number().min(0).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(10000).default(2000),
  as: z.enum(['geojson']).optional(),
})

router.get('/heatmap', async (req, res, next) => {
  try {
    const q = heatmapSchema.parse(req.query)
    const where: string[] = ['TRUE']
    const params: any[] = []
    let i = 1

    const cte = `
      WITH pts AS (
        SELECT
          punto_calor_uuid,
          geom,
          confidence,
          frp,
          acq_date,
          acq_time,
          to_timestamp(
            acq_date || ' ' ||
            lpad((acq_time/100)::int::text,2,'0') || ':' ||
            lpad((acq_time%100)::int::text,2,'0'),
            'YYYY-MM-DD HH24:MI'
          ) AT TIME ZONE 'UTC' AS acq_dt
        FROM puntos_calor
      )
    `

    if (q.hours) { where.push(`p.acq_dt >= now() - ($${i++} || ' hours')::interval`); params.push(q.hours) }
    if (typeof q.min_confidence === 'number') { where.push(`(p.confidence::numeric) >= $${i++}`); params.push(q.min_confidence) }

    if (q.bbox) {
      const [lonMin, latMin, lonMax, latMax] = q.bbox
      where.push(`ST_Intersects(p.geom, ST_SetSRID(ST_MakeEnvelope($${i}, $${i+1}, $${i+2}, $${i+3}), 4326))`)
      params.push(lonMin, latMin, lonMax, latMax); i += 4
    }

    if (q.near && q.km) {
      const [lon, lat] = q.near
      where.push(`ST_DWithin(p.geom::geography, ST_SetSRID(ST_MakePoint($${i}, $${i+1}),4326)::geography, $${i+2})`)
      params.push(lon, lat, q.km * 1000); i += 3
    }

    const grid = q.grid
    const sqlBuckets = `
      ${cte}
      SELECT
        (floor(ST_X(p.geom)/$${i})*$${i})::float8 AS lon0,
        (floor(ST_Y(p.geom)/$${i+1})*$${i+1})::float8 AS lat0,
        COUNT(*)::int AS count,
        MAX((p.confidence::numeric)) AS max_confidence,
        MAX((p.frp::numeric))        AS max_frp
      FROM pts p
      WHERE ${where.join(' AND ')}
      GROUP BY lon0, lat0
      ORDER BY count DESC
      LIMIT $${i+2}
    `
    const buckets = await AppDataSource.query(sqlBuckets, [...params, grid, grid, q.limit])

    if (q.as === 'geojson') {
      const features = buckets.map((b: any) => ({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [b.lon0,        b.lat0],
            [b.lon0+grid,   b.lat0],
            [b.lon0+grid,   b.lat0+grid],
            [b.lon0,        b.lat0+grid],
            [b.lon0,        b.lat0]
          ]]
        },
        properties: {
          count: b.count,
          max_confidence: b.max_confidence,
          max_frp: b.max_frp,
          lon0: b.lon0,
          lat0: b.lat0,
          grid
        }
      }))
      return res.json({ type: 'FeatureCollection', features })
    }

    const items = buckets.map((b: any) => ({
      lon: Number(b.lon0) + grid/2,
      lat: Number(b.lat0) + grid/2,
      count: Number(b.count),
      max_confidence: b.max_confidence != null ? Number(b.max_confidence) : null,
      max_frp: b.max_frp != null ? Number(b.max_frp) : null,
      cell: { lon0: Number(b.lon0), lat0: Number(b.lat0), grid }
    }))

    res.json({ grid, count: items.length, items })
  } catch (e) { next(e) }
})

/** LISTA PUNTOS */
router.get('/', async (req, res, next) => {
  try {
    const q = {
      page: Math.max(parseInt(String(req.query.page ?? '1')), 1),
      pageSize: Math.min(Math.max(parseInt(String(req.query.pageSize ?? '50')), 1), 200),
      incendio_uuid: typeof req.query.incendio_uuid === 'string' ? req.query.incendio_uuid : undefined,
      min_confidence: req.query.min_confidence != null ? Number(req.query.min_confidence) : undefined,
      hours: req.query.hours != null ? Number(req.query.hours) : undefined,
    }

    const where: string[] = ['TRUE']
    const params: any[] = []
    let i = 1

    if (q.incendio_uuid) { where.push(`p.incendio_uuid = $${i++}`); params.push(q.incendio_uuid) }
    if (typeof q.min_confidence === 'number') { where.push(`(p.confidence::numeric) >= $${i++}`); params.push(q.min_confidence) }
    if (q.hours) { where.push(`p.acq_dt >= now() - ($${i++} || ' hours')::interval`); params.push(q.hours) }

    const cte = `
      WITH pts AS (
        SELECT
          punto_calor_uuid,
          fuente,
          instrument,
          satellite,
          version,
          acq_date,
          acq_time,
          daynight,
          confidence,
          frp,
          brightness,
          bright_ti4,
          bright_ti5,
          scan,
          track,
          geom,
          region,
          hash_dedupe,
          incendio_uuid,
          creado_en,
          actualizado_en,
          to_timestamp(
            acq_date || ' ' ||
            lpad((acq_time/100)::int::text,2,'0') || ':' ||
            lpad((acq_time%100)::int::text,2,'0'),
            'YYYY-MM-DD HH24:MI'
          ) at time zone 'UTC' AS acq_dt
        FROM puntos_calor
      )
    `

    const countSql = `
      ${cte}
      SELECT COUNT(*)::int AS total
      FROM pts p
      WHERE ${where.join(' AND ')}
    `
    const total = (await AppDataSource.query(countSql, params))?.[0]?.total ?? 0

    const limit = q.pageSize
    const offset = (q.page - 1) * q.pageSize

    const selectSql = `
      ${cte}
      SELECT
        p.punto_calor_uuid AS id,
        p.satellite,
        (p.confidence::numeric) AS confidence,
        (p.frp::numeric) AS frp,
        p.acq_date,
        p.acq_time,
        p.acq_dt,
        ST_Y(p.geom) AS lat,
        ST_X(p.geom) AS lon,
        p.incendio_uuid,
        p.creado_en,
        p.actualizado_en
      FROM pts p
      WHERE ${where.join(' AND ')}
      ORDER BY p.acq_dt DESC
      LIMIT $${i} OFFSET $${i+1}
    `
    const items = await AppDataSource.query(selectSql, [...params, limit, offset])

    res.json({ total, page: q.page, pageSize: q.pageSize, items })
  } catch (e) { next(e) }
})

/** STATS (series por día/hora) */
const statsSchema = z.object({
  // bucket de tiempo
  bucket: z.enum(['hour', 'day']).default('day'),
  hours: z.coerce.number().min(1).max(168).optional(),

  // filtros espaciales
  bbox: z.string().transform(s => s.split(',').map(Number)).pipe(z.array(z.number()).length(4)).optional(),
  near: z.string().transform(s => s.split(',').map(Number)).pipe(z.array(z.number()).length(2)).optional(),
  km: z.coerce.number().min(0.1).max(500).optional(),

  // filtros de atributos
  min_confidence: z.coerce.number().min(0).max(100).optional(),
  incendio_uuid: z.string().uuid().optional(),
})

router.get('/stats', async (req, res, next) => {
  try {
    const q = statsSchema.parse(req.query)
    const where: string[] = ['TRUE']
    const params: any[] = []
    let i = 1

    const cte = `
      WITH pts AS (
        SELECT
          punto_calor_uuid,
          geom,
          confidence,
          frp,
          acq_date,
          acq_time,
          incendio_uuid,
          to_timestamp(
            acq_date || ' ' ||
            lpad((acq_time/100)::int::text,2,'0') || ':' ||
            lpad((acq_time%100)::int::text,2,'0'),
            'YYYY-MM-DD HH24:MI'
          ) AT TIME ZONE 'UTC' AS acq_dt
        FROM puntos_calor
      )
    `

    if (q.hours) { where.push(`p.acq_dt >= now() - ($${i++} || ' hours')::interval`); params.push(q.hours) }
    if (q.incendio_uuid) { where.push(`p.incendio_uuid = $${i++}`); params.push(q.incendio_uuid) }
    if (typeof q.min_confidence === 'number') { where.push(`(p.confidence::numeric) >= $${i++}`); params.push(q.min_confidence) }

    if (q.bbox) {
      const [lonMin, latMin, lonMax, latMax] = q.bbox
      where.push(`ST_Intersects(p.geom, ST_SetSRID(ST_MakeEnvelope($${i}, $${i+1}, $${i+2}, $${i+3}), 4326))`)
      params.push(lonMin, latMin, lonMax, latMax); i += 4
    }

    if (q.near && q.km) {
      const [lon, lat] = q.near
      where.push(`ST_DWithin(p.geom::geography, ST_SetSRID(ST_MakePoint($${i}, $${i+1}),4326)::geography, $${i+2})`)
      params.push(lon, lat, q.km * 1000); i += 3
    }

    const bucketExpr = q.bucket === 'hour' ? `date_trunc('hour', p.acq_dt)` : `date_trunc('day', p.acq_dt)`

    const sql = `
      ${cte}
      SELECT
        ${bucketExpr} AS bucket,
        COUNT(*)::int AS count,
        AVG((p.confidence::numeric))::float8 AS avg_confidence,
        MAX((p.frp::numeric))::float8        AS max_frp
      FROM pts p
      WHERE ${where.join(' AND ')}
      GROUP BY 1
      ORDER BY 1 ASC
    `
    const items = await AppDataSource.query(sql, params)

    res.json({
      bucket: q.bucket,
      fromHours: q.hours ?? null,
      count: items.length,
      items: items.map((r: any) => ({
        bucket: r.bucket, // ISO timestamp (hora o día)
        count: Number(r.count),
        avg_confidence: r.avg_confidence != null ? Number(r.avg_confidence) : null,
        max_frp: r.max_frp != null ? Number(r.max_frp) : null,
      })),
    })
  } catch (e) { next(e) }
})

export default router
