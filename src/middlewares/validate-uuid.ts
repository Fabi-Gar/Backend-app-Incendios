// src/middlewares/validate-uuid.ts
import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { ErrorHelpers } from '../utils/response'

/**
 * Middleware para validar que uno o varios parámetros sean UUIDs válidos
 *
 * @example
 * router.get('/:id', validateUuidParams('id'), handler)
 * router.get('/:user_id/posts/:post_id', validateUuidParams('user_id', 'post_id'), handler)
 */
export function validateUuidParams(...paramNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const schemaObj: Record<string, z.ZodString> = {}

    for (const paramName of paramNames) {
      schemaObj[paramName] = z.string().uuid()
    }

    const schema = z.object(schemaObj)

    try {
      schema.parse(req.params)
      next()
    } catch (e: any) {
      const invalidParams = e.issues?.map((i: any) => i.path[0]).join(', ') || 'parámetros'
      return ErrorHelpers.badRequest(res, `UUID inválido en: ${invalidParams}`)
    }
  }
}

/**
 * Helper para validar UUIDs en query params
 *
 * @example
 * router.get('/search', validateUuidQuery('filter_id'), handler)
 */
export function validateUuidQuery(...queryNames: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const schemaObj: Record<string, z.ZodString> = {}

    for (const queryName of queryNames) {
      schemaObj[queryName] = z.string().uuid()
    }

    const schema = z.object(schemaObj)

    try {
      schema.parse(req.query)
      next()
    } catch (e: any) {
      const invalidQuery = e.issues?.map((i: any) => i.path[0]).join(', ') || 'parámetros'
      return ErrorHelpers.badRequest(res, `UUID inválido en query: ${invalidQuery}`)
    }
  }
}
