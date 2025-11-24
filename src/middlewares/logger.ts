// src/middlewares/logger.ts
import pino from 'pino'
import { Request, Response, NextFunction } from 'express'

export const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: { paths: ['req.headers.authorization', '*.password', '*.password_hash', '*.token', '*.cookie'], censor: '[redacted]' }
})

export function loggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  res.on('finish', () => {
    log.info({
      msg: 'http',
      requestId: res.locals.ctx?.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
      ip: res.locals.ctx?.ip,
      ua: res.locals.ctx?.ua,
      userId: res.locals.ctx?.user?.usuario_uuid || null
    })
  })
  next()
}
