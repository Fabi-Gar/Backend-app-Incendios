import { AppDataSource } from '../../db/data-source'
import { Incendio } from './entities/incendio.entity'
import { IsNull } from 'typeorm'

type UserCtx = { usuario_uuid: string; is_admin?: boolean } | null

export interface UserContext {
  usuario_uuid?: string
  is_admin?: boolean
  es_miembro_institucion?: boolean
  institucion_uuid?: string
  nombre?: string
  apellido?: string
}

export interface IncendioContext {
  incendio_uuid: string
  creado_por_uuid: string
  extinguido_at?: Date | null
  aprobado?: boolean
}

export async function assertCanReport(user: UserCtx, incendio_uuid: string) {
  if (!user?.usuario_uuid) {
    const e: any = new Error('Auth requerido')
    e.status = 401
    e.code = 'UNAUTHENTICATED'
    throw e
  }

  if (user.is_admin) return true

  const incRepo = AppDataSource.getRepository(Incendio)

  const inc = await incRepo.findOne({
    where: { incendio_uuid, eliminado_en: IsNull() },
    relations: { creado_por: true } 
})

  if (!inc) {
    const e: any = new Error('Incendio no existe')
    e.status = 404
    e.code = 'NOT_FOUND'
    throw e
  }

  if (inc.creado_por?.usuario_uuid !== user.usuario_uuid) {
    const e: any = new Error('Sin permiso para reportar en este incendio')
    e.status = 403
    e.code = 'FORBIDDEN'
    throw e
  }

  return true
}

/**
 * Verifica si un usuario puede editar un incendio
 */
export function canEditIncendio(user: UserContext, incendio: IncendioContext): boolean {
  // Admin siempre puede editar
  if (user?.is_admin) return true

  // Creador puede editar su propio incendio
  if (user?.usuario_uuid === incendio.creado_por_uuid) return true

  return false
}

/**
 * Verifica si un usuario puede editar el cierre de un incendio
 */
export function canEditCierre(user: UserContext, incendio: IncendioContext): boolean {
  // Si está extinguido, solo admin puede editar
  if (incendio.extinguido_at) return !!user?.is_admin

  // Si NO está extinguido: admin, creador, o miembro de institución
  return !!(
    user?.is_admin ||
    user?.usuario_uuid === incendio.creado_por_uuid ||
    user?.es_miembro_institucion
  )
}

/**
 * Verifica si un usuario puede aprobar/rechazar un incendio
 */
export function canApproveIncendio(user: UserContext): boolean {
  return !!user?.is_admin
}

/**
 * Verifica si un usuario puede eliminar un incendio
 */
export function canDeleteIncendio(user: UserContext, incendio: IncendioContext): boolean {
  // Solo admin o creador
  return !!(
    user?.is_admin ||
    user?.usuario_uuid === incendio.creado_por_uuid
  )
}

/**
 * Verifica si un usuario puede finalizar (extinguir) un incendio
 */
export function canFinalizeIncendio(user: UserContext): boolean {
  return !!user?.is_admin
}

/**
 * Verifica si un usuario puede ver un incendio
 */
export function canViewIncendio(user: UserContext, incendio: IncendioContext): boolean {
  // Si está aprobado, cualquier usuario autenticado puede verlo
  if (incendio.aprobado) return true

  // Si no está aprobado, solo admin o creador pueden verlo
  return !!(
    user?.is_admin ||
    user?.usuario_uuid === incendio.creado_por_uuid
  )
}
