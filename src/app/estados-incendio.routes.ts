import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../db/data-source'
import { guardAuth, guardAdmin } from '../middlewares/auth'

const router = Router()

const createSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  orden: z.number().int().nonnegative(),
})

const updateSchema = z.object({
  codigo: z.string().min(1).optional(),
  nombre: z.string().min(1).optional(),
  orden: z.number().int().nonnegative().optional(),
})

// -------------------- LISTAR --------------------
router.get('/estados_incendio', guardAuth, async (_req, res, next) => {
  try {
    const estados = await AppDataSource.query(`
      SELECT estado_incendio_uuid AS id, codigo, nombre, orden, creado_en, actualizado_en
      FROM estado_incendio
      WHERE eliminado_en IS NULL
      ORDER BY orden ASC
    `)
    res.json({ total: estados.length, items: estados })
  } catch (e) { next(e) }
})

// -------------------- CREAR (ADMIN) --------------------
router.post('/estados_incendio', guardAdmin, async (req, res, next) => {
  try {
    const { codigo, nombre, orden } = createSchema.parse(req.body)
    const rows = await AppDataSource.query(`
      INSERT INTO estado_incendio (codigo, nombre, orden)
      VALUES ($1, $2, $3)
      ON CONFLICT (codigo) DO UPDATE SET nombre = EXCLUDED.nombre, orden = EXCLUDED.orden
      RETURNING estado_incendio_uuid AS id, codigo, nombre, orden
    `, [codigo, nombre, orden])
    res.status(201).json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// -------------------- ACTUALIZAR (ADMIN) --------------------
router.patch('/estados_incendio/:id', guardAdmin, async (req, res, next) => {
  try {
    const { codigo, nombre, orden } = updateSchema.parse(req.body)
    const id = String(req.params.id)
    const rows = await AppDataSource.query(`
      UPDATE estado_incendio
      SET codigo = COALESCE($1, codigo),
          nombre = COALESCE($2, nombre),
          orden  = COALESCE($3, orden),
          actualizado_en = now()
      WHERE estado_incendio_uuid = $4 AND eliminado_en IS NULL
      RETURNING estado_incendio_uuid AS id, codigo, nombre, orden
    `, [codigo ?? null, nombre ?? null, orden ?? null, id])
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// -------------------- ELIMINAR (ADMIN, soft delete) --------------------
router.delete('/estados_incendio/:id', guardAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const rows = await AppDataSource.query(`
      UPDATE estado_incendio
      SET eliminado_en = now()
      WHERE estado_incendio_uuid = $1 AND eliminado_en IS NULL
      RETURNING estado_incendio_uuid AS id
    `, [id])
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
