import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../db/data-source'
import { guardAdmin, guardAuth } from '../middlewares/auth'

const router = Router()

const CATALOGS: Record<string, { table: string, id: string }> = {
  medios: { table: 'medios', id: 'medio_uuid' },
  instituciones: { table: 'instituciones', id: 'institucion_uuid' },
  tipos_incendio: { table: 'tipos_incendio', id: 'tipo_incendio_id' },
  tipo_propiedad: { table: 'tipo_propiedad', id: 'tipo_propiedad_id' },
  causas_catalogo: { table: 'causas_catalogo', id: 'causa_id' },
  iniciado_junto_a_catalogo: { table: 'iniciado_junto_a_catalogo', id: 'iniciado_id' },
  medios_aereos_catalogo: { table: 'medios_aereos_catalogo', id: 'medio_aereo_id' },
  medios_terrestres_catalogo: { table: 'medios_terrestres_catalogo', id: 'medio_terrestre_id' },
  medios_acuaticos_catalogo: { table: 'medios_acuaticos_catalogo', id: 'medio_acuatico_id' },
  abastos_catalogo: { table: 'abastos_catalogo', id: 'abasto_id' },
  tecnicas_extincion_catalogo: { table: 'tecnicas_extincion_catalogo', id: 'tecnica_id' },
  roles: { table: 'roles', id: 'rol_uuid' },
}

function resolveCatalog(nombre: string) {
  const cfg = CATALOGS[nombre]
  if (!cfg) throw Object.assign(new Error('CATALOG_NOT_FOUND'), { status: 404 })
  return cfg
}

const createSchema = z.object({ nombre: z.string().min(1) })
const updateSchema = z.object({ nombre: z.string().min(1) })
const createRoleSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().optional().nullable(),
})
const updateRoleSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().optional().nullable(),
})

router.get('/', guardAuth, async (_req, res) => {
  res.json({ items: Object.keys(CATALOGS) })
})

router.get('/:catalogo', guardAuth, async (req, res, next) => {
  try {
    const catalogo = String(req.params.catalogo)
    const { table, id } = resolveCatalog(catalogo)
    const q = String(req.query.q || '').trim()
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '50'), 10) || 50, 1), 200)

    const totalRows = await AppDataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM ${table}
       WHERE eliminado_en IS NULL
         AND ($1 = '' OR nombre ILIKE '%' || $1 || '%')`,
      [q]
    )
    const total = totalRows?.[0]?.total ?? 0

    const selectCols =
      catalogo === 'roles'
        ? `${id} AS id, nombre, descripcion, creado_en, actualizado_en`
        : `${id} AS id, nombre, creado_en, actualizado_en`

    const items = await AppDataSource.query(
      `SELECT ${selectCols}
       FROM ${table}
       WHERE eliminado_en IS NULL
         AND ($1 = '' OR nombre ILIKE '%' || $1 || '%')
       ORDER BY nombre ASC
       LIMIT $2 OFFSET $3`,
      [q, pageSize, (page - 1) * pageSize]
    )

    res.json({ total, page, pageSize, items })
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ code: e.message })
    next(e)
  }
})

router.get('/:catalogo/:id', guardAuth, async (req, res, next) => {
  try {
    const catalogo = String(req.params.catalogo)
    const { table, id: idCol } = resolveCatalog(catalogo)
    const id = String(req.params.id)

    const selectCols =
      catalogo === 'roles'
        ? `${idCol} AS id, nombre, descripcion, creado_en, actualizado_en`
        : `${idCol} AS id, nombre, creado_en, actualizado_en`

    const rows = await AppDataSource.query(
      `SELECT ${selectCols}
       FROM ${table}
       WHERE ${idCol} = $1 AND eliminado_en IS NULL`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json(rows[0])
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ code: e.message })
    next(e)
  }
})

router.post('/:catalogo', guardAdmin, async (req, res, next) => {
  try {
    const catalogo = String(req.params.catalogo)
    const { table, id } = resolveCatalog(catalogo)

    if (catalogo === 'roles') {
      const { nombre, descripcion } = createRoleSchema.parse(req.body)
      const rows = await AppDataSource.query(
        `INSERT INTO ${table} (nombre, descripcion)
         VALUES ($1, $2)
         ON CONFLICT (nombre) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           descripcion = EXCLUDED.descripcion,
           actualizado_en = now()
         RETURNING ${id} AS id, nombre, descripcion, creado_en, actualizado_en`,
        [nombre, descripcion ?? null]
      )
      return res.status(201).json(rows[0])
    }

    const { nombre } = createSchema.parse(req.body)
    const rows = await AppDataSource.query(
      `INSERT INTO ${table} (nombre)
       VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         actualizado_en = now()
       RETURNING ${id} AS id, nombre, creado_en, actualizado_en`,
      [nombre]
    )
    res.status(201).json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    if (e?.status) return res.status(e.status).json({ code: e.message })
    next(e)
  }
})

router.patch('/:catalogo/:id', guardAdmin, async (req, res, next) => {
  try {
    const catalogo = String(req.params.catalogo)
    const { table, id: idCol } = resolveCatalog(catalogo)
    const id = String(req.params.id)

    if (catalogo === 'roles') {
      const body = updateRoleSchema.parse(req.body)
      const sets: string[] = []
      const values: any[] = []
      let i = 1

      if (typeof body.nombre === 'string') { sets.push(`nombre = $${i++}`); values.push(body.nombre) }
      if (typeof body.descripcion !== 'undefined') { sets.push(`descripcion = $${i++}`); values.push(body.descripcion) }
      sets.push(`actualizado_en = now()`)

      if (values.length === 0) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Nada para actualizar' })

      const rows = await AppDataSource.query(
        `UPDATE ${table}
         SET ${sets.join(', ')}
         WHERE ${idCol} = $${i} AND eliminado_en IS NULL
         RETURNING ${idCol} AS id, nombre, descripcion, creado_en, actualizado_en`,
        [...values, id]
      )
      if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
      return res.json(rows[0])
    }

    const { nombre } = updateSchema.parse(req.body)
    const rows = await AppDataSource.query(
      `UPDATE ${table}
       SET nombre = $1, actualizado_en = now()
       WHERE ${idCol} = $2 AND eliminado_en IS NULL
       RETURNING ${idCol} AS id, nombre, creado_en, actualizado_en`,
      [nombre, id]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    if (e?.status) return res.status(e.status).json({ code: e.message })
    next(e)
  }
})

router.delete('/:catalogo/:id', guardAdmin, async (req, res, next) => {
  try {
    const { table, id: idCol } = resolveCatalog(String(req.params.catalogo))
    const id = String(req.params.id)

    const rows = await AppDataSource.query(
      `UPDATE ${table}
       SET eliminado_en = now()
       WHERE ${idCol} = $1 AND eliminado_en IS NULL
       RETURNING ${idCol} AS id`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json({ ok: true })
  } catch (e: any) {
    if (e?.status) return res.status(e.status).json({ code: e.message })
    next(e)
  }
})

export default router
