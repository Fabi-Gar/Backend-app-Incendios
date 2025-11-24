import { AppDataSource } from '../../db/data-source'
import { Notificacion } from './entities/notificacion.entity'

// usuario del sistema para alertas globales (puedes usar un UUID fijo o null)
const SYSTEM_USER_UUID = process.env.SYSTEM_USER_UUID || '00000000-0000-0000-0000-000000000000'

const windowMin = Number(process.env.NOTIFY_DUP_WINDOW_MIN || 60)

export async function crearNotificacion(usuario_uuid: string, tipo: string, payload?: any) {
  const repo = AppDataSource.getRepository(Notificacion)
  const dup = await repo.createQueryBuilder('n')
    .where('n.usuario_uuid = :u', { u: usuario_uuid })
    .andWhere('n.tipo = :t', { t: tipo })
    .andWhere('n.creado_en >= NOW() - INTERVAL :w', { w: `${windowMin} minutes` })
    .getCount()
  if (dup > 0) return null
  const n = repo.create({ usuario_uuid, tipo, payload: payload || null })
  return repo.save(n)
}

export async function notificarJobFallido(job: string, error: string) {
  return crearNotificacion(SYSTEM_USER_UUID, 'job_failed', { job, error })
}

export async function notificarJobStale(job: string, horas: number, lastSuccessAt?: string) {
  return crearNotificacion(SYSTEM_USER_UUID, 'job_stale', { job, horas, lastSuccessAt })
}

export async function notificarJobSinDatos(job: string) {
  return crearNotificacion(SYSTEM_USER_UUID, 'job_no_data', { job })
}
