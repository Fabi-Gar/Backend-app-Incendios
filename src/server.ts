import 'reflect-metadata'
import app from './app'
import env from './config/env'
import { AppDataSource } from './db/data-source'
import pino from 'pino'
import { ensureFirmsCron } from './modules/geoespacial/firms.queue'
import { initFirebase } from './modules/notificaciones/firebasePush.service'

const logger = pino({ level: env.LOG_LEVEL })

async function main() {
  try {
    // 1. Conectar base de datos
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize()
      logger.info('✅ Base de datos conectada')
    }

    // 2. Inicializar Firebase (AGREGAR ESTO) ←
    try {
      initFirebase()
      logger.info('✅ Firebase inicializado')
    } catch (error) {
      logger.error({ err: error }, '⚠️ Firebase no se pudo inicializar')
      logger.warn('   Las notificaciones push NO funcionarán')
    }

    // 3. Inicializar cron FIRMS (si está habilitado)
    if (env.FIRMS_ENABLED) {
      await ensureFirmsCron()
      logger.info(`🛰️ Cron FIRMS programado: ${env.FIRMS_FETCH_CRON}`)
    }

    // 4. Iniciar servidor
    const port = env.PORT || 4000
    app.listen(port, () => {
      logger.info(`🚀 Servidor escuchando en http://localhost:${port}`)
      logger.info(`🩺 Healthcheck: /health/liveness | /health/readiness`)
      logger.info(`🔥 Notificaciones: /api/test-push`)
    })
  } catch (e) {
    logger.error('❌ Error al iniciar la aplicación')
    logger.error(e)
    process.exit(1)
  }
}

main()