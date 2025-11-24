// src/utils/response.ts
import { Response } from 'express'

/**
 * Formato estandarizado para respuestas de error
 */
export interface ErrorResponse {
  error: {
    code: string
    message: string
  }
  requestId?: string
}

/**
 * Helper para enviar respuestas de error estandarizadas
 */
export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string
): Response {
  const response: ErrorResponse = {
    error: { code, message },
    requestId: res.locals.ctx?.requestId
  }
  return res.status(status).json(response)
}

/**
 * Helpers específicos para códigos de estado comunes
 */
export const ErrorHelpers = {
  badRequest: (res: Response, message: string = 'Solicitud inválida') =>
    sendError(res, 400, 'BAD_REQUEST', message),

  unauthorized: (res: Response, message: string = 'No autorizado') =>
    sendError(res, 401, 'UNAUTHENTICATED', message),

  forbidden: (res: Response, message: string = 'Acceso denegado') =>
    sendError(res, 403, 'FORBIDDEN', message),

  notFound: (res: Response, message: string = 'Recurso no encontrado') =>
    sendError(res, 404, 'NOT_FOUND', message),

  conflict: (res: Response, message: string = 'Conflicto') =>
    sendError(res, 409, 'CONFLICT', message),

  unprocessable: (res: Response, message: string = 'No se puede procesar') =>
    sendError(res, 422, 'UNPROCESSABLE_ENTITY', message),

  serverError: (res: Response, message: string = 'Error interno del servidor') =>
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', message)
}
