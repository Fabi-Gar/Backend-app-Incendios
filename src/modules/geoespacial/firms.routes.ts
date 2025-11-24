// src/modules/geoespacial/firms.routes.ts
import { Router, Request, Response } from 'express'
import { AppDataSource } from '../../db/data-source'
import { JobRun } from '../jobs/entities/job-run.entity'
import { AuditoriaEventos } from '../auditoria/entities/auditoria-eventos.entity'
import { PuntoCalor } from './entities/punto-calor.entity'
import { runFirmsIngest } from './services/firms.service'
import { Brackets } from 'typeorm'

const router = Router()

// Ejecuta ingesta manual
router.post('/run', async (_req, res, next) => {
  try {
    const r = await runFirmsIngest()
    res.json(r)
  } catch (e) { next(e) }
})

// Listado de ejecuciones (job-runs)
router.get('/job-runs', async (req, res, next) => {
  try {
    const take = Math.min(parseInt(String(req.query.take || 20)), 100)
    const repo = AppDataSource.getRepository(JobRun)
    const rows = await repo.createQueryBuilder('j')
      .orderBy('j.inicio','DESC')
      .take(take)
      .getMany()
    res.json(rows)
  } catch (e) { next(e) }
})

// Feed de auditoría para un incendio
router.get('/incendios/:id/feed', async (req, res, next) => {
  try {
    const id = req.params.id
    const take = Math.min(parseInt(String(req.query.take || 50)), 200)
    const repo = AppDataSource.getRepository(AuditoriaEventos)
    const rows = await repo.createQueryBuilder('a')
      .where('a.entidad = :ent AND a.entidad_uuid = :id', { ent: 'incendios', id })
      .orderBy('a.creado_en','DESC')
      .take(take)
      .getMany()
    res.json(rows)
  } catch (e) { next(e) }
})

// SSE keepalive
router.get('/sse', async (req, res) => {
  res.setHeader('Content-Type','text/event-stream')
  res.setHeader('Cache-Control','no-cache')
  res.setHeader('Connection','keep-alive')
  const hb = setInterval(
    () => res.write(`event: ping\ndata: {}\n\n`),
    parseInt(process.env.SSE_HEARTBEAT_MS || '15000')
  )
  req.on('close', () => clearInterval(hb))
})

// --- GET /firms/puntos ---
// Params soportados:
// - days?: number
// - bbox?: "w,s,e,n"
// - near?: "lon,lat"
// - km?: number
// - page?: number
// - limit?: number (tope 20000)
// - order?: 'recientes' | 'confianza' | 'frp'
// - as?: 'geojson'  -> devuelve FeatureCollection
router.get('/puntos', async (req: Request, res: Response, next) => {
  try {
    const repo = AppDataSource.getRepository(PuntoCalor)

    const days   = req.query.days ? Number(req.query.days) : undefined
    const bboxQ  = typeof req.query.bbox === 'string' ? req.query.bbox : undefined
    const nearQ  = typeof req.query.near === 'string' ? req.query.near : undefined
    const km     = req.query.km ? Number(req.query.km) : undefined
    const order  = (req.query.order as string) || 'recientes'
    const asGeo  = (req.query.as as string) === 'geojson'

    const pageRaw  = Number(req.query.page || 1)
    const limitRaw = Number(req.query.limit || 500)
    const page  = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1)
    const limit = Math.min(20000, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 500))
    const offset = (page - 1) * limit

    let qb = repo.createQueryBuilder('p')
      .where('p.eliminado_en IS NULL')

    // filtro por tiempo (últimos N días) usando acq_date+acq_time (UTC)
    if (days && days > 0) {
      qb = qb.andWhere(new Brackets(q => {
        q.where(`
          to_timestamp(
            concat(p.acq_date, ' ',
              lpad((p.acq_time/100)::int::text,2,'0'),
              ':',
              lpad((p.acq_time%100)::int::text,2,'0')
            ),
            'YYYY-MM-DD HH24:MI'
          ) >= (now() at time zone 'UTC') - make_interval(days := :days)
        `, { days })
      }))
    }

    // bbox (w,s,e,n)
    if (bboxQ) {
      const parts = bboxQ.split(',').map(s => Number(s.trim()))
      if (parts.length === 4 && parts.every(Number.isFinite)) {
        const [w,s,e,n] = parts
        qb = qb.andWhere(`
          ST_Intersects(
            p.geom,
            ST_SetSRID(ST_MakeEnvelope(:w,:s,:e,:n),4326)
          )
        `, { w,s,e,n })
      }
    }

    // near + km
    if (nearQ && km && Number.isFinite(km)) {
      const p = nearQ.split(',').map(s => Number(s.trim()))
      if (p.length === 2 && p.every(Number.isFinite)) {
        const [lon, lat] = p
        qb = qb.andWhere(`
          ST_DWithin(
            p.geom::geography,
            ST_SetSRID(ST_MakePoint(:lon,:lat),4326)::geography,
            :meters
          )
        `, { lon, lat, meters: km * 1000 })
      }
    }

    // ordenamiento
    if (order === 'confianza') {
      qb = qb.orderBy('p.confidence','DESC','NULLS LAST')
             .addOrderBy('p.acq_date','DESC')
             .addOrderBy('p.acq_time','DESC')
    } else if (order === 'frp') {
      qb = qb.orderBy('p.frp','DESC','NULLS LAST')
             .addOrderBy('p.acq_date','DESC')
             .addOrderBy('p.acq_time','DESC')
    } else {
      qb = qb.orderBy('p.acq_date','DESC')
             .addOrderBy('p.acq_time','DESC')
    }

    // consulta paginada principal
    const [items, total] = await qb.skip(offset).take(limit).getManyAndCount()

    // === NUEVO: obtener lon/lat reales por id ===
    const ids = items.map(it => it.punto_calor_uuid)
    const rawCoords = ids.length
      ? await repo.createQueryBuilder('p')
          .select([
            'p.punto_calor_uuid AS id',
            'ST_X(p.geom) AS lon',
            'ST_Y(p.geom) AS lat',
          ])
          .where('p.punto_calor_uuid IN (:...ids)', { ids })
          .getRawMany()
      : []
    const coordMap = new Map(rawCoords.map((r: any) => [r.id, { lon: Number(r.lon), lat: Number(r.lat) }]))

    // respuesta lista (no geojson)
    if (!asGeo) {
      return res.json({
        total,
        page,
        pageSize: limit,
        items: items.map(it => {
          const c = coordMap.get(it.punto_calor_uuid)
          return {
            id: it.punto_calor_uuid,
            source: (it as any).fuente ?? (it as any).source ?? 'FIRMS',
            sourceId: it.hash_dedupe ?? it.punto_calor_uuid,
            acqTime: `${it.acq_date} ${String(Math.floor(it.acq_time/100)).padStart(2,'0')}:${String(it.acq_time%100).padStart(2,'0')}:00Z`,
            confidence: it.confidence == null ? null : Number(it.confidence),
            frp: it.frp == null ? null : Number(it.frp),
            lon: c?.lon ?? null,
            lat: c?.lat ?? null,
          }
        }),
        window: { start: '', end: '' }
      })
    }

    // GeoJSON con coords reales (orden preservado por 'items')
    const fc = {
      type: 'FeatureCollection' as const,
      features: items.map(it => {
        const c = coordMap.get(it.punto_calor_uuid)
        return {
          type: 'Feature' as const,
          id: it.punto_calor_uuid,
          geometry: {
            type: 'Point' as const,
            coordinates: [
              c?.lon ?? 0,
              c?.lat ?? 0,
            ] as [number, number],
          },
          properties: {
            source: (it as any).fuente ?? (it as any).source ?? 'FIRMS',
            sourceId: it.hash_dedupe ?? it.punto_calor_uuid,
            acqTime: `${it.acq_date} ${String(Math.floor(it.acq_time/100)).padStart(2,'0')}:${String(it.acq_time%100).padStart(2,'0')}:00Z`,
            confidence: it.confidence == null ? null : Number(it.confidence),
            frp: it.frp == null ? null : Number(it.frp),
          }
        }
      })
    }

    return res.json({ total, page, pageSize: limit, items: fc })
  } catch (e) { next(e) }
})

export default router
