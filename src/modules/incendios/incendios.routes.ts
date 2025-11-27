// src/modules/incendios/incendios.routes.ts
import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../db/data-source'
import { Incendio } from './entities/incendio.entity'
import { Usuario } from '../seguridad/entities/usuario.entity'
import { FindOptionsWhere, ILike, IsNull, Between } from 'typeorm'
import { guardAuth, guardAdmin, guardAdminOrInstitucion } from '../../middlewares/auth'
import multer from 'multer'
import { 
  notifyIncendioAprobado,
  notifyIncendioActualizado, 
  notifyIncendioNuevoMunicipio,
  notifyIncendioCerrado
} from '../notificaciones/incendioNotify.service'
import { Notificacion } from '../notificaciones/entities/notificacion.entity'
import { auditRecord } from '../auditoria/auditoria.service'
import { EstadoIncendio } from '../catalogos/entities/estado-incendio.entity'
import { IncendioEstadoHistorial } from './entities/incendio-estado-historial.entity'
import fs from 'fs/promises'
import path from 'path'
import mime from 'mime-types'
import { FotoReporte } from '../../modules/incendios/entities/foto-reporte.entity'
import { env } from 'process'
import { PushPrefsRepo } from '../notificaciones/pushPrefs.repo'
import { sendExpoPush } from '../notificaciones/expoPush.service'
const router = Router()



// --- helpers ---
const point4326 = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
})


// --- helpers de error PG ---
type PgMapped = { status: number; body: any } | null

function mapPgError(err: any, traceId?: string): PgMapped {
  const e = err?.driverError ?? err
  const code = e?.code
  const detail: string | undefined = e?.detail
  const constraint: string | undefined = e?.constraint
  const table: string | undefined = e?.table
  const message: string | undefined = e?.message

  // FK violation
  if (code === '23503') {
    // detail: 'Key (medio_uuid)=(...) is not present in table "catalogo_medios".'
    let column: string | undefined
    let value: string | undefined
    let refTable: string | undefined
    const m = /Key \((.+)\)=\((.+)\) is not present in table "(.+)"/i.exec(detail || '')
    if (m) {
      column = m[1]
      value = m[2]
      refTable = m[3]
    }
    return {
      status: 422,
      body: {
        error: {
          code: 'FK_VIOLATION',
          message: 'Referencia no válida a una clave foránea.',
          traceId,
          pg: { code, constraint, table, detail, column, value, refTable },
          hint: column ? `Revisa que el valor de "${column}" exista en "${refTable}".` : undefined,
        },
      },
    }
  }

  // Unique violation
  if (code === '23505') {
    // detail: 'Key (campo)=(valor) already exists.'
    let column: string | undefined
    let value: string | undefined
    const m = /Key \((.+)\)=\((.+)\) already exists/i.exec(detail || '')
    if (m) {
      column = m[1]
      value = m[2]
    }
    return {
      status: 409,
      body: {
        error: {
          code: 'UNIQUE_VIOLATION',
          message: 'Registro duplicado.',
          traceId,
          pg: { code, constraint, table, detail, column, value },
        },
      },
    }
  }

  // Not null violation
  if (code === '23502') {
    return {
      status: 422,
      body: {
        error: {
          code: 'NOT_NULL_VIOLATION',
          message: 'Campo requerido no puede ser NULL.',
          traceId,
          pg: { code, constraint, table, detail },
        },
      },
    }
  }

  // Invalid text representation / cast
  if (code === '22P02') {
    return {
      status: 400,
      body: {
        error: {
          code: 'INVALID_TEXT_REPRESENTATION',
          message: 'Formato inválido en algún campo (ej. UUID/fecha/número).',
          traceId,
          pg: { code, detail },
        },
      },
    }
  }

  // PostGIS / GeoJSON (a veces XX000 o 22023 con mensajes de parseo)
  if (code === 'XX000' || code === '22023' || /GeoJSON|ST_GeomFromGeoJSON/i.test(message || '')) {
    return {
      status: 400,
      body: {
        error: {
          code: 'GEOMETRY_PARSE_ERROR',
          message: 'GeoJSON inválido o geometría no válida.',
          traceId,
          pg: { code, detail, message },
        },
      },
    }
  }

  // Por defecto
  return {
    status: 500,
    body: {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Error interno del servidor.',
        traceId,
        pg: { code, constraint, table, detail, message },
      },
    },
  }
}



// helper para default:
async function getDefaultEstadoUuid() {
  const repo = AppDataSource.getRepository(EstadoIncendio)
  // 1) intenta por codigo 'REPORTADO'
  const byCode = await repo.createQueryBuilder('e')
    .where('e.eliminado_en IS NULL AND e.codigo = :c', { c: 'REPORTADO' })
    .getOne()
  if (byCode) return (byCode as any).estado_incendio_uuid

  // 2) cae al de menor orden
  const byOrden = await repo.createQueryBuilder('e')
    .where('e.eliminado_en IS NULL')
    .orderBy('e.orden', 'ASC')
    .getOne()
  if (byOrden) return (byOrden as any).estado_incendio_uuid

  return null
}

const createIncendioSchema = z.object({
  // Campos del incendio
  titulo: z.string().min(1),
  descripcion: z.string().nullish(),
  centroide: point4326.nullish(),
  estado_incendio_uuid: z.string().uuid().optional(), // server pone default si no viene

  // Campos del reporte inicial (ahora parte de incendio)
  institucion_reporte_uuid: z.string().uuid().optional().nullable(),
  medio_uuid: z.string().uuid(),
  reportado_en: z.coerce.date().optional(),
  telefono: z.string().optional().nullable(),
  departamento_uuid: z.string().uuid().optional().nullable(),
  municipio_uuid: z.string().uuid().optional().nullable(),
  lugar_poblado: z.string().optional().nullable(),
  finca: z.string().optional().nullable(),
})

// ⚠️ Importante: NO permitir null; si permites null aquí, romperás el NOT NULL en DB.
const updateIncendioSchema = z.object({
  titulo: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  centroide: point4326.nullish().optional(),
  estado_incendio_uuid: z.string().uuid().optional(), // <-- sin nullish
})

router.get('/sin-aprobar', guardAuth, guardAdminOrInstitucion, async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '50'), 10) || 50, 1), 200);

    // Total
    const totalRows = await AppDataSource.query(
      `
      SELECT COUNT(*)::int AS total
      FROM incendios i
      WHERE i.eliminado_en IS NULL
        AND i.aprobado = FALSE
        AND ($1 = '' OR i.titulo ILIKE '%' || $1 || '%')
      `,
      [q]
    );
    const total = totalRows?.[0]?.total ?? 0;

    // Items (ahora con datos del reporte en la misma tabla)
    const items = await AppDataSource.query(
      `
      SELECT
        i.incendio_uuid,
        i.titulo,
        i.descripcion,
        i.centroide,
        i.creado_en,
        i.requiere_aprobacion,
        jsonb_build_object(
          'usuario_uuid', u.usuario_uuid,
          'nombre', u.nombre,
          'apellido', u.apellido,
          'email', u.email
        ) AS creado_por,
        CASE
          WHEN d.nombre IS NOT NULL OR m.nombre IS NOT NULL THEN
            jsonb_build_object(
              'region_uuid', NULL,
              'nombre',
              trim(
                COALESCE(d.nombre,'') ||
                CASE WHEN d.nombre IS NOT NULL AND m.nombre IS NOT NULL THEN ' / ' ELSE '' END ||
                COALESCE(m.nombre,'')
              )
            )
          ELSE NULL
        END AS region,
        CASE WHEN i.reportado_en IS NULL THEN NULL ELSE
          jsonb_build_object(
            'reportado_por_nombre', i.reportado_por_nombre,
            'reportado_en', i.reportado_en,
            'telefono', i.telefono
          )
        END AS reporte_info
      FROM incendios i
      LEFT JOIN usuarios u ON u.usuario_uuid = i.creado_por_uuid
      LEFT JOIN departamentos d ON d.departamento_uuid = i.departamento_uuid
      LEFT JOIN municipios m ON m.municipio_uuid = i.municipio_uuid
      WHERE i.eliminado_en IS NULL
        AND i.aprobado = FALSE
        AND ($1 = '' OR i.titulo ILIKE '%' || $1 || '%')
      ORDER BY i.creado_en DESC
      LIMIT $2 OFFSET $3
      `,
      [q, pageSize, (page - 1) * pageSize]
    );

    res.json({ total, page, pageSize, items });
  } catch (err) { next(err); }
});


// -------------------- LISTAR --------------------
router.get('/', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim()
    const desde = req.query.desde ? new Date(String(req.query.desde)) : undefined
    const hasta = req.query.hasta ? new Date(String(req.query.hasta)) : undefined

    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1)
    const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '20'), 10) || 20, 1), 100)

    const where: FindOptionsWhere<Incendio> = { eliminado_en: IsNull(), aprobado: true }
    if (q) (where as any).titulo = ILike(`%${q}%`)
    if (desde && hasta) (where as any).creado_en = Between(desde, hasta)

    const repo = AppDataSource.getRepository(Incendio)
    const [items, total] = await repo.findAndCount({
      where,
      order: { creado_en: 'DESC' },
      take: pageSize,
      skip: (page - 1) * pageSize
    })

    res.json({ total, page, pageSize, items })
  } catch (err) { next(err) }
})

// -------------------- DETALLE --------------------
router.get('/:uuid', async (req, res, next) => {
  try {
    const { uuid } = z.object({ uuid: z.string().uuid() }).parse(req.params)
    const repo = AppDataSource.getRepository(Incendio)
    const item = await repo.findOne({
      where: { incendio_uuid: uuid, eliminado_en: IsNull() },
      relations: { creado_por: true }
    })
    const u = res.locals?.ctx?.user
    const puedeVer = item && (item.aprobado || (u?.is_admin || u?.usuario_uuid === (item as any).creado_por_uuid))
    if (!item || !puedeVer) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incendio no disponible' }, requestId: res.locals.ctx?.requestId })
    }
    res.json(item)
  } catch (err) { next(err) }
})

// -------------------- CREAR INCENDIO (con foto opcional por multipart/form-data) --------------------

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')
const PUBLIC_BASE = env.MEDIA_BASE_URL ?? `http://localhost:${env.PORT || 4000}`

async function ensureUploadsDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

// Multer en memoria (10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

// -------------------- CREAR INCENDIO (JSON o multipart con foto) --------------------
router.post('/', guardAuth, upload.single('file'), async (req, res, next) => {
  try {
    const user = res.locals?.ctx?.user as Usuario | undefined
    if (!user?.usuario_uuid) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } })
    }

    // Parse body (puede venir como JSON o form-data)
    let body: z.infer<typeof createIncendioSchema>
    if (req.is('multipart/form-data') && req.body?.data) {
      // Si viene como multipart, el JSON está en el campo 'data'
      body = createIncendioSchema.parse(JSON.parse(String(req.body.data)))
    } else {
      body = createIncendioSchema.parse(req.body)
    }

    const estadoUuid = body.estado_incendio_uuid ?? (await getDefaultEstadoUuid())
    if (!estadoUuid) {
      return res.status(500).json({
        error: { code: 'DEFAULT_STATE_MISSING', message: 'No existe estado por defecto' },
        requestId: res.locals.ctx?.requestId
      })
    }

    const institucionReporteUuid =
      body.institucion_reporte_uuid ??
      (user as any)?.institucion_uuid ??
      (user as any)?.institucion?.institucion_uuid ??
      null

    const reportanteNombre =
      `${(user as any)?.nombre ?? ''} ${(user as any)?.apellido ?? ''}`.trim() ||
      (user as any)?.email ||
      'Usuario'

    const result = await AppDataSource.transaction(async (trx) => {
      const incRepo = trx.getRepository(Incendio)

      const inc = incRepo.create({
        // Campos básicos del incendio
        titulo: body.titulo,
        descripcion: body.descripcion ?? null,
        centroide: body.centroide ?? null,
        requiere_aprobacion: true,
        aprobado: false,
        creado_por: { usuario_uuid: user.usuario_uuid } as any,
        estado_incendio: { estado_incendio_uuid: estadoUuid } as any,

        // Campos del reporte inicial
        reportado_por: { usuario_uuid: user.usuario_uuid } as any,
        reportado_por_nombre: reportanteNombre,
        institucion_reporte: institucionReporteUuid ? { institucion_uuid: institucionReporteUuid } as any : null,
        telefono: body.telefono ?? null,
        reportado_en: body.reportado_en ?? new Date(),
        medio: body.medio_uuid ? { medio_uuid: body.medio_uuid } as any : null,
        departamento: body.departamento_uuid ? { departamento_uuid: body.departamento_uuid } as any : null,
        municipio: body.municipio_uuid ? { municipio_uuid: body.municipio_uuid } as any : null,
        lugar_poblado: body.lugar_poblado ?? null,
        finca: body.finca ?? null,
      } as Partial<Incendio>) as Incendio

      const savedInc = await incRepo.save(inc)

      // Historial inicial
      await trx.getRepository(IncendioEstadoHistorial).save({
        incendio: { incendio_uuid: savedInc.incendio_uuid } as any,
        estado_incendio: { estado_incendio_uuid: estadoUuid } as any,
        cambiado_por: { usuario_uuid: user.usuario_uuid } as any,
        observacion: 'Estado inicial',
      })

      // Guardar foto si viene en el request
      let createdFoto: {
        foto_reporte_uuid: string
        url: string
        credito: string | null
        creado_en: Date
      } | null = null

      if (req.file) {
        const { buffer, originalname, mimetype } = req.file
        if (!/^image\//.test(mimetype || '')) {
          const err = new Error('El archivo debe ser image/*') as any
          err.status = 400
          err.code = 'BAD_IMAGE'
          throw err
        }

        await ensureUploadsDir()
        const ext =
          mime.extension(mimetype) ||
          (path.extname(originalname || '').replace('.', '') || 'jpg')
        const filename = `${savedInc.incendio_uuid}-${Date.now()}.${ext}`

        await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer)
        const publicUrl = `${PUBLIC_BASE}/uploads/${filename}`

        const savedFoto = await trx.getRepository(FotoReporte).save({
          incendio: { incendio_uuid: savedInc.incendio_uuid } as any,
          url: publicUrl,
          credito: (req.body?.credito as string) ?? null,
        })

        createdFoto = {
          foto_reporte_uuid: savedFoto.foto_reporte_uuid,
          url: savedFoto.url,
          credito: savedFoto.credito ?? null,
          creado_en: savedFoto.creado_en,
        }
      }

      await auditRecord({
        tabla: 'incendios',
        registro_uuid: savedInc.incendio_uuid,
        accion: 'INSERT',
        despues: savedInc,
        ctx: res.locals.ctx,
      })

      return { savedInc, createdFoto }
    })

    // Notificar a admins sobre incendio pendiente
    try {
      const admins = await AppDataSource.query(
        `SELECT u.usuario_uuid
         FROM usuarios u
         WHERE u.is_admin = true AND u.eliminado_en IS NULL`
      )

      const adminIds = admins.map((a: any) => a.usuario_uuid)

      if (adminIds.length > 0) {
        const notiRepo = AppDataSource.getRepository(Notificacion)

        for (const adminId of adminIds) {
          await notiRepo.save({
            usuario_uuid: adminId,
            tipo: 'incendio_pendiente_aprobacion',
            titulo: '⚠️ Nuevo incendio pendiente de aprobación',
            mensaje: `"${result.savedInc.titulo}" requiere tu aprobación`,
            payload: {
              incendio_id: result.savedInc.incendio_uuid,
              creado_por: user.usuario_uuid,
            },
          })
        }

        const tokens = await PushPrefsRepo.getTokensForUserIds(adminIds)

        if (tokens.length > 0) {
          await sendExpoPush(tokens, {
            title: '⚠️ Nuevo incendio pendiente',
            body: `"${result.savedInc.titulo}" requiere aprobación`,
            data: {
              tipo: 'incendio_pendiente_aprobacion',
              incendio_id: result.savedInc.incendio_uuid,
              deeplink: `/admin/incendios/${result.savedInc.incendio_uuid}`,
            },
          })
        }
      }
    } catch (notifError) {
      console.error('[notificacion] Error notificando admins:', notifError)
    }

    const full = await AppDataSource.getRepository(Incendio).findOne({
      where: { incendio_uuid: result.savedInc.incendio_uuid, eliminado_en: IsNull() },
      relations: { creado_por: true },
    })

    return res.status(201).json({
      ...(full ?? result.savedInc) as any,
      ...(result.createdFoto ? { foto: result.createdFoto } : {}),
    })
  } catch (err: any) {
    if (err?.issues) {
      return res.status(400).json({
        error: { code: 'BAD_REQUEST', message: 'Validación', issues: err.issues },
        requestId: res.locals.ctx?.requestId,
      })
    }
    const mapped = mapPgError(err, res.locals.ctx?.requestId)
    if (mapped) {
      return res.status(mapped.status).json(mapped.body)
    }
    next(err)
  }
})

// -------------------- ACTUALIZAR --------------------
router.patch('/:uuid', guardAuth, async (req, res, next) => {
  try {
    const { uuid } = z.object({ uuid: z.string().uuid() }).parse(req.params)
    const body = updateIncendioSchema.parse(req.body)
    const user = res.locals.ctx.user as Usuario

    const repo = AppDataSource.getRepository(Incendio)

    const prevRow = await AppDataSource.query(
      `SELECT estado_incendio_uuid FROM incendios WHERE incendio_uuid = $1 AND eliminado_en IS NULL`,
      [uuid],
    )
    if (!prevRow.length) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incendio no existe' }, requestId: res.locals.ctx?.requestId })
    }
    const prevEstadoUuid: string = prevRow[0].estado_incendio_uuid

    const inc = await repo.findOne({ 
      where: { incendio_uuid: uuid, eliminado_en: IsNull() },
      relations: ['creado_por'] // ✅ Cargar relación
    })
    if (!inc) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incendio no existe' }, requestId: res.locals.ctx?.requestId })
    }

    const esCreador = (inc as any).creado_por_uuid === user.usuario_uuid
    if (!user.is_admin && !esCreador) {
      return res.status(403).json({ error: { code: 'PERMISSION_DENIED' }, requestId: res.locals.ctx?.requestId })
    }

    const before = { titulo: inc.titulo, descripcion: inc.descripcion, centroide: (inc as any).centroide }

    // ✅ Detectar cambios para notificación
    let cambiosTexto: string[] = []
    
    if (typeof body.titulo === 'string' && body.titulo !== inc.titulo) {
      cambiosTexto.push('Título actualizado')
      inc.titulo = body.titulo
    }
    if (typeof body.descripcion === 'string' && body.descripcion !== inc.descripcion) {
      cambiosTexto.push('Descripción actualizada')
      ;(inc as any).descripcion = body.descripcion
    }
    if (typeof body.centroide !== 'undefined') {
      cambiosTexto.push('Ubicación actualizada')
      ;(inc as any).centroide = body.centroide ?? null
    }

    let nuevoEstadoUuid: string | null = null
    let estadoCambio = false
    if (typeof body.estado_incendio_uuid !== 'undefined') {
      nuevoEstadoUuid = body.estado_incendio_uuid
      estadoCambio = nuevoEstadoUuid !== prevEstadoUuid
      if (estadoCambio) {
        cambiosTexto.push('Estado cambiado')
      }
      ;(inc as any).estado_incendio = { estado_incendio_uuid: body.estado_incendio_uuid } as any
    }

    const saved = await repo.save(inc)

    if (nuevoEstadoUuid && estadoCambio) {
      await AppDataSource.getRepository(IncendioEstadoHistorial).save({
        incendio: { incendio_uuid: saved.incendio_uuid } as any,
        estado_incendio: { estado_incendio_uuid: nuevoEstadoUuid } as any,
        cambiado_por: { usuario_uuid: user.usuario_uuid } as any,
        observacion: 'Cambio de estado por edición',
      })
    }

    await auditRecord({
      tabla: 'incendios',
      registro_uuid: saved.incendio_uuid,
      accion: 'UPDATE',
      antes: before,
      despues: {
        titulo: saved.titulo,
        descripcion: (saved as any).descripcion,
        centroide: (saved as any).centroide,
        estado_incendio_uuid: nuevoEstadoUuid ?? prevEstadoUuid,
      },
      ctx: res.locals.ctx
    })

    if (cambiosTexto.length > 0 && saved.aprobado) {
      try {
        await notifyIncendioActualizado({
          id: saved.incendio_uuid,
          titulo: saved.titulo ?? undefined,
          creadorUserId: (saved as any).creado_por_uuid,
          seguidoresUserIds: [],
          cambios: cambiosTexto.join(', '),
        })

        // Guardar en BD
        const notiRepo = AppDataSource.getRepository(Notificacion)
        await notiRepo.save({
          usuario_uuid: (saved as any).creado_por_uuid,
          tipo: 'incendio_actualizado',
          payload: {
            incendio_id: saved.incendio_uuid,
            cambios: cambiosTexto,
          },
          leida_en: null,
        })
      } catch (notifError) {
        console.error('[notificacion] Error enviando actualización:', notifError)
      }
    }

    res.json(saved)
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Validación', issues: err.issues }, requestId: res.locals.ctx?.requestId })
    next(err)
  }
})

// -------------------- APROBAR --------------------
// En incendios.routes.ts - endpoint PATCH /:uuid/aprobar
router.patch('/:uuid/aprobar', guardAuth, guardAdminOrInstitucion, async (req, res, next) => {
  try {
    const { uuid } = z.object({ uuid: z.string().uuid() }).parse(req.params)
    const repo = AppDataSource.getRepository(Incendio)
    
    const inc = await repo.findOne({ 
      where: { incendio_uuid: uuid, eliminado_en: IsNull() },
      relations: ['creado_por'] // ✅ Cargar relación
    })
    if (!inc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incendio no existe' }, requestId: res.locals.ctx?.requestId })

    const before = { aprobado: inc.aprobado, requiere_aprobacion: inc.requiere_aprobacion }
    inc.aprobado = true
    inc.requiere_aprobacion = false
    inc.aprobado_en = new Date()
    ;(inc as any).aprobado_por = { usuario_uuid: (res.locals.ctx.user as Usuario).usuario_uuid } as any
    ;(inc as any).rechazado_en = null
    ;(inc as any).rechazado_por = null
    ;(inc as any).motivo_rechazo = null

    const saved = await repo.save(inc)
    
    await auditRecord({
      tabla: 'incendios',
      registro_uuid: saved.incendio_uuid,
      accion: 'UPDATE',
      antes: before,
      despues: { aprobado: saved.aprobado, requiere_aprobacion: saved.requiere_aprobacion, aprobado_en: saved.aprobado_en, aprobado_por: (saved as any).aprobado_por },
      ctx: res.locals.ctx
    })

    // ✅ FIX 1: Notificar al creador
    try {
      const creadorUserId = inc.creado_por?.usuario_uuid

      if (!creadorUserId) {
        console.error('❌ No se pudo obtener creado_por_uuid del incendio')
      } else {
        await notifyIncendioAprobado({
          id: saved.incendio_uuid,
          titulo: saved.titulo ?? undefined,
          creadorUserId: creadorUserId,
        })

        // Guardar en BD
        const notiRepo = AppDataSource.getRepository(Notificacion)
        await notiRepo.save({
          usuario_uuid: creadorUserId,
          tipo: 'incendio_aprobado',
          titulo: '✅ Tu incendio fue aprobado',
          mensaje: `"${saved.titulo}" ha sido aprobado por un administrador`,
          payload: {
            incendio_id: saved.incendio_uuid,
            titulo: saved.titulo,
          },
        })
        console.log('✅ Notificación de aprobación enviada al creador')
      }
    } catch (notifError) {
      console.error('[notificacion] Error notificando aprobación:', notifError)
    }

    // ✅ FIX 2: Notificar a usuarios del municipio (usando UUID)
    try {
      // Obtener municipio_uuid del incendio
      const incendioData = await AppDataSource.query(
        `SELECT i.municipio_uuid, m.nombre
         FROM incendios i
         LEFT JOIN municipios m ON m.municipio_uuid = i.municipio_uuid
         WHERE i.incendio_uuid = $1 AND i.eliminado_en IS NULL`,
        [saved.incendio_uuid]
      )

      if (incendioData?.[0]?.municipio_uuid) {
        // Usar municipio_uuid como identificador
        await notifyIncendioNuevoMunicipio({
          id: saved.incendio_uuid,
          titulo: saved.titulo ?? undefined,
          municipioCode: incendioData[0].municipio_uuid, // ✅ Usar UUID
          ubicacion: incendioData[0].nombre || 'Sin ubicación',
        })
        console.log(`✅ Notificación enviada a usuarios del municipio: ${incendioData[0].nombre}`)
      }
    } catch (notifError) {
      console.error('[notificacion] Error notificando región:', notifError)
    }

    res.json(saved)
  } catch (err) { next(err) }
})

// -------------------- RECHAZAR --------------------
router.patch('/:uuid/rechazar', guardAuth, guardAdminOrInstitucion, async (req, res, next) => {
  try {
    const { uuid } = z.object({ uuid: z.string().uuid() }).parse(req.params)
    const { motivo_rechazo } = z.object({ motivo_rechazo: z.string().min(1) }).parse(req.body)

    const repo = AppDataSource.getRepository(Incendio)
    const inc = await repo.findOne({ where: { incendio_uuid: uuid, eliminado_en: IsNull() } })
    if (!inc) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incendio no existe' }, requestId: res.locals.ctx?.requestId })

    const before = { aprobado: inc.aprobado, requiere_aprobacion: inc.requiere_aprobacion }
    inc.aprobado = false
    inc.requiere_aprobacion = false
    inc.rechazado_en = new Date()
    ;(inc as any).rechazado_por = { usuario_uuid: (res.locals.ctx.user as Usuario).usuario_uuid } as any
    ;(inc as any).motivo_rechazo = motivo_rechazo

    const saved = await repo.save(inc)
    await auditRecord({
      tabla: 'incendios',
      registro_uuid: saved.incendio_uuid,
      accion: 'UPDATE',
      antes: before,
      despues: { aprobado: saved.aprobado, requiere_aprobacion: saved.requiere_aprobacion, rechazado_en: saved.rechazado_en, rechazado_por: (saved as any).rechazado_por, motivo_rechazo: (saved as any).motivo_rechazo },
      ctx: res.locals.ctx
    })

    res.json(saved)
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Validación', issues: err.issues }, requestId: res.locals.ctx?.requestId })
    next(err)
  }
})

export default router
