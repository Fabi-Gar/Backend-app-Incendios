import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import pino from 'pino'
import pinoHttp from 'pino-http'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'

import env from './config/env'
import healthRoutes from './app/health.routes'
import { notFound, onError } from './app/error'
import seguidoresRoutes from './modules/incendios/seguidores.routes'

// Middlewares personalizados
import { contextMiddleware } from './middlewares/context'
import { authMiddleware } from './middlewares/auth'

// Módulos de notificaciones
import pushRoutes from './modules/notificaciones/push.routes'
import notificacionesRoutes from './modules/notificaciones/notificaciones.routes'
import testPushRoutes from './modules/notificaciones/testpush.routes'

// Otros módulos
import firmsRoutes from './modules/geoespacial/firms.routes'
import authRoutes from './modules/auth/auth.routes'
import usuariosRoutes from './modules/seguridad/usuarios.routes'
import incendiosRoutes from './modules/incendios/incendios.routes'
import catalogosRoutes from './app/catalogos.routes'
import rolesRoutes from './modules/seguridad/roles.routes'
import institucionesRoutes from './modules/seguridad/instituciones.routes'
import estadosIncendioRoutes from './app/estados-incendio.routes'
import puntosCalorRoutes from './modules/geoespacial/puntos-calor.routes'
import monitorRoutes from './app/monitor.routes'
import departamentosRoutes from './modules/catalogos/entities/departamentos.routes'
import cierreRoutes from './modules/cierre/cierre.routes'
import plantillasRoutes from './modules/cierre/plantillas.routes'

// Subidas (fotos de incendio)
import fotosReporteRoutes from './uploads/fotos-reporte.routes'

const logger = pino({ level: env.LOG_LEVEL })
const app = express()

// app.set('trust proxy', 1) // ⇐ descomenta si quieres que req.ip/secure funcionen detrás de Caddy

// ---------------- Middlewares base ----------------
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true)
    if (env.CORS_ALLOWED_ORIGINS_LIST.includes(origin)) return cb(null, true)
    const e: any = new Error('CORS blocked')
    e.status = 403
    e.code = 'CORS_BLOCKED'
    return cb(e)
  },
  credentials: true,
}))
app.use(pinoHttp({ logger }))
app.use(express.json({ limit: `${env.PAYLOAD_LIMIT_MB}mb` }))
app.use(rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
}))

// ---------------- Static /uploads (antes de auth) ----------------
const uploadsDir = process.env.MEDIA_DIR || path.resolve(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}
app.use('/uploads', express.static(uploadsDir, {
  fallthrough: true,
  maxAge: '7d',
  setHeaders(res) { res.setHeader('X-Content-Type-Options', 'nosniff') },
}))

// ---------------- Rutas públicas básicas (antes de auth) ----------------
app.use(healthRoutes)

// ---------------- Contexto + Auth ----------------
app.use(contextMiddleware)
app.use(authMiddleware)

// ---------------- Rutas de autenticación ----------------
app.use('/auth', authRoutes)

// ---------------- Rutas de notificaciones push ----------------
app.use(pushRoutes) // POST /api/push/register, /api/push/prefs, /api/push/unregister
app.use(notificacionesRoutes) // GET /api/notificaciones, POST /api/notificaciones/:id/leer

// Ruta de prueba (solo en desarrollo)
  app.use('/api', testPushRoutes) // POST /api/test-push

// ---------------- Rutas principales ----------------
app.use('/usuarios', usuariosRoutes)
app.use('/incendios', incendiosRoutes)
app.use('/seguidores', seguidoresRoutes)
app.use('/incendios', fotosReporteRoutes)  // subir/servir fotos de incendios
app.use('/catalogos', catalogosRoutes)
app.use('/roles', rolesRoutes)
app.use('/firms', firmsRoutes)
app.use('/monitor', monitorRoutes)
app.use('/departamentos', departamentosRoutes)
app.use('/cierre', cierreRoutes)
app.use('/cierre-admin', plantillasRoutes)
app.use('/instituciones', institucionesRoutes)
app.use('/puntos-calor', puntosCalorRoutes)
app.use(estadosIncendioRoutes)

// Ruta de prueba de autenticación
app.get('/test-auth', (_req, res) => {
  res.json({ ok: true, user: res.locals.ctx?.user || null })
})

// ---------------- Manejo de errores ----------------
app.use(notFound)
app.use(onError)

export default app