import { AppDataSource } from '../../db/data-source'
import { AuditoriaEventos } from './entities/auditoria-eventos.entity'

type Ctx = {
  requestId: string
  ip: string
  ua: string
  user?: { usuario_uuid?: string } | null
}

type AuditInput = {
  tabla: string
  registro_uuid: string
  accion: 'INSERT' | 'UPDATE' | 'DELETE' | 'RESTORE'
  antes?: any
  despues?: any
  ctx: Ctx
}

export async function auditRecord(input: AuditInput) {
  const repo = AppDataSource.getRepository(AuditoriaEventos)

  const body: Partial<AuditoriaEventos> & {
    request_id: string
    ip: string
    ua: string
  } = {
    tabla: input.tabla,
    registro_id: input.registro_uuid,
    accion: input.accion,
    request_id: input.ctx.requestId,
    ip: input.ctx.ip,
    ua: input.ctx.ua,
    usuario_uuid: input.ctx.user?.usuario_uuid ?? null,
    antes: input.antes ? safeDiff(input.antes) : null,
    despues: input.despues ? safeDiff(input.despues) : null
  }

  return repo.save(body as any)
}

function safeDiff(x: any) {
  if (!x) return null
  const clone = JSON.parse(JSON.stringify(x))
  if (clone.password) clone.password = '[redacted]'
  if (clone.password_hash) clone.password_hash = '[redacted]'
  if (clone.token) clone.token = '[redacted]'

  if (clone.geom?.type === 'MultiPolygon') {
    clone.geom = { type: 'MultiPolygon', meta: 'omitted' }
  }

  if (clone.centroide?.type === 'Point' && Array.isArray(clone.centroide.coordinates)) {
    clone.centroide = {
      type: 'Point',
      coordinates: clone.centroide.coordinates.map((n: number) =>
        Number.isFinite(n) ? Number(n.toFixed(4)) : n
      )
    }
  }

  return clone
}
