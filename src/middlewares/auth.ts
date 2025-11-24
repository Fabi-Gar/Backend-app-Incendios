// src/middlewares/auth.ts
import { Request, Response, NextFunction } from 'express'
import { AppDataSource } from '../db/data-source'
import { Usuario } from '../modules/seguridad/entities/usuario.entity'
import { IsNull } from 'typeorm'
import { randomUUID } from 'crypto'
import { verifyAccessToken } from '../utils/jwt'

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
}
async function findUser(usuario_uuid: string) {
  return AppDataSource.getRepository(Usuario).findOne({
    where: { usuario_uuid, eliminado_en: IsNull() },
    relations: ['rol', 'institucion'],
  })
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Contexto base
  if (!res.locals.ctx) {
    res.locals.ctx = {
      requestId: (req as any).id || randomUUID(),
      ip: req.ip,
      ua: req.headers['user-agent'] || '',
      user: null,
    }
  }

  // 🟢 Rutas públicas (no requieren token)
  const publicPaths = new Set<string>([
    '/auth/login',
    '/auth/register',
    '/health/liveness',
    '/health/readiness',
  ])
  if (publicPaths.has(req.path)) {
    return next()
  }

  // A partir de aquí, token requerido
  const authHeader = (req.headers.authorization || '').trim()
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!bearer) {
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Falta token Bearer' },
      requestId: res.locals.ctx?.requestId,
    })
  }

  try {
    const claims = verifyAccessToken(bearer)
    const sub = String(claims.sub || '').trim()
    if (!isUuid(sub)) {
      return res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Sub inválido en token' },
        requestId: res.locals.ctx?.requestId,
      })
    }

    const user = await findUser(sub)
    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_TOKEN', message: 'Usuario no encontrado' },
        requestId: res.locals.ctx?.requestId,
      })
    }

    // Inyecta usuario en el contexto
    res.locals.ctx.user = {
      usuario_uuid: user.usuario_uuid,
      email: user.email,
      nombre: (user as any).nombre,
      apellido: (user as any).apellido,
      is_admin: !!(user as any).is_admin,
      rol_uuid: (user as any)?.rol?.rol_uuid ?? null,
      institucion_uuid: (user as any)?.institucion?.institucion_uuid ?? null,
    } as any

    next()
  } catch (err: any) {
    const code = err?.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    return res.status(401).json({
      error: { code, message: err?.message || 'Token inválido' },
      requestId: res.locals.ctx?.requestId,
    })
  }
}

// Requiere login
export function guardAuth(_req: Request, res: Response, next: NextFunction) {
  if (!res.locals.ctx?.user)
    return res.status(401).json({
      error: { code: 'UNAUTHENTICATED', message: 'Auth requerido' },
      requestId: res.locals.ctx?.requestId,
    })
  next()
}

// Solo admin
export function guardAdmin(_req: Request, res: Response, next: NextFunction) {
  const u = res.locals.ctx?.user as Usuario | (Usuario & { is_admin?: boolean }) | null
  if (!u?.is_admin)
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'Solo admin' },
      requestId: res.locals.ctx?.requestId,
    })
  next()
}
