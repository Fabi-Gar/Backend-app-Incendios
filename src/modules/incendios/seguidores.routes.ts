// src/modules/incendios/seguidores.routes.ts
import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../db/data-source'
import { guardAuth } from '../../middlewares/auth'
import { Usuario } from '../seguridad/entities/usuario.entity'

const router = Router()

router.get('/mis-seguidos', guardAuth, async (req, res, next) => {
  try {
    const user = res.locals.ctx.user as Usuario

    if (!user || !user.usuario_uuid) {
      return res.status(401).json({ 
        ok: false, 
        error: 'Usuario no autenticado' 
      })
    }

    const incendios = await AppDataSource.query(
      `SELECT 
        s.incendio_uuid,
        s.creado_en as seguido_desde,
        i.titulo,
        i.descripcion,
        i.aprobado,
        i.creado_en as incendio_creado_en,
        i.actualizado_en as incendio_actualizado_en
       FROM incendio_seguidores s
       INNER JOIN incendios i ON i.incendio_uuid = s.incendio_uuid 
       WHERE s.usuario_uuid = $1 
         AND s.eliminado_en IS NULL
         AND i.eliminado_en IS NULL
       ORDER BY s.creado_en DESC`,
      [user.usuario_uuid]
    )

    console.log('[mis-seguidos] Encontrados:', incendios.length)

    res.json({ 
      ok: true, 
      total: incendios.length,
      incendios 
    })
  } catch (err) { 
    console.error('[mis-seguidos] Error completo:', err)
    next(err) 
  }
})

// Seguir un incendio
router.post('/:incendio_uuid/seguir', guardAuth, async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.params)
    const user = res.locals.ctx.user as Usuario

    // Verificar que el incendio existe
    const incendio = await AppDataSource.query(
      `SELECT incendio_uuid FROM incendios WHERE incendio_uuid = $1 AND eliminado_en IS NULL`,
      [incendio_uuid]
    )
    if (!incendio.length) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incendio no existe' } })
    }

    // Agregar como seguidor
    await AppDataSource.query(
      `INSERT INTO incendio_seguidores (incendio_uuid, usuario_uuid, eliminado_en)
       VALUES ($1, $2, NULL)
       ON CONFLICT (incendio_uuid, usuario_uuid) DO UPDATE SET eliminado_en = NULL`,
      [incendio_uuid, user.usuario_uuid]
    )

    res.json({ ok: true, siguiendo: true })
  } catch (err) { next(err) }
})

// Dejar de seguir un incendio
router.delete('/:incendio_uuid/seguir', guardAuth, async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.params)
    const user = res.locals.ctx.user as Usuario

    await AppDataSource.query(
      `UPDATE incendio_seguidores 
       SET eliminado_en = NOW()
       WHERE incendio_uuid = $1 AND usuario_uuid = $2`,
      [incendio_uuid, user.usuario_uuid]
    )

    res.json({ ok: true, siguiendo: false })
  } catch (err) { next(err) }
})

// Ver si sigo un incendio
router.get('/:incendio_uuid/siguiendo', guardAuth, async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.params)
    const user = res.locals.ctx.user as Usuario

    const result = await AppDataSource.query(
      `SELECT 1 FROM incendio_seguidores 
       WHERE incendio_uuid = $1 AND usuario_uuid = $2 AND eliminado_en IS NULL`,
      [incendio_uuid, user.usuario_uuid]
    )

    res.json({ ok: true, siguiendo: !!result.length })
  } catch (err) { next(err) }
})

// Ver seguidores de un incendio (solo admins)
router.get('/:incendio_uuid/seguidores', guardAuth, async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.params)
    const user = res.locals.ctx.user as Usuario

    if (!user.is_admin) {
      return res.status(403).json({ error: { code: 'PERMISSION_DENIED' } })
    }

    const seguidores = await AppDataSource.query(
      `SELECT u.usuario_uuid, u.nombre, u.apellido, u.email
       FROM incendio_seguidores s
       JOIN usuarios u ON u.usuario_uuid = s.usuario_uuid
       WHERE s.incendio_uuid = $1 AND s.eliminado_en IS NULL`,
      [incendio_uuid]
    )

    res.json({ ok: true, seguidores })
  } catch (err) { next(err) }
})

export default router