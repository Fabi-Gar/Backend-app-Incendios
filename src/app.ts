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
// Subidas (fotos de incendio)
// (Integradas en los endpoints principales o removidas temporalmente)

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
app.use('/api', healthRoutes)

// ---------------- Contexto + Auth ----------------
app.use(contextMiddleware)
app.use(authMiddleware)

// ---------------- Rutas con prefijo /api ----------------
// ---------------- Rutas Notificaciones ----------------
app.use('/api/notificaciones', notificacionesRoutes) // asumiendo que internamente manejan la raiz /
app.use('/api', pushRoutes)
app.use('/api', testPushRoutes)

// ---------------- Rutas Incendios y Fotos ----------------
app.use('/api/incendios', incendiosRoutes)
// Si necesitas endpoint de subidas separado, añádelo aquí luego
app.use('/api/seguidores', seguidoresRoutes)

// ---------------- Rutas Catálogos y Seguridad ----------------
app.use('/api/auth', authRoutes)
app.use('/api/usuarios', usuariosRoutes)
app.use('/api/roles', rolesRoutes)
app.use('/api/instituciones', institucionesRoutes)
app.use('/api/catalogos', catalogosRoutes)
app.use('/api/estados-incendio', estadosIncendioRoutes)
app.use('/api/departamentos', departamentosRoutes)

// ---------------- Rutas Otros Módulos ----------------
app.use('/api/firms', firmsRoutes)
app.use('/api/puntos-calor', puntosCalorRoutes)
app.use('/api/monitor', monitorRoutes)

// Ruta de prueba de autenticación
app.get('/api/test-auth', (_req, res) => {
  res.json({ ok: true, user: res.locals.ctx?.user || null })
})

// ---------------- Manejo de errores ----------------
app.use(notFound)
app.use(onError)

export default app