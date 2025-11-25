// src/utils/logger.ts
import pino from 'pino'
import env from '../config/env'

export const logger = pino({
  level: env.LOG_LEVEL || 'info',
  transport: env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss',
      ignore: 'pid,hostname'
    }
  } : undefined
})

/**
 * Helpers específicos por contexto
 */
export const loggers = {
  notificacion: logger.child({ module: 'notificacion' }),
  cierre: logger.child({ module: 'cierre' }),
  incendio: logger.child({ module: 'incendio' }),
  auth: logger.child({ module: 'auth' }),
  push: logger.child({ module: 'push' }),
  subscriptions: logger.child({ module: 'subscriptions' }),
  geoespacial: logger.child({ module: 'geoespacial' })
}
