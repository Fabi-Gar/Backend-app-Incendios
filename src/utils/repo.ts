import { Repository, FindManyOptions, FindOneOptions, ObjectLiteral, IsNull } from 'typeorm'

export function activeFind<T extends ObjectLiteral>(
  repo: Repository<T>,
  options: FindManyOptions<T> = {}
) {
  const where = (options.where as any) || {}
  if (where.eliminado_en === undefined) where.eliminado_en = IsNull()
  return repo.find({ ...options, where })
}

export function activeFindOne<T extends ObjectLiteral>(
  repo: Repository<T>,
  options: FindOneOptions<T> = {}
) {
  const where = (options.where as any) || {}
  if (where.eliminado_en === undefined) where.eliminado_en = IsNull()
  return repo.findOne({ ...options, where })
}

export async function softRemoveById<T extends ObjectLiteral>(
  repo: Repository<T>,
  idKey: string,
  id: string
) {
  const ent = await repo.findOne({
    where: { [idKey]: id, eliminado_en: IsNull() } as any
  })
  if (!ent) return null
  ;(ent as any).eliminado_en = new Date()
  return repo.save(ent)
}
