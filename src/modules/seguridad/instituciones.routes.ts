import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../db/data-source'
import { guardAdmin, guardAuth } from '../../middlewares/auth'

const router = Router()

const createSchema = z.object({
  nombre: z.string().min(1),
})

const updateSchema = z.object({
  nombre: z.string().min(1),
})

// GET /instituciones — listar (auth)
router.get('/', guardAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '50'), 10) || 50, 1), 200)

    const totalRows = await AppDataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM instituciones
       WHERE eliminado_en IS NULL
         AND ($1 = '' OR nombre ILIKE '%' || $1 || '%')`,
      [q]
    )
    const total = totalRows?.[0]?.total ?? 0

    const items = await AppDataSource.query(
      `SELECT institucion_uuid AS id, nombre, creado_en, actualizado_en
       FROM instituciones
       WHERE eliminado_en IS NULL
         AND ($1 = '' OR nombre ILIKE '%' || $1 || '%')
       ORDER BY nombre ASC
       LIMIT $2 OFFSET $3`,
      [q, pageSize, (page - 1) * pageSize]
    )

    res.json({ total, page, pageSize, items })
  } catch (e) { next(e) }
})

// POST /instituciones — crear (admin)
router.post('/', guardAdmin, async (req, res, next) => {
  try {
    const { nombre } = createSchema.parse(req.body)

    const rows = await AppDataSource.query(
      `INSERT INTO instituciones (nombre)
       VALUES ($1)
       ON CONFLICT (nombre) DO UPDATE SET nombre = EXCLUDED.nombre
       RETURNING institucion_uuid AS id, nombre, creado_en, actualizado_en`,
      [nombre]
    )

    res.status(201).json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// PATCH /instituciones/:id — actualizar (admin)
router.patch('/:id', guardAdmin, async (req, res, next) => {
  try {
    const { nombre } = updateSchema.parse(req.body)
    const id = String(req.params.id)

    const rows = await AppDataSource.query(
      `UPDATE instituciones
         SET nombre = $1,
             actualizado_en = now()
       WHERE institucion_uuid = $2 AND eliminado_en IS NULL
       RETURNING institucion_uuid AS id, nombre, creado_en, actualizado_en`,
      [nombre, id]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// DELETE /instituciones/:id — soft delete (admin)
router.delete('/:id', guardAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)

    const rows = await AppDataSource.query(
      `UPDATE instituciones
         SET eliminado_en = now()
       WHERE institucion_uuid = $1 AND eliminado_en IS NULL
       RETURNING institucion_uuid AS id`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
