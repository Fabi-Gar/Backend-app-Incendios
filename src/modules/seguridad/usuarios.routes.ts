// src/modules/seguridad/usuarios.routes.ts
import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../db/data-source'
import { guardAdmin, guardAuth } from '../../middlewares/auth'
import { Usuario } from './entities/usuario.entity'
import { IsNull } from 'typeorm'
import { hashPassword } from '../../utils/password'

const router = Router()

// ---------- Schemas ----------
const createUserSchema = z.object({
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  telefono: z.string().optional().nullable(),
  email: z.string().email(),
  password: z.string().min(6),
  rol_uuid: z.string().uuid(),
  institucion_uuid: z.string().uuid().optional().nullable(),
  is_admin: z.boolean().optional().default(false),
})

const updateUserSchema = z.object({
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  telefono: z.string().optional().nullable(),
  email: z.string().email().optional(),
  new_password: z.string().min(6).optional(),
  rol_uuid: z.string().uuid().optional(),
  institucion_uuid: z.string().uuid().optional().nullable(),
  is_admin: z.boolean().optional(),
})

// ---------- Helpers ----------
function stripSensitive(user: any) {
  if (!user) return user
  const { password_hash, ...safe } = user
  return safe
}

// ---------- Rutas ----------

// LISTAR usuarios (ADMIN) - GET /usuarios
router.get('/', guardAdmin, async (req, res, next) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '20'), 10) || 20, 1), 100)

    const [items, total] = await AppDataSource.getRepository(Usuario).findAndCount({
      where: { eliminado_en: IsNull() },
      relations: ['rol', 'institucion'],
      order: { creado_en: 'DESC' },
      take: pageSize,
      skip: (page - 1) * pageSize,
    })

    res.json({
      total,
      page,
      pageSize,
      items: items.map(stripSensitive),
    })
  } catch (e) { next(e) }
})

// CREAR usuario (ADMIN) - POST /usuarios
router.post('/', guardAdmin, async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body)
    const repo = AppDataSource.getRepository(Usuario)

    const exists = await repo.findOne({ where: { email: body.email, eliminado_en: IsNull() } })
    if (exists) return res.status(409).json({ code: 'EMAIL_IN_USE', message: 'El email ya está registrado' })

    const password_hash = await hashPassword(body.password)

    const user = repo.create({
      nombre: body.nombre,
      apellido: body.apellido,
      telefono: body.telefono || null,
      email: body.email,
      password_hash,
      rol: { rol_uuid: body.rol_uuid } as any,
      institucion: body.institucion_uuid ? ({ institucion_uuid: body.institucion_uuid } as any) : null,
      is_admin: !!body.is_admin,
    })

    await repo.save(user)
    res.status(201).json(stripSensitive(user))
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// MI PERFIL - GET /usuarios/me
router.get('/me', guardAuth, async (_req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(Usuario)
    const me = await repo.findOne({
      where: { usuario_uuid: res.locals.ctx.user.usuario_uuid, eliminado_en: IsNull() },
      relations: ['rol', 'institucion'],
    })
    if (!me) return res.status(404).json({ code: 'NOT_FOUND' })
    res.json(stripSensitive(me))
  } catch (e) { next(e) }
})

// ACTUALIZAR usuario - PATCH /usuarios/:id
//  - Admin puede modificar cualquier usuario
//  - Usuario normal solo puede modificarse a sí mismo (algunos campos)
router.patch('/:id', guardAuth, async (req, res, next) => {
  try {
    const { id } = req.params
    const body = updateUserSchema.parse(req.body)

    const isSelf = res.locals.ctx.user?.usuario_uuid === id
    const isAdmin = !!res.locals.ctx.user?.is_admin
    if (!isAdmin && !isSelf) {
      return res.status(403).json({ code: 'PERMISSION_DENIED' })
    }

    const repo = AppDataSource.getRepository(Usuario)
    const user = await repo.findOne({ where: { usuario_uuid: id, eliminado_en: IsNull() } })
    if (!user) return res.status(404).json({ code: 'NOT_FOUND' })

    if (body.email) {
      const emailUsed = await repo.findOne({ where: { email: body.email, eliminado_en: IsNull() } })
      if (emailUsed && emailUsed.usuario_uuid !== user.usuario_uuid) {
        return res.status(409).json({ code: 'EMAIL_IN_USE' })
      }
      user.email = body.email
    }

    if (body.nombre) user.nombre = body.nombre
    if (body.apellido) user.apellido = body.apellido
    user.telefono = body.telefono ?? user.telefono

    if (typeof body.is_admin === 'boolean' && isAdmin) {
      user.is_admin = body.is_admin
    }
    if (body.rol_uuid && isAdmin) {
      ;(user as any).rol = { rol_uuid: body.rol_uuid }
    }
    if (typeof body.institucion_uuid !== 'undefined') {
      ;(user as any).institucion = body.institucion_uuid ? ({ institucion_uuid: body.institucion_uuid } as any) : null
    }

    if (body.new_password) {
      user.password_hash = await hashPassword(body.new_password)
    }

    await repo.save(user)
    res.json(stripSensitive(user))
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})

// ELIMINAR usuario (soft delete) - DELETE /usuarios/:id (ADMIN)
router.delete('/:id', guardAdmin, async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(Usuario)
    const user = await repo.findOne({ where: { usuario_uuid: req.params.id, eliminado_en: IsNull() } })
    if (!user) return res.status(404).json({ code: 'NOT_FOUND' })
    user.eliminado_en = new Date()
    await repo.save(user)
    res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router
