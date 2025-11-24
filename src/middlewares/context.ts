import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'

export function contextMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId =
    (res.locals?.ctx?.requestId as string) ||
    (req as any).id || // pino-http genera un id si está configurado
    randomUUID()

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
    || req.socket.remoteAddress
    || ''
  const ua = req.headers['user-agent'] || ''

  res.locals.ctx = { requestId, ip, ua, user: null }
  next()
}
