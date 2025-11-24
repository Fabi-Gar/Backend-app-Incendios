// src/utils/jwt.ts
import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken'
import env from '../config/env'

// Asegura tipos compatibles con jsonwebtoken
const secret: string = String(env.JWT_SECRET) // fuerza string, evita overload "none"
const issuer: string | undefined = env.JWT_ISSUER || undefined
const audience: string | undefined = env.JWT_AUDIENCE || undefined
const expiresIn: SignOptions['expiresIn'] =
  (env.JWT_EXPIRES_IN as any) || '90d'

type SignInput = {
  sub: string // usuario_uuid
  is_admin: boolean
  rol_uuid?: string | null
  institucion_uuid?: string | null
  email?: string
  nombre?: string
}

export function signAccessToken(payload: SignInput) {
  const body = {
    is_admin: payload.is_admin,
    rol_uuid: payload.rol_uuid ?? null,
    institucion_uuid: payload.institucion_uuid ?? null,
    email: payload.email,
    nombre: payload.nombre,
  }

  // No seteamos algorithm (HS256 es default para secreto HMAC)
  const token = jwt.sign(body, secret, {
    issuer,
    audience,
    expiresIn,   // string o number
    subject: payload.sub, // usuario_uuid
  } as SignOptions)

  return token
}

export function verifyAccessToken(token: string) {
  const decoded = jwt.verify(token, secret, {
    issuer,
    audience,
    // algorithms: ['HS256'] // opcional, puedes fijarlo si quieres
  }) as JwtPayload
  return decoded
}
