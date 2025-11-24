// src/modules/catalogos/departamentos.routes.ts
import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../../db/data-source'
import { guardAdmin, guardAuth } from '../../../middlewares/auth'

const router = Router()

// ---------- Schemas ----------
const createDeptoSchema = z.object({
  nombre: z.string().min(1).trim(),
})
const updateDeptoSchema = z.object({
  nombre: z.string().min(1).trim(),
})

const createMuniSchema = z.object({
  nombre: z.string().min(1).trim(),
})
const updateMuniSchema = z.object({
  nombre: z.string().min(1).trim(),
})

// ---------- Helpers ----------
function parsePaging(qs: any, defSize = 50, maxSize = 200) {
  const page = Math.max(parseInt(String(qs.page || '1'), 10) || 1, 1)
  const pageSize = Math.min(Math.max(parseInt(String(qs.pageSize || String(defSize)), 10) || defSize, 1), maxSize)
  const offset = (page - 1) * pageSize
  return { page, pageSize, offset }
}

async function ensureDeptoExists(id: string) {
  const rows = await AppDataSource.query(
    `SELECT departamento_uuid FROM departamentos WHERE departamento_uuid = $1 AND eliminado_en IS NULL`,
    [id]
  )
  return !!rows.length
}

// =======================================================
// ================   DEPARTAMENTOS   ====================
// =======================================================

// GET /departamentos  (listar; ?q=&page=&pageSize=&withMunicipios=1)
router.get('/', guardAuth, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    const withMunicipios = String(req.query.withMunicipios || '') === '1'
    const { page, pageSize, offset } = parsePaging(req.query)

    // total
    const totalRows = await AppDataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM departamentos
       WHERE eliminado_en IS NULL
         AND ($1 = '' OR nombre ILIKE '%' || $1 || '%')`,
      [q]
    )
    const total = totalRows?.[0]?.total ?? 0

    // page
    const departamentos = await AppDataSource.query(
      `SELECT departamento_uuid AS id, nombre, creado_en, actualizado_en
       FROM departamentos
       WHERE eliminado_en IS NULL
         AND ($1 = '' OR nombre ILIKE '%' || $1 || '%')
       ORDER BY nombre ASC
       LIMIT $2 OFFSET $3`,
      [q, pageSize, offset]
    )

    if (!withMunicipios || !departamentos.length) {
      return res.json({ total, page, pageSize, items: departamentos })
    }

    // cargar municipios por lote
    const ids = departamentos.map((d: any) => d.id)
    const munis = await AppDataSource.query(
      `SELECT municipio_uuid AS id, departamento_uuid AS depto_id, nombre, creado_en, actualizado_en
       FROM municipios
       WHERE eliminado_en IS NULL
         AND departamento_uuid = ANY($1)
       ORDER BY nombre ASC`,
      [ids]
    )

    const muniByDept: Record<string, any[]> = {}
    for (const m of munis) {
      if (!muniByDept[m.depto_id]) muniByDept[m.depto_id] = []
      muniByDept[m.depto_id].push({ id: m.id, nombre: m.nombre, creado_en: m.creado_en, actualizado_en: m.actualizado_en })
    }

    const items = departamentos.map((d: any) => ({
      ...d,
      municipios: muniByDept[d.id] ?? []
    }))

    res.json({ total, page, pageSize, items })
  } catch (e) { next(e) }
})

// GET /departamentos/:id  (?withMunicipios=1)
router.get('/:id', guardAuth, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const withMunicipios = String(req.query.withMunicipios || '') === '1'

    const rows = await AppDataSource.query(
      `SELECT departamento_uuid AS id, nombre, creado_en, actualizado_en
       FROM departamentos
       WHERE departamento_uuid = $1 AND eliminado_en IS NULL`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    const depto = rows[0]

    if (!withMunicipios) return res.json(depto)

    const municipios = await AppDataSource.query(
      `SELECT municipio_uuid AS id, nombre, creado_en, actualizado_en
       FROM municipios
       WHERE eliminado_en IS NULL AND departamento_uuid = $1
       ORDER BY nombre ASC`,
      [id]
    )

    res.json({ ...depto, municipios })
  } catch (e) { next(e) }
})

// POST /departamentos  (admin)  — upsert por nombre + undelete
router.post('/', guardAdmin, async (req, res, next) => {
  try {
    const { nombre } = createDeptoSchema.parse(req.body)

    // Nota: unique(nombre) ya existe en entidad
    const rows = await AppDataSource.query(
      `INSERT INTO departamentos (nombre, eliminado_en)
       VALUES ($1, NULL)
       ON CONFLICT (nombre) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         eliminado_en = NULL,       -- undelete si estaba borrado
         actualizado_en = now()
       RETURNING departamento_uuid AS id, nombre, creado_en, actualizado_en`,
      [nombre]
    )
    res.status(201).json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// PATCH /departamentos/:id  (admin)
router.patch('/:id', guardAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const { nombre } = updateDeptoSchema.parse(req.body)

    const rows = await AppDataSource.query(
      `UPDATE departamentos
       SET nombre = $1, actualizado_en = now()
       WHERE departamento_uuid = $2 AND eliminado_en IS NULL
       RETURNING departamento_uuid AS id, nombre, creado_en, actualizado_en`,
      [nombre, id]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// DELETE /departamentos/:id  (admin, soft)
router.delete('/:id', guardAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id)
    const rows = await AppDataSource.query(
      `UPDATE departamentos
       SET eliminado_en = now()
       WHERE departamento_uuid = $1 AND eliminado_en IS NULL
       RETURNING departamento_uuid AS id`,
      [id]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

// =======================================================
// ==================   MUNICIPIOS   =====================
// =======================================================

// GET /departamentos/:id/municipios  (listar por depto; ?q=&page=&pageSize=)
router.get('/:id/municipios', guardAuth, async (req, res, next) => {
  try {
    const deptoId = String(req.params.id)
    if (!(await ensureDeptoExists(deptoId))) return res.status(404).json({ code: 'NOT_FOUND_DEPARTAMENTO' })

    const q = String(req.query.q || '').trim()
    const { page, pageSize, offset } = parsePaging(req.query)

    const totalRows = await AppDataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM municipios
       WHERE eliminado_en IS NULL
         AND departamento_uuid = $1
         AND ($2 = '' OR nombre ILIKE '%' || $2 || '%')`,
      [deptoId, q]
    )
    const total = totalRows?.[0]?.total ?? 0

    const items = await AppDataSource.query(
      `SELECT municipio_uuid AS id, nombre, creado_en, actualizado_en
       FROM municipios
       WHERE eliminado_en IS NULL
         AND departamento_uuid = $1
         AND ($2 = '' OR nombre ILIKE '%' || $2 || '%')
       ORDER BY nombre ASC
       LIMIT $3 OFFSET $4`,
      [deptoId, q, pageSize, offset]
    )

    res.json({ total, page, pageSize, items })
  } catch (e) { next(e) }
})

// POST /departamentos/:id/municipios  (admin) — upsert (departamento, nombre) + undelete
router.post('/:id/municipios', guardAdmin, async (req, res, next) => {
  try {
    const deptoId = String(req.params.id)
    if (!(await ensureDeptoExists(deptoId))) return res.status(404).json({ code: 'NOT_FOUND_DEPARTAMENTO' })

    const { nombre } = createMuniSchema.parse(req.body)

    // Índice único compuesto existe por entidad: uq_municipios_depto_nombre (departamento, nombre)
    const rows = await AppDataSource.query(
      `INSERT INTO municipios (departamento_uuid, nombre, eliminado_en)
       VALUES ($1, $2, NULL)
       ON CONFLICT (departamento_uuid, nombre) DO UPDATE SET
         nombre = EXCLUDED.nombre,
         eliminado_en = NULL,
         actualizado_en = now()
       RETURNING municipio_uuid AS id, nombre, creado_en, actualizado_en`,
      [deptoId, nombre]
    )
    res.status(201).json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// PATCH /departamentos/:id/municipios/:muniId  (admin)
router.patch('/:id/municipios/:muniId', guardAdmin, async (req, res, next) => {
  try {
    const deptoId = String(req.params.id)
    const muniId = String(req.params.muniId)
    if (!(await ensureDeptoExists(deptoId))) return res.status(404).json({ code: 'NOT_FOUND_DEPARTAMENTO' })

    const { nombre } = updateMuniSchema.parse(req.body)

    const rows = await AppDataSource.query(
      `UPDATE municipios
       SET nombre = $1, actualizado_en = now()
       WHERE municipio_uuid = $2
         AND departamento_uuid = $3
         AND eliminado_en IS NULL
       RETURNING municipio_uuid AS id, nombre, creado_en, actualizado_en`,
      [nombre, muniId, deptoId]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json(rows[0])
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// DELETE /departamentos/:id/municipios/:muniId  (admin, soft)
router.delete('/:id/municipios/:muniId', guardAdmin, async (req, res, next) => {
  try {
    const deptoId = String(req.params.id)
    const muniId = String(req.params.muniId)

    const rows = await AppDataSource.query(
      `UPDATE municipios
       SET eliminado_en = now()
       WHERE municipio_uuid = $1
         AND departamento_uuid = $2
         AND eliminado_en IS NULL
       RETURNING municipio_uuid AS id`,
      [muniId, deptoId]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
