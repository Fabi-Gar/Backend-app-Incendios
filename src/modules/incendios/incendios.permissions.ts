import { AppDataSource } from '../../db/data-source'
import { Incendio } from './entities/incendio.entity'
import { IsNull } from 'typeorm'

type UserCtx = { usuario_uuid: string; is_admin?: boolean } | null

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
