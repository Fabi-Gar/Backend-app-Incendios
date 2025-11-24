import { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'

export function notFound(_req: Request, res: Response) {
  const traceId = res.locals?.ctx?.requestId || randomUUID()
  res.status(404).json({ traceId, code: 'NOT_FOUND', message: 'Recurso no encontrado' })
}

export function onError(err: any, req: Request, res: Response, _next: NextFunction) {
  // Mapea errores comunes
  // Zod
  if (err?.issues && !err.status) {
    err.status = 400
    err.code = err.code || 'BAD_REQUEST'
  }
  // CORS (asegúrate de setear status=403 cuando lo creas en el middleware de CORS)
  if (err?.message === 'CORS blocked' && !err.status) {
    err.status = 403
    err.code = err.code || 'CORS_BLOCKED'
  }

  const status  = err.status || 500
  const code    = err.code || (status === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR')
  const traceId = res.locals?.ctx?.requestId || err.traceId || (req as any).id || randomUUID()
  const isProd  = process.env.NODE_ENV === 'production'

  const payload: any = {
    traceId,
    code,
    message: status >= 500 ? 'Error interno' : (err.message || 'Error'),
  }

  // Adjunta contexto útil en dev
  if (!isProd) {
    if (err.stack)   payload.stack = err.stack
    if (err.issues)  payload.issues = err.issues
    if (err.details) payload.details = err.details
  } else if (err.details) {
    // En prod, solo pasa detalles si los seteaste explícitamente (opc.)
    payload.details = err.details
  }

  res.status(status).json(payload)
}
