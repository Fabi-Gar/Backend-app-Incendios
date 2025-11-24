import { Router, Request, Response, NextFunction } from 'express'
import { AppDataSource } from '../db/data-source'
import { JobRun } from '../modules/jobs/entities/job-run.entity'
import { AuditoriaEventos } from '../modules/auditoria/entities/auditoria-eventos.entity'
import { Incendio } from '../modules/incendios/entities/incendio.entity'
import { PuntoCalor } from '../modules/geoespacial/entities/punto-calor.entity'
import { EstadoIncendio } from '../modules/catalogos/entities/estado-incendio.entity'
import { Notificacion } from '../modules/notificaciones/entities/notificacion.entity'

const router = Router()

// ✅ /monitor/jobs
router.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobName = (req.query.job as string | undefined) ?? undefined
    const status = (req.query.status as string | undefined) ?? undefined
    const limit = Math.min(Number(req.query.limit) || 20, 200)
    const offset = Number(req.query.offset) || 0

    const repo = AppDataSource.getRepository(JobRun)
    const qb = repo
      .createQueryBuilder('j')
      .orderBy('j.inicio', 'DESC')
      .take(limit)
      .skip(offset)

    if (jobName) qb.andWhere('j.nombre_job = :job', { job: jobName })
    if (status) qb.andWhere('j.status = :status', { status })

    const [rows, total] = await qb.getManyAndCount()

    const items = rows.map(r => {
      const durationMs =
        r.fin && r.inicio ? (new Date(r.fin).getTime() - new Date(r.inicio).getTime()) : null
      return {
        job_run_uuid: r.job_run_uuid,
        job_name: r.nombre_job,
        status: r.status,
        started_at: r.inicio,
        finished_at: r.fin,
        duration_ms: durationMs,
        metrics: {
          inserted: r.insertados ?? 0,
          deduplicated: r.ignorados ?? 0,
          associated: r.asociados ?? 0,
        },
        errors: r.errores ?? null,
      }
    })

    res.json({ items, count: items.length, total })
  } catch (err) {
    next(err)
  }
})

// ✅ /monitor/auditoria
router.get('/auditoria', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const repo = AppDataSource.getRepository(AuditoriaEventos)
    const items = await repo.find({ order: { creado_en: 'DESC' }, take: 50 })
    res.json({ items, count: items.length })
  } catch (err) {
    next(err)
  }
})

// ✅ /monitor/stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const incendioRepo = AppDataSource.getRepository(Incendio)
    const estadoRepo   = AppDataSource.getRepository(EstadoIncendio)
    const puntoRepo    = AppDataSource.getRepository(PuntoCalor)

    // 1) Incendios por estado (agrupando por FK estado_incendio_uuid)
    const incendiosPorEstadoRaw = await incendioRepo
      .createQueryBuilder('i')
      .select('i.estado_incendio_uuid', 'estado_id')
      .addSelect('COUNT(*)', 'total')
      .where('i.eliminado_en IS NULL')
      .groupBy('i.estado_incendio_uuid')
      .getRawMany<{ estado_id: string; total: string }>()

    // 2) Intentamos mapear a un label legible usando EstadoIncendio
    const estados = await estadoRepo.find()
    // Prioridad de campos posibles para nombre/código
    const labelCandidates = ['nombre', 'codigo', 'name', 'code', 'slug', 'descripcion']
    // Detecta el primer campo que exista en la entidad EstadoIncendio
    const estadoCols = estadoRepo.metadata.columns.map(c => c.propertyName)
    const labelField = labelCandidates.find(c => estadoCols.includes(c)) ?? null

    const mapById: Record<string, any> = {}
    for (const e of estados) {
      // PK se llama estado_incendio_uuid en tu JoinColumn
      const pkCol = estadoRepo.metadata.primaryColumns[0]?.propertyName ?? 'estado_incendio_uuid'
      const id = (e as any)[pkCol]
      mapById[id] = {
        id,
        label: labelField ? (e as any)[labelField] : null,
      }
    }

    const incendios_por_estado = incendiosPorEstadoRaw.map(r => ({
      estado_uuid: r.estado_id,
      estado: mapById[r.estado_id]?.label ?? r.estado_id,
      total: Number(r.total),
    }))

    // 3) Incendios reportados últimos 7 días
    const incendios_reportados_7d = await incendioRepo
      .createQueryBuilder('i')
      .where("i.reportado_en >= NOW() - INTERVAL '7 days'")
      .andWhere('i.eliminado_en IS NULL')
      .getCount()

    // 4) Puntos FIRMS últimos 3 días (ajusta columna si difiere)
    const puntos_firms_3d = await puntoRepo
      .createQueryBuilder('p')
      .where("p.creado_en >= NOW() - INTERVAL '3 days'")
      .getCount()

    res.json({
      incendios_por_estado,
      incendios_reportados_7d,
      puntos_firms_3d: puntos_firms_3d,
    })
  } catch (err) {
    next(err)
  }
})

    router.get('/notificaciones', async (req, res, next) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 50, 200)
        const repo = AppDataSource.getRepository(Notificacion)
        const items = await repo.find({
        order: { creado_en: 'DESC' },
        take: limit,
        })
        res.json({ items, count: items.length })
    } catch (err) {
        next(err)
    }
    })

export default router
