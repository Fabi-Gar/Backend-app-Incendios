// src/app/health.routes.ts
import { Router } from 'express'
import { AppDataSource } from '../db/data-source'
import env from '../config/env'
import Redis from 'ioredis'
import { notificarJobStale } from '../modules/notificaciones/notificaciones.service'

const router = Router()

let redis: Redis | null = null
function getRedis(): Redis | null {
  if (!env.REDIS_URL) return null
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { lazyConnect: true })
    redis.on('error', () => {}) 
  }
  return redis
}

router.get('/health/liveness', (_req, res) => {
  res.json({ status: 'ok', env: env.NODE_ENV })
})

router.get('/health/monitoring', async (_req, res) => {
  try {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize()
    await AppDataSource.query('SELECT 1')

    const r = getRedis()
    if (r) await r.ping()

    const thresholdHrs = Number(process.env.ALERT_THRESHOLD_HOURS) || 24
    const lastJob = await AppDataSource.query(`
      SELECT inicio
      FROM job_runs
      WHERE nombre_job = 'firms.ingest' AND status = 'SUCCESS'
      ORDER BY inicio DESC
      LIMIT 1
    `)

    if (lastJob.length === 0) {
      
      return res.status(503).json({
        status: 'fail',
        reason: 'No job runs found for firms.ingest',
      })

      
    }

    const last = new Date(lastJob[0].started_at)
    const diffHours = (Date.now() - last.getTime()) / 3600000

    if (diffHours > thresholdHrs) {
      await notificarJobStale('firms.ingest', diffHours, last.toISOString())

      return res.status(503).json({
        status: 'stale',
        lastSuccessAt: last.toISOString(),
        diffHours
      })
    }


    res.json({ status: 'ok', lastSuccessAt: last.toISOString() })
  } catch (e) {
    res.status(503).json({ status: 'error', message: String(e) })
  }
})



router.get('/health/readiness', async (_req, res) => {
  try {
    if (!AppDataSource.isInitialized) await AppDataSource.initialize()
    await AppDataSource.query('select 1')

    const r = getRedis()
    if (r) {
      if (!r.status || r.status === 'end' || r.status === 'wait') await r.connect()
      const pong = await r.ping()
      if (pong !== 'PONG') throw new Error('Redis no responde')
    }

    res.json({ status: 'ready' })
  } catch (e: any) {
    res.status(503).json({ status: 'not-ready', reason: e?.message || 'unknown' })
  }
})

export default router
