import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../db/data-source'
import { guardAdmin, guardAuth } from '../../middlewares/auth'

const router = Router()

const createSchema = z.object({
  nombre: z.string().min(1),
  descripcion: z.string().nullish(),
})

const updateSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().nullish().optional(),
})

// GET /roles — listar (auth)
router.get('/', guardAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '50'), 10) || 50, 1), 200)

    const countRows = await AppDataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM roles
       WHERE eliminado_en IS NULL
         AND ($1 = '' OR nombre ILIKE '%' || $1 || '%')`,
      [q]
    )
    const total = countRows?.[0]?.total ?? 0

    const items = await AppDataSource.query(
      `SELECT rol_uuid AS id, nombre, descripcion, creado_en, actualizado_en
       FROM roles
       WHERE eliminado_en IS NULL
         AND ($1 = '' OR nombre ILIKE '%' || $1 || '%')
       ORDER BY nombre ASC
       LIMIT $2 OFFSET $3`,
      [q, pageSize, (page - 1) * pageSize]
    )

    res.json({ total, page, pageSize, items })
  } catch (e) { next(e) }
})

// POST /roles — crear (admin)
router.post('/', guardAdmin, async (req, res, next) => {
  try {
    const { nombre, descripcion } = createSchema.parse(req.body)
    const rows = await AppDataSource.query(
      `INSERT INTO roles (nombre, descripcion)
       VALUES ($1, $2)
       ON CONFLICT (nombre) DO UPDATE SET descripcion = EXCLUDED.descripcion
       RETURNING rol_uuid AS id, nombre, descripcion, creado_en, actualizado_en`,
      [nombre, descripcion ?? null]
    )
    res.status(201).json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// PATCH /roles/:id — actualizar (admin)
router.patch('/:id', guardAdmin, async (req, res, next) => {
  try {
    const { nombre, descripcion } = updateSchema.parse(req.body)
    const id = String(req.params.id)

    const rows = await AppDataSource.query(
      `UPDATE roles
       SET nombre = COALESCE($1, nombre),
           descripcion = COALESCE($2, descripcion),
           actualizado_en = now()
       WHERE rol_uuid = $3 AND eliminado_en IS NULL
       RETURNING rol_uuid AS id, nombre, descripcion, creado_en, actualizado_en`,
      [nombre ?? null, descripcion ?? null, id]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// DELETE /roles/:id — soft delete (admin)
router.delete('/:id', guardAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const rows = await AppDataSource.query(
      `UPDATE roles
       SET eliminado_en = now()
       WHERE rol_uuid = $1 AND eliminado_en IS NULL
       RETURNING rol_uuid AS id`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
