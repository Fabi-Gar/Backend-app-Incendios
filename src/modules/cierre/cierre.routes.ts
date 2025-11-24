// src/modules/cierre/cierre.routes.ts
import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../db/data-source'
import { guardAuth, guardAdmin } from '../../middlewares/auth'
import { auditRecord } from '../auditoria/auditoria.service'
import { notifyIncendioCerrado } from '../notificaciones/incendioNotify.service'
import { notifyCierreEvento } from '../notificaciones/cierreNotify.service'
import { Notificacion } from '../notificaciones/entities/notificacion.entity'
import { getSubscribedUsers } from '../incendios/GetsuscribedUsers'

const router = Router()
// ================== UTIL: validadores simples ==================
const patchCantidad = z.object({ cantidad: z.number().min(0) })
const patchPct      = z.object({ pct: z.number().min(0) })
const patchUsado    = z.object({ usado: z.boolean() })

// ================== SUPERFICIE_VEGETACION ==================
const patchSupVegSchema = z.object({
  subtipo: z.string().nullable().optional(),
  area_ha: z.number().min(0).optional(),
  ubicacion: z.enum(['DENTRO_AP','FUERA_AP']).optional(),
  categoria: z.enum(['bosque_natural','plantacion_forestal','otra_vegetacion']).optional()
})

// ----------------- helpers -----------------
type CtxUser = { usuario_uuid?: string; is_admin?: boolean }

async function getIncendioBasic(uuid: string) {
  const rows = await AppDataSource.query(
    `SELECT incendio_uuid, creado_por_uuid FROM incendios
     WHERE incendio_uuid = $1 AND eliminado_en IS NULL`,
    [uuid]
  )
  return rows?.[0] || null
}

function estadoDesdeSecuencia(sc?: {
  llegada_medios_terrestres_at?: string | Date | null
  llegada_medios_aereos_at?: string | Date | null
  controlado_at?: string | Date | null
  extinguido_at?: string | Date | null
}) {
  if (!sc) return 'Pendiente'
  if (sc.extinguido_at) return 'Extinguido'
  if (sc.controlado_at) return 'Controlado'
  if (sc.llegada_medios_terrestres_at || sc.llegada_medios_aereos_at) return 'En atención'
  return 'Pendiente'
}


async function isClosed(incendio_uuid: string) {
  const r = await AppDataSource.query(
    `SELECT extinguido_at FROM cierre_secuencia_control
     WHERE incendio_uuid = $1 AND eliminado_en IS NULL`,
    [incendio_uuid]
  )
  return !!(r?.[0]?.extinguido_at)
}

function canEdit(user: CtxUser, creador_uuid: string, closed: boolean) {
  if (closed) return !!user?.is_admin
  return !!(user?.is_admin || user?.usuario_uuid === creador_uuid)
}

async function ensureBaseRecords(incendio_uuid: string) {
  await AppDataSource.query(
    `INSERT INTO cierre_operaciones (incendio_uuid)
     VALUES ($1)
     ON CONFLICT (incendio_uuid) DO NOTHING`,
    [incendio_uuid]
  )
  await AppDataSource.query(
    `INSERT INTO cierre_topografia (incendio_uuid, plano_pct, ondulado_pct, quebrado_pct)
     VALUES ($1,'0','0','0')
     ON CONFLICT (incendio_uuid) DO NOTHING`,
    [incendio_uuid]
  )
  await AppDataSource.query(
    `INSERT INTO cierre_superficie (incendio_uuid, area_total_ha, dentro_ap_ha, fuera_ap_ha)
     VALUES ($1,'0','0','0')
     ON CONFLICT (incendio_uuid) DO NOTHING`,
    [incendio_uuid]
  )
  await AppDataSource.query(
    `INSERT INTO cierre_secuencia_control (incendio_uuid)
     VALUES ($1)
     ON CONFLICT (incendio_uuid) DO NOTHING`,
    [incendio_uuid]
  )
  await AppDataSource.query(
    `INSERT INTO cierre_meteorologia (incendio_uuid)
     VALUES ($1)
     ON CONFLICT (incendio_uuid) DO NOTHING`,
    [incendio_uuid]
  )
}

// ----------------- zod schemas -----------------
const payloadSchema = z.object({
  tipo_incendio_principal_id: z.string().optional(),
  composicion_tipo: z.array(z.object({ tipo_incendio_id: z.string(), pct: z.number().min(0) })).optional(),
  topografia: z.object({
    plano_pct: z.number().min(0).optional(),
    ondulado_pct: z.number().min(0).optional(),
    quebrado_pct: z.number().min(0).optional()
  }).optional(),
  propiedad: z.array(z.object({ tipo_propiedad_id: z.string(), usado: z.boolean().optional().default(true) })).optional(),
  iniciado_junto_a: z.object({ iniciado_id: z.string(), otro_texto: z.string().optional().nullable() }).optional(),
  secuencia_control: z.object({
    llegada_medios_terrestres_at: z.coerce.date().nullable().optional(),
    llegada_medios_aereos_at: z.coerce.date().nullable().optional(),
    controlado_at: z.coerce.date().nullable().optional(),
    extinguido_at: z.coerce.date().nullable().optional()
  }).optional(),
  superficie: z.object({
    area_total_ha: z.number().min(0).optional(),
    dentro_ap_ha: z.number().min(0).optional(),
    fuera_ap_ha: z.number().min(0).optional(),
    nombre_ap: z.string().optional().nullable()
  }).optional(),
  superficie_vegetacion: z.array(z.object({
    ubicacion: z.enum(['DENTRO_AP','FUERA_AP']),
    categoria: z.enum(['bosque_natural','plantacion_forestal','otra_vegetacion']),
    subtipo: z.string().optional().nullable(),
    area_ha: z.number().min(0)
  })).optional(),
  tecnicas: z.array(z.object({
    tecnica: z.enum(['directo','indirecto','control_natural']),
    pct: z.number().min(0)
  })).optional(),
  medios_terrestres: z.array(z.object({ medio_terrestre_id: z.string(), cantidad: z.number().min(0).default(1) })).optional(),
  medios_aereos:    z.array(z.object({ medio_aereo_id: z.string(), pct: z.number().min(0) })).optional(),
  medios_acuaticos: z.array(z.object({ medio_acuatico_id: z.string(), cantidad: z.number().min(0).default(1) })).optional(),
  medios_instituciones: z.array(z.object({ institucion_uuid: z.string().uuid() })).optional(),
  abastos: z.array(z.object({ abasto_id: z.string(), cantidad: z.number().min(0).default(0) })).optional(),
  causa: z.object({ causa_id: z.string(), otro_texto: z.string().optional().nullable() }).optional(),
  meteo: z.object({
    temp_c: z.number().nullable().optional(),
    hr_pct: z.number().nullable().optional(),
    viento_vel: z.number().nullable().optional(),
    viento_dir: z.string().nullable().optional()
  }).optional(),
  nota: z.string().max(500).optional()
})

// ================== PATCH /:incendio_uuid/catalogos ==================
router.patch('/:incendio_uuid/catalogos', guardAuth, async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.params)
    const body = payloadSchema.parse(req.body)
    const inc = await getIncendioBasic(incendio_uuid)
    if (!inc) return res.status(404).json({ code: 'NOT_FOUND' })

    await ensureBaseRecords(incendio_uuid)
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if (!canEdit(user, inc.creado_por_uuid, closed)) {
      return res.status(403).json({ code: closed ? 'CERRADO_SOLO_ADMIN' : 'PERMISSION_DENIED' })
    }

    const who = user?.usuario_uuid ?? null
    const updatesFeed: string[] = []
    const auditAfter: any = {}

    if (body.tipo_incendio_principal_id) {
      await AppDataSource.query(
        `INSERT INTO cierre_operaciones (incendio_uuid, tipo_incendio_principal_id)
         VALUES ($1, $2)
         ON CONFLICT (incendio_uuid) DO UPDATE SET
           tipo_incendio_principal_id = EXCLUDED.tipo_incendio_principal_id,
           actualizado_en = now(),
           eliminado_en = NULL`,
        [incendio_uuid, body.tipo_incendio_principal_id]
      )
      updatesFeed.push('Tipo de incendio principal asignado')
      auditAfter.tipo_incendio_principal_id = body.tipo_incendio_principal_id
    }

    if (body.composicion_tipo) {
      for (const item of body.composicion_tipo) {
        await AppDataSource.query(
          `INSERT INTO cierre_composicion_tipo (incendio_uuid, tipo_incendio_id, pct, eliminado_en)
           VALUES ($1, $2, $3, NULL)
           ON CONFLICT (incendio_uuid, tipo_incendio_id) DO UPDATE SET
             pct = EXCLUDED.pct,
             eliminado_en = NULL,
             actualizado_en = now()`,
          [incendio_uuid, item.tipo_incendio_id, String(item.pct)]
        )
      }
      updatesFeed.push('Composición por tipo de incendio actualizada')
      auditAfter.composicion_tipo = body.composicion_tipo
    }

    if (body.topografia) {
      const t = body.topografia
      await AppDataSource.query(
        `INSERT INTO cierre_topografia (incendio_uuid, plano_pct, ondulado_pct, quebrado_pct, eliminado_en)
         VALUES ($1,$2,$3,$4,NULL)
         ON CONFLICT (incendio_uuid) DO UPDATE SET
           plano_pct = COALESCE($2, cierre_topografia.plano_pct),
           ondulado_pct = COALESCE($3, cierre_topografia.ondulado_pct),
           quebrado_pct = COALESCE($4, cierre_topografia.quebrado_pct),
           eliminado_en = NULL,
           actualizado_en = now()`,
        [incendio_uuid, t.plano_pct ?? null, t.ondulado_pct ?? null, t.quebrado_pct ?? null]
      )
      updatesFeed.push('Topografía actualizada')
      auditAfter.topografia = t
    }

    if (body.propiedad) {
      for (const p of body.propiedad) {
        await AppDataSource.query(
          `INSERT INTO cierre_propiedad (incendio_uuid, tipo_propiedad_id, usado, eliminado_en)
           VALUES ($1,$2,$3,NULL)
           ON CONFLICT (incendio_uuid, tipo_propiedad_id) DO UPDATE SET
             usado = EXCLUDED.usado,
             eliminado_en = NULL,
             actualizado_en = now()`,
          [incendio_uuid, p.tipo_propiedad_id, !!p.usado]
        )
      }
      updatesFeed.push('Tipo(s) de propiedad actualizado(s)')
      auditAfter.propiedad = body.propiedad
    }

    if (body.iniciado_junto_a) {
      const j = body.iniciado_junto_a
      await AppDataSource.query(
        `INSERT INTO cierre_iniciado_junto_a (incendio_uuid, iniciado_id, otro_texto, eliminado_en)
         VALUES ($1,$2,$3,NULL)
         ON CONFLICT (incendio_uuid) DO UPDATE SET
           iniciado_id = COALESCE($2, cierre_iniciado_junto_a.iniciado_id),
           otro_texto  = COALESCE($3, cierre_iniciado_junto_a.otro_texto),
           eliminado_en = NULL,
           actualizado_en = now()`,
        [incendio_uuid, j.iniciado_id, j.otro_texto ?? null]
      )
      updatesFeed.push('“Iniciado junto a” actualizado')
      auditAfter.iniciado_junto_a = j
    }

    if (body.secuencia_control) {
      const sc = body.secuencia_control
      await AppDataSource.query(
        `INSERT INTO cierre_secuencia_control (incendio_uuid, llegada_medios_terrestres_at, llegada_medios_aereos_at, controlado_at, extinguido_at, eliminado_en)
         VALUES ($1,$2,$3,$4,$5,NULL)
         ON CONFLICT (incendio_uuid) DO UPDATE SET
           llegada_medios_terrestres_at = COALESCE($2, cierre_secuencia_control.llegada_medios_terrestres_at),
           llegada_medios_aereos_at     = COALESCE($3, cierre_secuencia_control.llegada_medios_aereos_at),
           controlado_at                = COALESCE($4, cierre_secuencia_control.controlado_at),
           extinguido_at                = COALESCE($5, cierre_secuencia_control.extinguido_at),
           eliminado_en = NULL,
           actualizado_en = now()`,
        [incendio_uuid, sc.llegada_medios_terrestres_at ?? null, sc.llegada_medios_aereos_at ?? null, sc.controlado_at ?? null, sc.extinguido_at ?? null]
      )
      updatesFeed.push('Secuencia de control actualizada')
      auditAfter.secuencia_control = sc
    }

    if (body.superficie) {
      const s = body.superficie
      await AppDataSource.query(
        `INSERT INTO cierre_superficie (incendio_uuid, area_total_ha, dentro_ap_ha, fuera_ap_ha, nombre_ap, eliminado_en)
         VALUES ($1,$2,$3,$4,$5,NULL)
         ON CONFLICT (incendio_uuid) DO UPDATE SET
           area_total_ha = COALESCE($2, cierre_superficie.area_total_ha),
           dentro_ap_ha  = COALESCE($3, cierre_superficie.dentro_ap_ha),
           fuera_ap_ha   = COALESCE($4, cierre_superficie.fuera_ap_ha),
           nombre_ap     = COALESCE($5, cierre_superficie.nombre_ap),
           eliminado_en = NULL,
           actualizado_en = now()`,
        [incendio_uuid, s.area_total_ha ?? null, s.dentro_ap_ha ?? null, s.fuera_ap_ha ?? null, s.nombre_ap ?? null]
      )
      updatesFeed.push('Superficie AP/dentro/fuera actualizada')
      auditAfter.superficie = s
    }

    if (body.superficie_vegetacion) {
      for (const v of body.superficie_vegetacion) {
        await AppDataSource.query(
          `INSERT INTO cierre_superficie_vegetacion (incendio_uuid, ubicacion, categoria, subtipo, area_ha, eliminado_en)
           VALUES ($1,$2,$3,$4,$5,NULL)`,
          [incendio_uuid, v.ubicacion, v.categoria, v.subtipo ?? null, String(v.area_ha)]
        )
      }
      updatesFeed.push('Superficie por vegetación agregada')
      auditAfter.superficie_vegetacion = body.superficie_vegetacion
    }

    if (body.tecnicas) {
      for (const t of body.tecnicas) {
        await AppDataSource.query(
          `INSERT INTO cierre_tecnicas_extincion (incendio_uuid, tecnica, pct, eliminado_en)
           VALUES ($1,$2,$3,NULL)
           ON CONFLICT (incendio_uuid, tecnica) DO UPDATE SET
             pct = EXCLUDED.pct,
             eliminado_en = NULL,
             actualizado_en = now()`,
          [incendio_uuid, t.tecnica, String(t.pct)]
        )
      }
      updatesFeed.push('Técnicas de extinción actualizadas')
      auditAfter.tecnicas = body.tecnicas
    }

    if (body.medios_terrestres) {
      for (const m of body.medios_terrestres) {
        await AppDataSource.query(
          `INSERT INTO cierre_medios_terrestres (incendio_uuid, medio_terrestre_id, cantidad, eliminado_en)
           VALUES ($1,$2,$3,NULL)
           ON CONFLICT (incendio_uuid, medio_terrestre_id) DO UPDATE SET
             cantidad = EXCLUDED.cantidad,
             eliminado_en = NULL,
             actualizado_en = now()`,
          [incendio_uuid, m.medio_terrestre_id, m.cantidad ?? 1]
        )
      }
      // Autocompletar llegada de medios terrestres si estaba vacío
      await AppDataSource.query(
        `UPDATE cierre_secuencia_control
         SET llegada_medios_terrestres_at = COALESCE(llegada_medios_terrestres_at, now()),
             actualizado_en = now()
         WHERE incendio_uuid = $1 AND eliminado_en IS NULL`,
        [incendio_uuid]
      )
      updatesFeed.push('Medios terrestres actualizados')
      auditAfter.medios_terrestres = body.medios_terrestres
    }
    if (body.medios_aereos) {
      for (const m of body.medios_aereos) {
        await AppDataSource.query(
          `INSERT INTO cierre_medios_aereos (incendio_uuid, medio_aereo_id, pct, eliminado_en)
           VALUES ($1,$2,$3,NULL)
           ON CONFLICT (incendio_uuid, medio_aereo_id) DO UPDATE SET
             pct = EXCLUDED.pct,
             eliminado_en = NULL,
             actualizado_en = now()`,
          [incendio_uuid, m.medio_aereo_id, String(m.pct)]
        )
      }
      // Autocompletar llegada de medios aéreos si estaba vacío
      await AppDataSource.query(
        `UPDATE cierre_secuencia_control
         SET llegada_medios_aereos_at = COALESCE(llegada_medios_aereos_at, now()),
             actualizado_en = now()
         WHERE incendio_uuid = $1 AND eliminado_en IS NULL`,
        [incendio_uuid]
      )
      updatesFeed.push('Medios aéreos actualizados')
      auditAfter.medios_aereos = body.medios_aereos
    }
    if (body.medios_acuaticos) {
      for (const m of body.medios_acuaticos) {
        await AppDataSource.query(
          `INSERT INTO cierre_medios_acuaticos (incendio_uuid, medio_acuatico_id, cantidad, eliminado_en)
           VALUES ($1,$2,$3,NULL)
           ON CONFLICT (incendio_uuid, medio_acuatico_id) DO UPDATE SET
             cantidad = EXCLUDED.cantidad,
             eliminado_en = NULL,
             actualizado_en = now()`,
          [incendio_uuid, m.medio_acuatico_id, m.cantidad ?? 1]
        )
      }
      updatesFeed.push('Medios acuáticos actualizados')
      auditAfter.medios_acuaticos = body.medios_acuaticos
    }
    if (body.medios_instituciones) {
      for (const i of body.medios_instituciones) {
        await AppDataSource.query(
          `INSERT INTO cierre_medios_instituciones (incendio_uuid, institucion_uuid, eliminado_en)
           VALUES ($1,$2,NULL)
           ON CONFLICT (incendio_uuid, institucion_uuid) DO UPDATE SET
             eliminado_en = NULL,
             actualizado_en = now()`,
          [incendio_uuid, i.institucion_uuid]
        )
      }
      updatesFeed.push('Instituciones participantes actualizadas')
      auditAfter.medios_instituciones = body.medios_instituciones
    }

    if (body.abastos) {
      for (const a of body.abastos) {
        await AppDataSource.query(
          `INSERT INTO cierre_abastos (incendio_uuid, abasto_id, cantidad, eliminado_en)
           VALUES ($1,$2,$3,NULL)
           ON CONFLICT (incendio_uuid, abasto_id) DO UPDATE SET
             cantidad = EXCLUDED.cantidad,
             eliminado_en = NULL,
             actualizado_en = now()`,
          [incendio_uuid, a.abasto_id, a.cantidad ?? 0]
        )
      }
      updatesFeed.push('Abastos utilizados actualizados')
      auditAfter.abastos = body.abastos
    }

    if (body.causa) {
      const c = body.causa
      await AppDataSource.query(
        `INSERT INTO cierre_causa (incendio_uuid, causa_id, otro_texto, eliminado_en)
         VALUES ($1,$2,$3,NULL)
         ON CONFLICT (incendio_uuid) DO UPDATE SET
           causa_id = COALESCE($2, cierre_causa.causa_id),
           otro_texto = COALESCE($3, cierre_causa.otro_texto),
           eliminado_en = NULL,
           actualizado_en = now()`,
        [incendio_uuid, c.causa_id, c.otro_texto ?? null]
      )
      updatesFeed.push('Causa de incendio actualizada')
      auditAfter.causa = c
    }

    if (body.meteo) {
      const m = body.meteo
      await AppDataSource.query(
        `INSERT INTO cierre_meteorologia (incendio_uuid, temp_c, hr_pct, viento_vel, viento_dir, eliminado_en)
         VALUES ($1,$2,$3,$4,$5,NULL)
         ON CONFLICT (incendio_uuid) DO UPDATE SET
           temp_c     = COALESCE($2, cierre_meteorologia.temp_c),
           hr_pct     = COALESCE($3, cierre_meteorologia.hr_pct),
           viento_vel = COALESCE($4, cierre_meteorologia.viento_vel),
           viento_dir = COALESCE($5, cierre_meteorologia.viento_dir),
           eliminado_en = NULL,
           actualizado_en = now()`,
        [incendio_uuid, m.temp_c ?? null, m.hr_pct ?? null, m.viento_vel ?? null, m.viento_dir ?? null]
      )
      updatesFeed.push('Factores meteorológicos actualizados')
      auditAfter.meteo = body.meteo
    }

    if (body.nota) {
      updatesFeed.push(body.nota)
    }

    for (const msg of updatesFeed) {
      await AppDataSource.query(
        `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
         VALUES ($1, 'CIERRE_ACTUALIZADO', $2, $3)`,
        [incendio_uuid, msg, who]
      )
    }
    if (Object.keys(auditAfter).length) {
      await auditRecord({
        tabla: 'cierre_operaciones',
        registro_uuid: incendio_uuid,
        accion: 'UPDATE',
        antes: null,
        despues: auditAfter,
        ctx: res.locals.ctx
      })
    }

    if (updatesFeed.length > 0) {
  try {
    const incData = await AppDataSource.query(
      `SELECT i.incendio_uuid, i.titulo, i.creado_por_uuid
       FROM incendios i
       WHERE i.incendio_uuid = $1 AND i.eliminado_en IS NULL`,
      [incendio_uuid]
    )

    if (incData?.[0]) {
      const inc = incData[0]
      
      const seguidores = await getSubscribedUsers(incendio_uuid, 'avisarmeActualizaciones')
      
      await notifyCierreEvento({
        type: 'cierre_actualizado',
        incendio: {
          id: inc.incendio_uuid,
          titulo: inc.titulo,
          creadorUserId: inc.creado_por_uuid,
          seguidoresUserIds: seguidores, 
        },
        autorNombre: res.locals.ctx?.user?.nombre || 'Usuario',
        resumen: updatesFeed[0],
      })
    }
      } catch (notifError) {
        console.error('[notificacion] Error notificando actualización cierre:', notifError)
      }
    }
    return res.json({ ok: true })
  } catch (e: any) {
  // Zod / validación
  if (e?.issues) {
    return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
  }

  // TypeORM / PG
  const d = e?.driverError ?? e
  if (d?.code) {
    // Mapeo de mensajes amigables por constraint (ajusta nombres reales)
    const friendlyByConstraint: Record<string, string> = {
    }

    const base = {
      code: 'DB_ERROR',
      pg_code: d.code,
      table: d.table ?? null,
      constraint: d.constraint ?? null,
      detail: d.detail ?? null,
      hint: d.hint ?? null,
      traceId: res.locals?.ctx?.requestId ?? null,
    }

    if (d.code === '23503') {
      const friendly =
        (d.constraint && friendlyByConstraint[d.constraint]) ||
        'Violación de llave foránea: algún id de catálogo no existe.'
      return res.status(422).json({ ...base, message: friendly })
    }
    if (d.code === '23505') {
      return res.status(409).json({ ...base, message: 'Registro duplicado (unique_violation).' })
    }
    if (d.code === '23502') {
      return res.status(400).json({ ...base, message: 'Campo requerido es NULL (not_null_violation).' })
    }

    return res.status(400).json({ ...base, message: 'Error de base de datos.' })
  }

  return next(e)
}

})

// ================== POST /:incendio_uuid/finalizar ==================
router.post('/:incendio_uuid/finalizar', guardAuth, guardAdmin, async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.params)
    const user = (res.locals?.ctx?.user || {}) as { usuario_uuid?: string }

    await ensureBaseRecords(incendio_uuid)

    const prev = await AppDataSource.query(
      `SELECT controlado_at, extinguido_at
       FROM cierre_secuencia_control
       WHERE incendio_uuid = $1
         AND eliminado_en IS NULL`,
      [incendio_uuid]
    )
    const alreadyClosed = !!prev?.[0]?.extinguido_at

    let finalDate = prev?.[0]?.extinguido_at || null
    if (!alreadyClosed) {
      const rows = await AppDataSource.query(
        `UPDATE cierre_secuencia_control
         SET controlado_at = COALESCE(controlado_at, now()),
             extinguido_at = now(),
             actualizado_en = now()
         WHERE incendio_uuid = $1
           AND eliminado_en IS NULL
         RETURNING controlado_at, extinguido_at`,
        [incendio_uuid]
      )
      finalDate = rows?.[0]?.extinguido_at || null

      await AppDataSource.query(
        `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
         VALUES ($1, 'EXTINGUIDO', 'Incendio extinguido', $2)`,
        [incendio_uuid, user?.usuario_uuid ?? null]
      )
      await AppDataSource.query(
        `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
         VALUES ($1, 'CIERRE_ACTUALIZADO', 'Incendio cerrado (extinguido)', $2)`,
        [incendio_uuid, user?.usuario_uuid ?? null]
      )

      await auditRecord({
        tabla: 'cierre_secuencia_control',
        registro_uuid: incendio_uuid,
        accion: 'UPDATE',
        antes: { extinguido_at: null },
        despues: { extinguido_at: finalDate },
        ctx: res.locals.ctx
      })

      // ✅ NOTIFICAR CIERRE A PARTICIPANTES Y REGIÓN
      try {
        // Obtener info del incendio
        const incData = await AppDataSource.query(
          `SELECT i.incendio_uuid, i.titulo, i.creado_por_uuid
           FROM incendios i
           WHERE i.incendio_uuid = $1 AND i.eliminado_en IS NULL`,
          [incendio_uuid]
        )

        if (incData?.[0]) {
          const inc = incData[0]

          // ✅ Obtener usuarios suscritos a cierres
          const seguidoresCierre = await getSubscribedUsers(incendio_uuid, 'avisarmeCierres')


          // Notificar a creador (y seguidores si los tienes)
          await notifyIncendioCerrado({
            id: inc.incendio_uuid,
            titulo: inc.titulo,
            creadorUserId: inc.creado_por_uuid,
            seguidoresUserIds: seguidoresCierre, // ✅ Usuarios suscritos a la región
            resumenCierre: 'El incendio ha sido extinguido',
          })

          // Guardar notificación en BD
          const notiRepo = AppDataSource.getRepository(Notificacion)
          await notiRepo.save({
          usuario_uuid: inc.creado_por_uuid,
          tipo: 'incendio_cerrado',
          titulo: '🏁 Incendio cerrado',
          mensaje: `El incendio "${inc.titulo}" ha sido extinguido`,
          payload: {
            incendio_id: inc.incendio_uuid,
            extinguido_at: finalDate,
          },
        })

          // ✅ Guardar notificación en BD para cada suscriptor
          for (const suscriptorId of seguidoresCierre) {
            if (suscriptorId !== inc.creado_por_uuid) { // Evitar duplicado del creador
              await notiRepo.save({
                usuario_uuid: suscriptorId,
                tipo: 'incendio_cerrado',
                titulo: '🏁 Incendio cerrado en tu región',
                mensaje: `El incendio "${inc.titulo}" ha sido extinguido`,
                payload: {
                  incendio_id: inc.incendio_uuid,
                  extinguido_at: finalDate,
                },
              })
            }
          }

          // Notificar a la región (municipio)
          const reporteData = await AppDataSource.query(
            `SELECT r.municipio_uuid, m.codigo
             FROM reportes r
             LEFT JOIN municipios m ON m.municipio_uuid = r.municipio_uuid
             WHERE r.incendio_uuid = $1 AND r.eliminado_en IS NULL
             ORDER BY r.reportado_en DESC NULLS LAST, r.creado_en DESC
             LIMIT 1`,
            [incendio_uuid]
          )

          if (reporteData?.[0]?.codigo) {
            const { notifyCierreFinalizadoARegion } = require('../notificaciones/cierreNotify.service')
            await notifyCierreFinalizadoARegion({
              incendio: {
                id: inc.incendio_uuid,
                titulo: inc.titulo,
                regionCode: reporteData[0].codigo, // código del municipio
              },
            })
          }
        }
      } catch (notifError) {
        console.error('[notificacion] Error notificando cierre:', notifError)
      }
    }

    return res.json({ ok: true, extinguido_at: finalDate, alreadyClosed })
  } catch (e) { next(e) }
})

router.get('/estados', guardAuth, async (req, res, next) => {
  try {
    // ids=uuid1,uuid2,...
    const raw = String(req.query.ids || '').trim()
    if (!raw) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Falta query param ids' })

    // normaliza lista y valida UUIDs
    const parts = Array.from(new Set(raw.split(',').map(s => s.trim()).filter(Boolean)))
    try {
      z.array(z.string().uuid()).min(1).max(500).parse(parts)
    } catch {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'ids debe contener UUIDs válidos (1..500)' })
    }

    // trae las marcas de tiempo de cierre en batch
    const rows = await AppDataSource.query(
      `SELECT incendio_uuid,
              llegada_medios_terrestres_at,
              llegada_medios_aereos_at,
              controlado_at,
              extinguido_at
       FROM cierre_secuencia_control
       WHERE incendio_uuid = ANY($1::uuid[])
         AND eliminado_en IS NULL`,
      [parts]
    )

    // indexa resultados
    const byId: Record<string, {
      estado: 'Pendiente' | 'En atención' | 'Controlado' | 'Extinguido',
      secuencia_control: {
        llegada_medios_terrestres_at: string | null,
        llegada_medios_aereos_at: string | null,
        controlado_at: string | null,
        extinguido_at: string | null
      }
    }> = {}

    for (const r of rows) {
      const sc = {
        llegada_medios_terrestres_at: r.llegada_medios_terrestres_at ? new Date(r.llegada_medios_terrestres_at).toISOString() : null,
        llegada_medios_aereos_at:     r.llegada_medios_aereos_at     ? new Date(r.llegada_medios_aereos_at).toISOString()     : null,
        controlado_at:                r.controlado_at                ? new Date(r.controlado_at).toISOString()                : null,
        extinguido_at:                r.extinguido_at                ? new Date(r.extinguido_at).toISOString()                : null,
      }
      byId[r.incendio_uuid] = {
        estado: estadoDesdeSecuencia(sc),
        secuencia_control: sc
      }
    }

    // para los que no tienen fila (no inicializado): estado = Pendiente
    for (const id of parts) {
      if (!byId[id]) {
        byId[id] = {
          estado: 'Pendiente',
          secuencia_control: {
            llegada_medios_terrestres_at: null,
            llegada_medios_aereos_at: null,
            controlado_at: null,
            extinguido_at: null
          }
        }
      }
    }

    // respuesta amigable: mapa + arreglo
    const items = parts.map((id) => ({ incendio_uuid: id, ...byId[id] }))
    return res.json({ total: items.length, items, byId })
  } catch (e) { next(e) }
})



// ================== GET /:incendio_uuid ==================
router.get('/:incendio_uuid', guardAuth, async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.params)

    const inc = await AppDataSource.query(
      `SELECT i.incendio_uuid, i.creado_por_uuid
       FROM incendios i
       WHERE i.incendio_uuid = $1 AND i.eliminado_en IS NULL`,
      [incendio_uuid]
    )
    if (!inc?.length) return res.status(404).json({ code: 'NOT_FOUND' })

    const [ops] = await AppDataSource.query(
      `SELECT o.tipo_incendio_principal_id,
              t.nombre AS tipo_incendio_principal_nombre
       FROM cierre_operaciones o
       LEFT JOIN tipos_incendio t
         ON t.tipo_incendio_id = o.tipo_incendio_principal_id
       WHERE o.incendio_uuid=$1 AND o.eliminado_en IS NULL`,
      [incendio_uuid]
    )
    const [topo] = await AppDataSource.query(
      `SELECT plano_pct, ondulado_pct, quebrado_pct FROM cierre_topografia WHERE incendio_uuid=$1 AND eliminado_en IS NULL`,
      [incendio_uuid]
    )
    const [sup] = await AppDataSource.query(
      `SELECT area_total_ha, dentro_ap_ha, fuera_ap_ha, nombre_ap FROM cierre_superficie WHERE incendio_uuid=$1 AND eliminado_en IS NULL`,
      [incendio_uuid]
    )
    const [seq] = await AppDataSource.query(
      `SELECT llegada_medios_terrestres_at, llegada_medios_aereos_at, controlado_at, extinguido_at
       FROM cierre_secuencia_control WHERE incendio_uuid=$1 AND eliminado_en IS NULL`,
      [incendio_uuid]
    )
    const [meteo] = await AppDataSource.query(
      `SELECT temp_c, hr_pct, viento_vel, viento_dir FROM cierre_meteorologia WHERE incendio_uuid=$1 AND eliminado_en IS NULL`,
      [incendio_uuid]
    )

    const compTipo = await AppDataSource.query(
      `SELECT c.tipo_incendio_id, t.nombre AS tipo_incendio_nombre, c.pct::float
       FROM cierre_composicion_tipo c
       JOIN tipos_incendio t ON t.tipo_incendio_id = c.tipo_incendio_id
       WHERE c.incendio_uuid=$1 AND c.eliminado_en IS NULL
       ORDER BY t.nombre ASC`,
      [incendio_uuid]
    )

    const propiedad = await AppDataSource.query(
      `SELECT p.tipo_propiedad_id, tp.nombre AS tipo_propiedad_nombre, p.usado
       FROM cierre_propiedad p
       JOIN tipo_propiedad tp ON tp.tipo_propiedad_id = p.tipo_propiedad_id
       WHERE p.incendio_uuid=$1 AND p.eliminado_en IS NULL
       ORDER BY tp.nombre ASC`,
      [incendio_uuid]
    )

    const [iniciado] = await AppDataSource.query(
      `SELECT ija.iniciado_id, ij.nombre AS iniciado_nombre, ija.otro_texto
       FROM cierre_iniciado_junto_a ija
       JOIN iniciado_junto_a_catalogo ij ON ij.iniciado_id = ija.iniciado_id
       WHERE ija.incendio_uuid=$1 AND ija.eliminado_en IS NULL`,
      [incendio_uuid]
    )

    const supVeg = await AppDataSource.query(
      `SELECT superficie_vegetacion_uuid AS id, ubicacion, categoria, subtipo, area_ha::float
       FROM cierre_superficie_vegetacion
       WHERE incendio_uuid=$1 AND eliminado_en IS NULL
       ORDER BY creado_en ASC`,
      [incendio_uuid]
    )

    const tec = await AppDataSource.query(
      `SELECT tecnica, pct::float
       FROM cierre_tecnicas_extincion
       WHERE incendio_uuid=$1 AND eliminado_en IS NULL
       ORDER BY tecnica ASC`,
      [incendio_uuid]
    )

    const mediosTer = await AppDataSource.query(
      `SELECT m.medio_terrestre_id, cat.nombre AS medio_terrestre_nombre, m.cantidad
       FROM cierre_medios_terrestres m
       JOIN medios_terrestres_catalogo cat ON cat.medio_terrestre_id = m.medio_terrestre_id
       WHERE m.incendio_uuid=$1 AND m.eliminado_en IS NULL
       ORDER BY cat.nombre ASC`,
      [incendio_uuid]
    )
    const mediosAer = await AppDataSource.query(
      `SELECT m.medio_aereo_id, cat.nombre AS medio_aereo_nombre, m.pct::float
       FROM cierre_medios_aereos m
       JOIN medios_aereos_catalogo cat ON cat.medio_aereo_id = m.medio_aereo_id
       WHERE m.incendio_uuid=$1 AND m.eliminado_en IS NULL
       ORDER BY cat.nombre ASC`,
      [incendio_uuid]
    )
    const mediosAcu = await AppDataSource.query(
      `SELECT m.medio_acuatico_id, cat.nombre AS medio_acuatico_nombre, m.cantidad
       FROM cierre_medios_acuaticos m
       JOIN medios_acuaticos_catalogo cat ON cat.medio_acuatico_id = m.medio_acuatico_id
       WHERE m.incendio_uuid=$1 AND m.eliminado_en IS NULL
       ORDER BY cat.nombre ASC`,
      [incendio_uuid]
    )
    const mediosInst = await AppDataSource.query(
      `SELECT m.institucion_uuid, i.nombre AS institucion_nombre
       FROM cierre_medios_instituciones m
       JOIN instituciones i ON i.institucion_uuid = m.institucion_uuid
       WHERE m.incendio_uuid=$1 AND m.eliminado_en IS NULL
       ORDER BY i.nombre ASC`,
      [incendio_uuid]
    )

    const abastos = await AppDataSource.query(
      `SELECT a.abasto_id, cat.nombre AS abasto_nombre, a.cantidad
       FROM cierre_abastos a
       JOIN abastos_catalogo cat ON cat.abasto_id = a.abasto_id
       WHERE a.incendio_uuid=$1 AND a.eliminado_en IS NULL
       ORDER BY cat.nombre ASC`,
      [incendio_uuid]
    )

    const [causa] = await AppDataSource.query(
      `SELECT c.causa_id, cat.nombre AS causa_nombre, c.otro_texto
       FROM cierre_causa c
       JOIN causas_catalogo cat ON cat.causa_id = c.causa_id
       WHERE c.incendio_uuid=$1 AND c.eliminado_en IS NULL`,
      [incendio_uuid]
    )

    const updates = await AppDataSource.query(
      `SELECT
         a.actualizacion_uuid AS id,
         a.tipo,
         a.descripcion_corta,
         a.creado_en,
         a.creado_por,
         u.nombre AS creado_por_nombre
       FROM actualizaciones a
       LEFT JOIN usuarios u ON u.usuario_uuid = a.creado_por
       WHERE a.incendio_uuid = $1
         AND a.eliminado_en IS NULL
       ORDER BY a.creado_en DESC
       LIMIT 20`,
      [incendio_uuid]
    )

    // ---- calcular estado de cierre a partir de la secuencia ----
    const estadoDesdeSecuencia = (sc?: {
      llegada_medios_terrestres_at?: string | Date | null
      llegada_medios_aereos_at?: string | Date | null
      controlado_at?: string | Date | null
      extinguido_at?: string | Date | null
    }) => {
      if (!sc) return 'Pendiente'
      const { llegada_medios_terrestres_at, llegada_medios_aereos_at, controlado_at, extinguido_at } = sc
      if (extinguido_at) return 'Extinguido'
      if (controlado_at) return 'Controlado'
      if (llegada_medios_terrestres_at || llegada_medios_aereos_at) return 'En atención'
      return 'Pendiente'
    }

    const cerrado = !!seq?.extinguido_at
    const estado_cierre = estadoDesdeSecuencia(seq || undefined)

    return res.json({
      incendio_uuid,
      cerrado,
      estado_cierre, // 👈 nuevo campo calculado
      tipo_incendio_principal: ops?.tipo_incendio_principal_id ? {
        id: ops.tipo_incendio_principal_id,
        nombre: ops.tipo_incendio_principal_nombre || null
      } : null,
      composicion_tipo: compTipo,
      topografia: topo ?? null,
      propiedad,
      iniciado_junto_a: iniciado ?? null,
      secuencia_control: seq ?? null,
      superficie: sup ?? null,
      superficie_vegetacion: supVeg,
      tecnicas: tec,
      medios: {
        terrestres: mediosTer,
        aereos: mediosAer,
        acuaticos: mediosAcu,
        instituciones: mediosInst
      },
      abastos,
      causa: causa ?? null,
      meteo: meteo ?? null,
      updates
    })
  } catch (e) { next(e) }
})


router.post('/init', guardAuth, async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.body)
    const user = (res.locals?.ctx?.user || {}) as { usuario_uuid?: string; is_admin?: boolean }

    const inc = await getIncendioBasic(incendio_uuid)
    if (!inc) return res.status(404).json({ code: 'NOT_FOUND' })
    const closed = await isClosed(incendio_uuid)
    if (!canEdit(user, inc.creado_por_uuid, closed)) {
      return res.status(403).json({ code: closed ? 'CERRADO_SOLO_ADMIN' : 'PERMISSION_DENIED' })
    }

    const existing = await AppDataSource.query(
      `SELECT 1 FROM cierre_operaciones WHERE incendio_uuid=$1 AND eliminado_en IS NULL`,
      [incendio_uuid]
    )
    const alreadyInitialized = !!existing?.length

    await ensureBaseRecords(incendio_uuid)

    if (!alreadyInitialized) {
      await AppDataSource.query(
        `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
         VALUES ($1,'CIERRE_INICIADO','Se inició el cierre del incendio',$2)`,
        [incendio_uuid, user?.usuario_uuid ?? null]
      )
      await auditRecord({
        tabla: 'cierre_operaciones',
        registro_uuid: incendio_uuid,
        accion: 'INSERT',
        antes: null,
        despues: { incendio_uuid },
        ctx: res.locals.ctx
      })

      // ✅ NOTIFICAR INICIO DE CIERRE
      try {
  const incData = await AppDataSource.query(
    `SELECT i.incendio_uuid, i.titulo, i.creado_por_uuid
     FROM incendios i
     WHERE i.incendio_uuid = $1 AND i.eliminado_en IS NULL`,
    [incendio_uuid]
  )

  if (incData?.[0]) {
    const inc = incData[0]

    // ✅ Obtener usuarios suscritos a cierres
    const seguidores = await getSubscribedUsers(incendio_uuid, 'avisarmeCierres')

    await notifyIncendioCerrado({
      id: inc.incendio_uuid,
      titulo: inc.titulo,
      creadorUserId: inc.creado_por_uuid,
      seguidoresUserIds: seguidores, // ✅ Ahora incluye suscriptores
      resumenCierre: 'El incendio ha sido extinguido',
    })

    // ✅ Guardar notificación en BD para el creador
    const notiRepo = AppDataSource.getRepository(Notificacion)
    const finalDate = null; // No hay fecha de extinción en el inicio
    await notiRepo.save({
      usuario_uuid: inc.creado_por_uuid,
      tipo: 'incendio_cerrado',
      titulo: '🏁 Incendio cerrado',
      mensaje: `El incendio "${inc.titulo}" ha sido extinguido`,
      payload: {
        incendio_id: inc.incendio_uuid,
        extinguido_at: finalDate,
      },
    })

    // ✅ OPCIONAL: También guardar notificación para cada suscriptor
    for (const suscriptorId of seguidores) {
      if (suscriptorId !== inc.creado_por_uuid) { // Evitar duplicado del creador
        await notiRepo.save({
          usuario_uuid: suscriptorId,
          tipo: 'incendio_cerrado',
          titulo: '🏁 Incendio cerrado en tu región',
          mensaje: `El incendio "${inc.titulo}" ha sido extinguido`,
          payload: {
            incendio_id: inc.incendio_uuid,
            extinguido_at: finalDate,
          },
        })
      }
    }
  }


        if (incData?.[0]) {
          const inc = incData[0]
          
          await notifyCierreEvento({
            type: 'cierre_iniciado',
            incendio: {
              id: inc.incendio_uuid,
              titulo: inc.titulo,
              creadorUserId: inc.creado_por_uuid,
              seguidoresUserIds: [], // TODO: Agregar seguidores
            },
            autorNombre: res.locals.ctx?.user?.nombre || 'Usuario',
          })

          // Guardar en BD
          const notiRepo = AppDataSource.getRepository(Notificacion)
          await notiRepo.save({
            usuario_uuid: inc.creado_por_uuid,
            tipo: 'cierre_iniciado',
            titulo: '📋 Cierre de incendio iniciado',
            mensaje: `Se ha iniciado el proceso de cierre para "${inc.titulo}"`,
            payload: {
              incendio_id: inc.incendio_uuid,
            },
          })
        }
      } catch (notifError) {
        console.error('[notificacion] Error notificando cierre:', notifError)
      }
    }

    return res.status(201).json({
      ok: true,
      incendio_uuid,
      alreadyInitialized
    })
  } catch (e: any) {
    if (e?.issues) return res.status(400).json({ code: 'BAD_REQUEST', issues: e.issues })
    next(e)
  }
})
router.post('/:incendio_uuid/reabrir', guardAuth, guardAdmin, async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.params)
    const user = (res.locals?.ctx?.user || {}) as { usuario_uuid?: string }

    await ensureBaseRecords(incendio_uuid)

    const prev = await AppDataSource.query(
      `SELECT extinguido_at
       FROM cierre_secuencia_control
       WHERE incendio_uuid = $1 AND eliminado_en IS NULL`,
      [incendio_uuid]
    )
    const wasClosed = !!prev?.[0]?.extinguido_at

    if (!wasClosed) {
      return res.json({ ok: true, reopened: false, message: 'Ya estaba abierto' })
    }

    await AppDataSource.query(
      `UPDATE cierre_secuencia_control
       SET extinguido_at = NULL,
           actualizado_en = now()
       WHERE incendio_uuid = $1
         AND eliminado_en IS NULL`,
      [incendio_uuid]
    )

    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1, 'CIERRE_ACTUALIZADO', 'Incendio reabierto para edición', $2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )

    await auditRecord({
      tabla: 'cierre_secuencia_control',
      registro_uuid: incendio_uuid,
      accion: 'UPDATE',
      antes: { extinguido_at: prev?.[0]?.extinguido_at },
      despues: { extinguido_at: null },
      ctx: res.locals.ctx
    })

    return res.json({ ok: true, reopened: true })
  } catch (e) { next(e) }
})

// ---------- MEDIOS TERRESTRES
router.patch('/:incendio_uuid/medios-terrestres/:medio_terrestre_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, medio_terrestre_id} = z.object({
      incendio_uuid: z.string().uuid(),
      medio_terrestre_id: z.string()
    }).parse(req.params)
    const { cantidad } = patchCantidad.parse(req.body)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_medios_terrestres
       SET cantidad=$1, actualizado_en=now(), eliminado_en=NULL
       WHERE incendio_uuid=$2 AND medio_terrestre_id=$3 AND eliminado_en IS NULL
       RETURNING medio_terrestre_id`,
      [cantidad, incendio_uuid, medio_terrestre_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})

    // Autocompletar llegada de medios terrestres si estaba vacío
    await AppDataSource.query(
      `UPDATE cierre_secuencia_control
       SET llegada_medios_terrestres_at = COALESCE(llegada_medios_terrestres_at, now()),
           actualizado_en = now()
       WHERE incendio_uuid = $1 AND eliminado_en IS NULL`,
      [incendio_uuid]
    )

    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Medio terrestre actualizado',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})
router.delete('/:incendio_uuid/medios-terrestres/:medio_terrestre_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, medio_terrestre_id} = z.object({
      incendio_uuid: z.string().uuid(),
      medio_terrestre_id: z.string()
    }).parse(req.params)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_medios_terrestres
       SET eliminado_en=now()
       WHERE incendio_uuid=$1 AND medio_terrestre_id=$2 AND eliminado_en IS NULL
       RETURNING medio_terrestre_id`,
      [incendio_uuid, medio_terrestre_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})

    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Medio terrestre eliminado',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})

// ---------- MEDIOS AÉREOS
router.patch('/:incendio_uuid/medios-aereos/:medio_aereo_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, medio_aereo_id} = z.object({
      incendio_uuid: z.string().uuid(),
      medio_aereo_id: z.string()
    }).parse(req.params)
    const { pct } = patchPct.parse(req.body)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_medios_aereos
       SET pct=$1, actualizado_en=now(), eliminado_en=NULL
       WHERE incendio_uuid=$2 AND medio_aereo_id=$3 AND eliminado_en IS NULL
       RETURNING medio_aereo_id`,
      [String(pct), incendio_uuid, medio_aereo_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})

    // Autocompletar llegada de medios aéreos si estaba vacío
    await AppDataSource.query(
      `UPDATE cierre_secuencia_control
       SET llegada_medios_aereos_at = COALESCE(llegada_medios_aereos_at, now()),
           actualizado_en = now()
       WHERE incendio_uuid = $1 AND eliminado_en IS NULL`,
      [incendio_uuid]
    )

    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Medio aéreo actualizado',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})
router.delete('/:incendio_uuid/medios-aereos/:medio_aereo_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, medio_aereo_id} = z.object({
      incendio_uuid: z.string().uuid(),
      medio_aereo_id: z.string()
    }).parse(req.params)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_medios_aereos
       SET eliminado_en=now()
       WHERE incendio_uuid=$1 AND medio_aereo_id=$2 AND eliminado_en IS NULL
       RETURNING medio_aereo_id`,
      [incendio_uuid, medio_aereo_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})

    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Medio aéreo eliminado',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})

// ---------- MEDIOS ACUÁTICOS
router.patch('/:incendio_uuid/medios-acuaticos/:medio_acuatico_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, medio_acuatico_id} = z.object({
      incendio_uuid: z.string().uuid(),
      medio_acuatico_id: z.string()
    }).parse(req.params)
    const { cantidad } = patchCantidad.parse(req.body)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_medios_acuaticos
       SET cantidad=$1, actualizado_en=now(), eliminado_en=NULL
       WHERE incendio_uuid=$2 AND medio_acuatico_id=$3 AND eliminado_en IS NULL
       RETURNING medio_acuatico_id`,
      [cantidad, incendio_uuid, medio_acuatico_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Medio acuático actualizado',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})
router.delete('/:incendio_uuid/medios-acuaticos/:medio_acuatico_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, medio_acuatico_id} = z.object({
      incendio_uuid: z.string().uuid(),
      medio_acuatico_id: z.string()
    }).parse(req.params)
    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_medios_acuaticos
       SET eliminado_en=now()
       WHERE incendio_uuid=$1 AND medio_acuatico_id=$2 AND eliminado_en IS NULL
       RETURNING medio_acuatico_id`,
      [incendio_uuid, medio_acuatico_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Medio acuático eliminado',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})

// ---------- INSTITUCIONES
router.delete('/:incendio_uuid/instituciones/:institucion_uuid', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, institucion_uuid} = z.object({
      incendio_uuid: z.string().uuid(),
      institucion_uuid: z.string().uuid()
    }).parse(req.params)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_medios_instituciones
       SET eliminado_en=now()
       WHERE incendio_uuid=$1 AND institucion_uuid=$2 AND eliminado_en IS NULL
       RETURNING institucion_uuid`,
      [incendio_uuid, institucion_uuid]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Institución eliminada',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})

// ---------- ABASTOS
router.patch('/:incendio_uuid/abastos/:abasto_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, abasto_id} = z.object({
      incendio_uuid: z.string().uuid(),
      abasto_id: z.string()
    }).parse(req.params)
    const { cantidad } = patchCantidad.parse(req.body)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_abastos
       SET cantidad=$1, actualizado_en=now(), eliminado_en=NULL
       WHERE incendio_uuid=$2 AND abasto_id=$3 AND eliminado_en IS NULL
       RETURNING abasto_id`,
      [cantidad, incendio_uuid, abasto_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Abasto actualizado',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})
router.delete('/:incendio_uuid/abastos/:abasto_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, abasto_id} = z.object({
      incendio_uuid: z.string().uuid(),
      abasto_id: z.string()
    }).parse(req.params)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_abastos
       SET eliminado_en=now()
       WHERE incendio_uuid=$1 AND abasto_id=$2 AND eliminado_en IS NULL
       RETURNING abasto_id`,
      [incendio_uuid, abasto_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Abasto eliminado',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})

// ---------- PROPIEDAD
router.patch('/:incendio_uuid/propiedad/:tipo_propiedad_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, tipo_propiedad_id} = z.object({
      incendio_uuid: z.string().uuid(),
      tipo_propiedad_id: z.string()
    }).parse(req.params)
    const { usado } = patchUsado.parse(req.body)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_propiedad
       SET usado=$1, actualizado_en=now(), eliminado_en=NULL
       WHERE incendio_uuid=$2 AND tipo_propiedad_id=$3 AND eliminado_en IS NULL
       RETURNING tipo_propiedad_id`,
      [usado, incendio_uuid, tipo_propiedad_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Propiedad actualizada',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})
router.delete('/:incendio_uuid/propiedad/:tipo_propiedad_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, tipo_propiedad_id} = z.object({
      incendio_uuid: z.string().uuid(),
      tipo_propiedad_id: z.string()
    }).parse(req.params)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_propiedad
       SET eliminado_en=now()
       WHERE incendio_uuid=$1 AND tipo_propiedad_id=$2 AND eliminado_en IS NULL
       RETURNING tipo_propiedad_id`,
      [incendio_uuid, tipo_propiedad_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Propiedad eliminada',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})

// ---------- TÉCNICAS
router.patch('/:incendio_uuid/tecnicas/:tecnica', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, tecnica} = z.object({
      incendio_uuid: z.string().uuid(),
      tecnica: z.enum(['directo','indirecto','control_natural'])
    }).parse(req.params)
    const { pct } = patchPct.parse(req.body)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_tecnicas_extincion
       SET pct=$1, actualizado_en=now(), eliminado_en=NULL
       WHERE incendio_uuid=$2 AND tecnica=$3 AND eliminado_en IS NULL
       RETURNING tecnica`,
      [String(pct), incendio_uuid, tecnica]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Técnica de extinción actualizada',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})
router.delete('/:incendio_uuid/tecnicas/:tecnica', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, tecnica} = z.object({
      incendio_uuid: z.string().uuid(),
      tecnica: z.enum(['directo','indirecto','control_natural'])
    }).parse(req.params)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_tecnicas_extincion
       SET eliminado_en=now()
       WHERE incendio_uuid=$1 AND tecnica=$2 AND eliminado_en IS NULL
       RETURNING tecnica`,
      [incendio_uuid, tecnica]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Técnica de extinción eliminada',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})

// ---------- COMPOSICION TIPO
router.patch('/:incendio_uuid/composicion-tipo/:tipo_incendio_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, tipo_incendio_id} = z.object({
      incendio_uuid: z.string().uuid(),
      tipo_incendio_id: z.string()
    }).parse(req.params)
    const { pct } = patchPct.parse(req.body)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_composicion_tipo
       SET pct=$1, actualizado_en=now(), eliminado_en=NULL
       WHERE incendio_uuid=$2 AND tipo_incendio_id=$3 AND eliminado_en IS NULL
       RETURNING tipo_incendio_id`,
      [String(pct), incendio_uuid, tipo_incendio_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Composición por tipo actualizada',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})
router.delete('/:incendio_uuid/composicion-tipo/:tipo_incendio_id', guardAuth, async (req,res,next)=>{
  try{
    const {incendio_uuid, tipo_incendio_id} = z.object({
      incendio_uuid: z.string().uuid(),
      tipo_incendio_id: z.string()
    }).parse(req.params)

    const inc = await getIncendioBasic(incendio_uuid)
    if(!inc) return res.status(404).json({code:'NOT_FOUND'})
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if(!canEdit(user, inc.creado_por_uuid, closed)) return res.status(403).json({code: closed?'CERRADO_SOLO_ADMIN':'PERMISSION_DENIED'})

    const rows = await AppDataSource.query(
      `UPDATE cierre_composicion_tipo
       SET eliminado_en=now()
       WHERE incendio_uuid=$1 AND tipo_incendio_id=$2 AND eliminado_en IS NULL
       RETURNING tipo_incendio_id`,
      [incendio_uuid, tipo_incendio_id]
    )
    if(!rows.length) return res.status(404).json({code:'NOT_FOUND'})
    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1,'CIERRE_ACTUALIZADO','Composición por tipo eliminada',$2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )
    res.json({ok:true})
  }catch(e){ next(e) }
})

// PATCH /cierre/:incendio_uuid/superficie-vegetacion/:id
router.patch('/:incendio_uuid/superficie-vegetacion/:id', guardAuth, async (req, res, next) => {
  try {
    const { incendio_uuid, id } = z.object({
      incendio_uuid: z.string().uuid(),
      id: z.string().uuid()
    }).parse({ ...req.params })
    const body = patchSupVegSchema.parse(req.body)

    const inc = await getIncendioBasic(incendio_uuid)
    if (!inc) return res.status(404).json({ code: 'NOT_FOUND' })
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if (!canEdit(user, inc.creado_por_uuid, closed)) {
      return res.status(403).json({ code: closed ? 'CERRADO_SOLO_ADMIN' : 'PERMISSION_DENIED' })
    }

    const sets: string[] = []
    const vals: any[] = []
    let i = 1
    if (body.subtipo !== undefined) { sets.push(`subtipo = $${i++}`); vals.push(body.subtipo) }
    if (body.area_ha  !== undefined) { sets.push(`area_ha = $${i++}`); vals.push(String(body.area_ha)) }
    if (body.ubicacion !== undefined) { sets.push(`ubicacion = $${i++}`); vals.push(body.ubicacion) }
    if (body.categoria !== undefined) { sets.push(`categoria = $${i++}`); vals.push(body.categoria) }
    sets.push(`actualizado_en = now()`)

    if (vals.length === 1) return res.status(400).json({ code: 'BAD_REQUEST', message: 'Nada para actualizar' })

    const rows = await AppDataSource.query(
      `UPDATE cierre_superficie_vegetacion
       SET ${sets.join(', ')}
       WHERE superficie_vegetacion_uuid = $${i++}
         AND incendio_uuid = $${i++}
         AND eliminado_en IS NULL
       RETURNING superficie_vegetacion_uuid AS id`,
      [...vals, id, incendio_uuid]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })

    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1, 'CIERRE_ACTUALIZADO', 'Superficie de vegetación actualizada', $2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )

    return res.json({ ok: true, id })
  } catch (e) { next(e) }
})

// DELETE /cierre/:incendio_uuid/superficie-vegetacion/:id
router.delete('/:incendio_uuid/superficie-vegetacion/:id', guardAuth, async (req, res, next) => {
  try {
    const { incendio_uuid, id } = z.object({
      incendio_uuid: z.string().uuid(),
      id: z.string().uuid()
    }).parse({ ...req.params })

    const inc = await getIncendioBasic(incendio_uuid)
    if (!inc) return res.status(404).json({ code: 'NOT_FOUND' })
    const closed = await isClosed(incendio_uuid)
    const user = (res.locals?.ctx?.user || {}) as CtxUser
    if (!canEdit(user, inc.creado_por_uuid, closed)) {
      return res.status(403).json({ code: closed ? 'CERRADO_SOLO_ADMIN' : 'PERMISSION_DENIED' })
    }

    const rows = await AppDataSource.query(
      `UPDATE cierre_superficie_vegetacion
       SET eliminado_en = now()
       WHERE superficie_vegetacion_uuid = $1
         AND incendio_uuid = $2
         AND eliminado_en IS NULL
       RETURNING superficie_vegetacion_uuid AS id`,
      [id, incendio_uuid]
    )
    if (!rows.length) return res.status(404).json({ code: 'NOT_FOUND' })

    await AppDataSource.query(
      `INSERT INTO actualizaciones (incendio_uuid, tipo, descripcion_corta, creado_por)
       VALUES ($1, 'CIERRE_ACTUALIZADO', 'Superficie de vegetación eliminada', $2)`,
      [incendio_uuid, user?.usuario_uuid ?? null]
    )

    return res.json({ ok: true })
  } catch (e) { next(e) }
})

export default router