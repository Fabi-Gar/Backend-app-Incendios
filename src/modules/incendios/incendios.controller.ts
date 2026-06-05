import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../db/data-source'
import { Incendio } from './entities/incendio.entity'
import { Usuario } from '../seguridad/entities/usuario.entity'
import { FindOptionsWhere, ILike, IsNull, Between } from 'typeorm'
import { IncendiosRepository } from './incendios.repository'
import { 
  notifyIncendioAprobado,
  notifyIncendioActualizado, 
  notifyIncendioNuevoMunicipio
} from '../notificaciones/incendioNotify.service'
import { Notificacion } from '../notificaciones/entities/notificacion.entity'
import { auditRecord } from '../auditoria/auditoria.service'
import { EstadoIncendio } from '../catalogos/entities/estado-incendio.entity'
import { IncendioEstadoHistorial } from './entities/incendio-estado-historial.entity'
import { IncendioSeguidor } from './entities/incendio-seguidor.entity'
import fs from 'fs/promises'
import path from 'path'
import mime from 'mime-types'
import { FotoReporte } from '../../modules/incendios/entities/foto-reporte.entity'
import { env } from 'process'
import { mapPgError } from '../../utils/pg-error'

// --- helpers ---
const point4326 = z.object({
  type: z.literal('Point'),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
})

async function getDefaultEstadoUuid() {
  const repo = AppDataSource.getRepository(EstadoIncendio)
  const byCode = await repo.createQueryBuilder('e')
    .where('e.eliminado_en IS NULL AND e.codigo = :c', { c: 'REPORTADO' })
    .getOne()
  if (byCode) return (byCode as any).estado_incendio_uuid

  const byOrden = await repo.createQueryBuilder('e')
    .where('e.eliminado_en IS NULL')
    .orderBy('e.orden', 'ASC')
    .getOne()
  if (byOrden) return (byOrden as any).estado_incendio_uuid

  return null
}

const localizacionSchema = z.object({
  departamento_uuid: z.string().uuid().optional().nullable(),
  municipio_uuid: z.string().uuid().optional().nullable(),
  region_inab: z.number().optional().nullable(),
  subregion_inab: z.string().optional().nullable(),
  lugar_poblado: z.string().optional().nullable(),
  finca: z.string().optional().nullable(),
  coordenada_x: z.number().optional().nullable(),
  coordenada_y: z.number().optional().nullable(),
})

const controlSchema = z.object({
  es_forestal: z.boolean().optional().nullable(),
  area_estimada_ha: z.number().optional().nullable(),
  area_dentro_ap_ha: z.number().optional().nullable(),
  area_fuera_ap_ha: z.number().optional().nullable(),
  metodo_control: z.string().optional().nullable(),
})

const vegetacionSchema = z.object({
  conifera_ha: z.number().optional().nullable(),
  latifoliado_ha: z.number().optional().nullable(),
  mixto_ha: z.number().optional().nullable(),
  manglar_ha: z.number().optional().nullable(),
  pastizal_ha: z.number().optional().nullable(),
  humedal_ha: z.number().optional().nullable(),
  pajonal_ha: z.number().optional().nullable(),
  sabana_ha: z.number().optional().nullable(),
  guamil_ha: z.number().optional().nullable(),
  observaciones: z.string().optional().nullable(),
})

const mediosSchema = z.object({
  medio_uuid: z.string().uuid().optional().nullable(),
  personas_conred: z.number().optional().nullable(),
  personas_bomberos: z.number().optional().nullable(),
  personas_inab: z.number().optional().nullable(),
  personas_municipio: z.number().optional().nullable(),
  personas_ejercito: z.number().optional().nullable(),
  vehiculos_motobombas: z.number().optional().nullable(),
  vuelos: z.number().optional().nullable(),
  observaciones: z.string().optional().nullable(),
})

const meteorologiaSchema = z.object({
  temperatura_c: z.number().optional().nullable(),
  humedad_relativa: z.number().optional().nullable(),
  velocidad_viento_kmh: z.number().optional().nullable(),
  direccion_viento: z.string().optional().nullable(),
  observaciones: z.string().optional().nullable(),
})

const responsableSchema = z.object({
  institucion_uuid: z.string().uuid().optional().nullable(),
  reportado_por: z.string().optional().nullable(),
  telefono: z.string().optional().nullable(),
  fecha_hora_aviso: z.coerce.date().optional().nullable(),
})

const createIncendioSchema = z.object({
  titulo: z.string().min(1),
  descripcion: z.string().nullish(),
  centroide: point4326.nullish(),
  estado_incendio_uuid: z.string().uuid().optional(),
  
  localizacion: localizacionSchema.optional().nullable(),
  control: controlSchema.optional().nullable(),
  vegetacion: vegetacionSchema.optional().nullable(),
  medios: mediosSchema.optional().nullable(),
  meteorologia: meteorologiaSchema.optional().nullable(),
  responsable: responsableSchema.optional().nullable(),
})

const updateIncendioSchema = z.object({
  titulo: z.string().min(1).optional(),
  descripcion: z.string().optional(),
  centroide: point4326.nullish().optional(),
  estado_incendio_uuid: z.string().uuid().optional(),

  localizacion: localizacionSchema.optional().nullable(),
  control: controlSchema.optional().nullable(),
  vegetacion: vegetacionSchema.optional().nullable(),
  medios: mediosSchema.optional().nullable(),
  meteorologia: meteorologiaSchema.optional().nullable(),
  responsable: responsableSchema.optional().nullable(),
})

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')
const PUBLIC_BASE = env.MEDIA_BASE_URL ?? `http://localhost:${env.PORT || 4000}`

async function ensureUploadsDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

export class IncendiosController {

  static async getMios(req: Request, res: Response, next: NextFunction) {
    try {
      const user = res.locals?.ctx?.user as Usuario | undefined
      if (!user?.usuario_uuid) {
        return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } })
      }

      const q = String(req.query.q || '').trim()
      const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1)
      const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '20'), 10) || 20, 1), 100)
      
      const result = await IncendiosRepository.findMios(user.usuario_uuid, q, page, pageSize)

      res.json(result)
    } catch (err) { next(err) }
  }

  static async getSinAprobar(req: Request, res: Response, next: NextFunction) {
    try {
      const q = String(req.query.q || '').trim();
      const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
      const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '50'), 10) || 50, 1), 200);

      const result = await IncendiosRepository.findSinAprobar(q, page, pageSize)

      res.json(result);
    } catch (err) { next(err); }
  }

  static async listar(req: Request, res: Response, next: NextFunction) {
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
        skip: (page - 1) * pageSize,
        relations: ['localizacion', 'estado_incendio']
      })

      res.json({ total, page, pageSize, items })
    } catch (err) { next(err) }
  }

  static async getDetalle(req: Request, res: Response, next: NextFunction) {
    try {
      const { uuid } = z.object({ uuid: z.string().uuid() }).parse(req.params)
      const repo = AppDataSource.getRepository(Incendio)
      const item = await repo.findOne({
        where: { incendio_uuid: uuid, eliminado_en: IsNull() },
        relations: {
          creado_por: true,
          estado_incendio: true,
          localizacion: true,
          control: true,
          vegetacion: true,
          medios: true,
          meteorologia: true,
          responsable: true,
        }
      })
      const u = res.locals.ctx.user
      const puedeVer = item && (item.aprobado || (u?.is_admin || u?.usuario_uuid === item.creado_por?.usuario_uuid))
      if (!item || !puedeVer) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incendio no disponible' }, requestId: res.locals.ctx?.requestId })
      }
      res.json(item)
    } catch (err) { next(err) }
  }

  static async crear(req: Request, res: Response, next: NextFunction) {
    try {
      const user = res.locals?.ctx?.user as Usuario | undefined
      if (!user?.usuario_uuid) {
        return res.status(401).json({ error: { code: 'UNAUTHENTICATED' } })
      }

      let body: z.infer<typeof createIncendioSchema>
      if (req.is('multipart/form-data') && req.body?.data) {
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

      const reportanteNombre =
        `${(user as any)?.nombre ?? ''} ${(user as any)?.apellido ?? ''}`.trim() ||
        (user as any)?.email ||
        'Usuario'

      const telefonoReporte = body.responsable?.telefono ?? (user as any)?.telefono ?? null

      const institucionReporteUuid =
        body.responsable?.institucion_uuid ??
        (user as any)?.institucion_uuid ??
        (user as any)?.institucion?.institucion_uuid ??
        null

      const responsableData = body.responsable ?? {
        reportado_por: reportanteNombre,
        telefono: telefonoReporte,
        institucion_uuid: institucionReporteUuid,
        fecha_hora_aviso: new Date()
      }

      const result = await AppDataSource.transaction(async (trx) => {
        const incRepo = trx.getRepository(Incendio)

        const inc = incRepo.create({
          titulo: body.titulo,
          descripcion: body.descripcion ?? null,
          centroide: body.centroide ?? null,
          requiere_aprobacion: true,
          aprobado: false,
          creado_por: { usuario_uuid: user.usuario_uuid } as any,
          estado_incendio: { estado_incendio_uuid: estadoUuid } as any,
          
          localizacion: body.localizacion ?? undefined,
          control: body.control ?? undefined,
          vegetacion: body.vegetacion ?? undefined,
          medios: body.medios ?? undefined,
          meteorologia: body.meteorologia ?? undefined,
          responsable: responsableData as any,
        } as Partial<Incendio>) as Incendio

        const savedInc = await incRepo.save(inc)

        await trx.getRepository(IncendioEstadoHistorial).save({
          incendio: { incendio_uuid: savedInc.incendio_uuid } as any,
          estado_incendio: { estado_incendio_uuid: estadoUuid } as any,
          cambiado_por: { usuario_uuid: user.usuario_uuid } as any,
          observacion: 'Estado inicial',
        })

        let createdFoto: any = null

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
            credito: (req.body?.credito as string) ?? undefined,
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

      try {
        const { notifyAdminsIncendioPendiente } = await import('../notificaciones/incendioNotify.service');
        await notifyAdminsIncendioPendiente({
          id: result.savedInc.incendio_uuid,
          titulo: result.savedInc.titulo ?? undefined,
          creadoPor: user.usuario_uuid
        });
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
  }

  static async actualizar(req: Request, res: Response, next: NextFunction) {
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
        relations: ['creado_por', 'localizacion', 'control', 'vegetacion', 'medios', 'meteorologia', 'responsable']
      })
      if (!inc) {
        return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Incendio no existe' }, requestId: res.locals.ctx?.requestId })
      }

      const esCreador = (inc as any).creado_por_uuid === user.usuario_uuid
      if (!user.is_admin && !esCreador) {
        return res.status(403).json({ error: { code: 'PERMISSION_DENIED' }, requestId: res.locals.ctx?.requestId })
      }

      const before = { titulo: inc.titulo, descripcion: inc.descripcion, centroide: (inc as any).centroide }

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
      if (typeof body.localizacion !== 'undefined') {
        inc.localizacion = body.localizacion ? { ...inc.localizacion, ...body.localizacion } as any : null;
      }
      if (typeof body.control !== 'undefined') {
        inc.control = body.control ? { ...inc.control, ...body.control } as any : null;
      }
      if (typeof body.vegetacion !== 'undefined') {
        inc.vegetacion = body.vegetacion ? { ...inc.vegetacion, ...body.vegetacion } as any : null;
      }
      if (typeof body.medios !== 'undefined') {
        inc.medios = body.medios ? { ...inc.medios, ...body.medios } as any : null;
      }
      if (typeof body.meteorologia !== 'undefined') {
        inc.meteorologia = body.meteorologia ? { ...inc.meteorologia, ...body.meteorologia } as any : null;
      }
      if (typeof body.responsable !== 'undefined') {
        inc.responsable = body.responsable ? { ...inc.responsable, ...body.responsable } as any : null;
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
  }

  static async aprobar(req: Request, res: Response, next: NextFunction) {
    try {
      const { uuid } = z.object({ uuid: z.string().uuid() }).parse(req.params)
      const repo = AppDataSource.getRepository(Incendio)
      
      const inc = await repo.findOne({ 
        where: { incendio_uuid: uuid, eliminado_en: IsNull() },
        relations: ['creado_por']
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
        }
      } catch (notifError) {
        console.error('[notificacion] Error notificando aprobación:', notifError)
      }

      try {
        const incendioData = await AppDataSource.query(
          `SELECT i.municipio_uuid, m.nombre
           FROM incendios i
           LEFT JOIN municipios m ON m.municipio_uuid = i.municipio_uuid
           WHERE i.incendio_uuid = $1 AND i.eliminado_en IS NULL`,
          [saved.incendio_uuid]
        )

        if (incendioData?.[0]?.municipio_uuid) {
          await notifyIncendioNuevoMunicipio({
            id: saved.incendio_uuid,
            titulo: saved.titulo ?? undefined,
            municipioCode: incendioData[0].municipio_uuid,
            ubicacion: incendioData[0].nombre || 'Sin ubicación',
          })
        }
      } catch (notifError) {
        console.error('[notificacion] Error notificando región:', notifError)
      }

      res.json(saved)
    } catch (err) { next(err) }
  }

  static async rechazar(req: Request, res: Response, next: NextFunction) {
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
  }

  static async historial(req: Request, res: Response, next: NextFunction) {
    try {
      const { uuid } = z.object({ uuid: z.string().uuid() }).parse(req.params)

      const historial = await AppDataSource.query(
        `
        SELECT
          h.historial_uuid,
          h.observacion,
          h.creado_en,
          jsonb_build_object(
            'estado_incendio_uuid', e.estado_incendio_uuid,
            'codigo', e.codigo,
            'nombre', e.nombre,
            'orden', e.orden
          ) AS estado,
          CASE
            WHEN u.usuario_uuid IS NOT NULL THEN
              jsonb_build_object(
                'usuario_uuid', u.usuario_uuid,
                'nombre', u.nombre,
                'apellido', u.apellido,
                'email', u.email
              )
            ELSE NULL
          END AS cambiado_por
        FROM incendio_estado_historial h
        LEFT JOIN estado_incendio e ON e.estado_incendio_uuid = h.estado_incendio_uuid
        LEFT JOIN usuarios u ON u.usuario_uuid = h.cambiado_por_uuid
        WHERE h.incendio_uuid = $1 AND h.eliminado_en IS NULL
        ORDER BY h.creado_en DESC
        `,
        [uuid]
      )

      res.json({ total: historial.length, items: historial })
    } catch (err: any) {
      if (err?.issues) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Validación', issues: err.issues }, requestId: res.locals.ctx?.requestId })
      next(err)
    }
  }

  static async chequeaSiguiendo(req: Request, res: Response, next: NextFunction) {
    try {
      const { uuid } = z.object({ uuid: z.string().uuid() }).parse(req.params);
      const user = res.locals.ctx.user as Usuario;

      const repo = AppDataSource.getRepository(IncendioSeguidor);
      const seguimiento = await repo.findOne({
        where: {
          incendio_uuid: uuid,
          usuario_uuid: user.usuario_uuid,
        },
      });

      res.json({ siguiendo: !!seguimiento });
    } catch (err: any) {
      if (err?.issues) return res.status(400).json({ error: { code: 'BAD_REQUEST', issues: err.issues } });
      next(err);
    }
  }

  static async seguir(req: Request, res: Response, next: NextFunction) {
    try {
      const { uuid } = z.object({ uuid: z.string().uuid() }).parse(req.params);
      const user = res.locals.ctx.user as Usuario;

      const repo = AppDataSource.getRepository(IncendioSeguidor);
      await repo.save({
        incendio_uuid: uuid,
        usuario_uuid: user.usuario_uuid,
      });

      res.status(201).json({ message: 'Ahora sigues este incendio.' });
    } catch (err: any) {
      if (err?.issues) return res.status(400).json({ error: { code: 'BAD_REQUEST', issues: err.issues } });
      next(err);
    }
  }

  static async dejarDeSeguir(req: Request, res: Response, next: NextFunction) {
    try {
      const { uuid } = z.object({ uuid: z.string().uuid() }).parse(req.params);
      const user = res.locals.ctx.user as Usuario;

      const repo = AppDataSource.getRepository(IncendioSeguidor);
      await repo.delete({
        incendio_uuid: uuid,
        usuario_uuid: user.usuario_uuid,
      });

      res.status(200).json({ message: 'Dejaste de seguir este incendio.' });
    } catch (err: any) {
      if (err?.issues) return res.status(400).json({ error: { code: 'BAD_REQUEST', issues: err.issues } });
      next(err);
    }
  }
}
