// src/modules/cierre/cierre.routes.ts
import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../db/data-source'
import { guardAuth } from '../../middlewares/auth'
import { CierrePlantilla } from './entities/cierre-plantilla.entity'
import { CierreSeccion } from './entities/cierre-seccion.entity'
import { CierreCampo } from './entities/cierre-campo.entity'
import { CierreRespuesta } from './entities/cierre-respuesta.entity'
import { Incendio } from '../incendios/entities/incendio.entity'
import { auditRecord } from '../auditoria/auditoria.service'
import { notifyIncendioCerrado } from '../notificaciones/incendioNotify.service'
import { notifyCierreEvento } from '../notificaciones/cierreNotify.service'
import { Notificacion } from '../notificaciones/entities/notificacion.entity'
import { getSubscribedUsers } from '../incendios/GetsuscribedUsers'
import { IsNull } from 'typeorm'
import { sendError, ErrorHelpers } from '../../utils/response'
import { loggers } from '../../utils/logger'
import { loadIncendio, IncendioBasicData } from '../../middlewares/load-incendio'
import { canEditCierre, canFinalizeIncendio, UserContext } from '../incendios/incendios.permissions'

const router = Router()

router.use(guardAuth)

// GET /:incendio_uuid - Obtener formulario de cierre para un incendio
router.get('/:incendio_uuid', async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.params)

    // Verificar que el incendio existe
    const incendio = await AppDataSource.getRepository(Incendio).findOne({
      where: { incendio_uuid, eliminado_en: IsNull() }
    })

    if (!incendio) return ErrorHelpers.notFound(res, 'Incendio no encontrado')

    // Obtener la plantilla activa
    const plantilla = await AppDataSource.getRepository(CierrePlantilla).findOne({
      where: { activa: true, eliminado_en: IsNull() }
    })

    if (!plantilla) {
      return ErrorHelpers.notFound(res, 'No hay plantilla activa configurada')
    }

    // Obtener secciones y campos de la plantilla
    const secciones = await AppDataSource.getRepository(CierreSeccion).find({
      where: { plantilla_uuid: plantilla.plantilla_uuid, eliminado_en: IsNull() },
      order: { orden: 'ASC' }
    })

    const seccionesConCampos = await Promise.all(
      secciones.map(async (seccion) => {
        const campos = await AppDataSource.getRepository(CierreCampo).find({
          where: { seccion_uuid: seccion.seccion_uuid, eliminado_en: IsNull() },
          order: { orden: 'ASC' }
        })

        // Obtener respuestas del usuario para estos campos
        const camposConRespuestas = await Promise.all(
          campos.map(async (campo) => {
            const respuesta = await AppDataSource.getRepository(CierreRespuesta).findOne({
              where: {
                incendio_uuid,
                campo_uuid: campo.campo_uuid,
                eliminado_en: IsNull()
              }
            })

            return {
              ...campo,
              respuesta: respuesta ? {
                respuesta_uuid: respuesta.respuesta_uuid,
                valor_texto: respuesta.valor_texto,
                valor_numero: respuesta.valor_numero,
                valor_fecha: respuesta.valor_fecha,
                valor_datetime: respuesta.valor_datetime,
                valor_boolean: respuesta.valor_boolean,
                valor_json: respuesta.valor_json,
                respondido_por_uuid: respuesta.respondido_por_uuid,
                actualizado_en: respuesta.actualizado_en
              } : null
            }
          })
        )

        return { ...seccion, campos: camposConRespuestas }
      })
    )

    // Verificar si el incendio está extinguido
    const extinguido = !!(incendio as any).extinguido_at

    return res.json({
      incendio_uuid,
      plantilla: {
        plantilla_uuid: plantilla.plantilla_uuid,
        nombre: plantilla.nombre,
        descripcion: plantilla.descripcion,
        version: plantilla.version
      },
      extinguido,
      secciones: seccionesConCampos
    })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// POST /:incendio_uuid/respuestas - Crear/actualizar múltiples respuestas
const respuestaSchema = z.object({
  campo_uuid: z.string().uuid(),
  valor_texto: z.string().optional().nullable(),
  valor_numero: z.number().optional().nullable(),
  valor_fecha: z.coerce.date().optional().nullable(),
  valor_datetime: z.coerce.date().optional().nullable(),
  valor_boolean: z.boolean().optional().nullable(),
  valor_json: z.any().optional().nullable()
})

router.post('/:incendio_uuid/respuestas', loadIncendio, async (req, res, next) => {
  try {
    const { incendio_uuid } = req.params
    const { respuestas } = z.object({ respuestas: z.array(respuestaSchema) }).parse(req.body)
    const user = res.locals.ctx?.user as UserContext
    const incendio = res.locals.incendio as IncendioBasicData

    // Verificar permisos
    if (!canEditCierre(user, incendio)) {
      return ErrorHelpers.forbidden(res, 'No tienes permisos para editar este cierre')
    }

    const repo = AppDataSource.getRepository(CierreRespuesta)
    const saved: string[] = []
    const camposActualizados: Array<{ nombre: string; valor: string }> = []

    for (const r of respuestas) {
      // Verificar que el campo existe
      const campo = await AppDataSource.getRepository(CierreCampo).findOne({
        where: { campo_uuid: r.campo_uuid, eliminado_en: IsNull() }
      })

      if (!campo) continue // Saltar campos que no existen

      // Buscar si ya existe una respuesta
      let respuesta = await repo.findOne({
        where: {
          incendio_uuid,
          campo_uuid: r.campo_uuid,
          eliminado_en: IsNull()
        }
      })

      if (respuesta) {
        // Actualizar respuesta existente
        respuesta.valor_texto = r.valor_texto ?? null
        respuesta.valor_numero = r.valor_numero ?? null
        respuesta.valor_fecha = r.valor_fecha ?? null
        respuesta.valor_datetime = r.valor_datetime ?? null
        respuesta.valor_boolean = r.valor_boolean ?? null
        respuesta.valor_json = r.valor_json ?? null
        respuesta.respondido_por_uuid = user.usuario_uuid!
      } else {
        // Crear nueva respuesta
        respuesta = repo.create({
          incendio_uuid,
          campo_uuid: r.campo_uuid,
          valor_texto: r.valor_texto ?? null,
          valor_numero: r.valor_numero ?? null,
          valor_fecha: r.valor_fecha ?? null,
          valor_datetime: r.valor_datetime ?? null,
          valor_boolean: r.valor_boolean ?? null,
          valor_json: r.valor_json ?? null,
          respondido_por_uuid: user.usuario_uuid!
        })
      }

      await repo.save(respuesta)
      saved.push(respuesta.respuesta_uuid)

      // Recopilar información para notificación
      let valorStr = ''
      if (r.valor_texto) valorStr = r.valor_texto
      else if (r.valor_numero !== null && r.valor_numero !== undefined) valorStr = String(r.valor_numero)
      else if (r.valor_boolean !== null && r.valor_boolean !== undefined) valorStr = r.valor_boolean ? 'Sí' : 'No'
      else if (r.valor_fecha) valorStr = new Date(r.valor_fecha).toLocaleDateString()
      else if (r.valor_datetime) valorStr = new Date(r.valor_datetime).toLocaleString()
      else if (r.valor_json) valorStr = Array.isArray(r.valor_json) ? `${r.valor_json.length} opciones` : 'datos'

      if (valorStr) {
        camposActualizados.push({
          nombre: campo.nombre,
          valor: valorStr.length > 50 ? valorStr.substring(0, 50) + '...' : valorStr
        })
      }
    }

    await auditRecord({
      tabla: 'cierre_respuestas',
      registro_uuid: incendio_uuid,
      accion: 'UPDATE',
      antes: null,
      despues: { respuestas_actualizadas: saved.length },
      ctx: res.locals.ctx
    })

    // Enviar notificación si se actualizaron campos
    if (camposActualizados.length > 0) {
      try {
        // Obtener título del incendio
        const incendioInfo = await AppDataSource.query(
          `SELECT titulo FROM incendios WHERE incendio_uuid = $1`,
          [incendio_uuid]
        )
        const titulo = incendioInfo?.[0]?.titulo || 'Incendio'

        // Obtener seguidores
        const seguidores = await getSubscribedUsers(incendio_uuid, 'avisarmeActualizaciones')

        // Crear resumen de campos actualizados
        const resumen = camposActualizados.length === 1
          ? `${camposActualizados[0].nombre}: ${camposActualizados[0].valor}`
          : camposActualizados.length <= 3
            ? camposActualizados.map(c => `${c.nombre}: ${c.valor}`).join(', ')
            : `${camposActualizados.length} campos actualizados`

        // Enviar notificación push
        await notifyCierreEvento({
          type: 'cierre_actualizado',
          incendio: {
            id: incendio_uuid,
            titulo,
            creadorUserId: incendio.creado_por_uuid,
            seguidoresUserIds: seguidores
          },
          autorNombre: user.nombre || 'Usuario',
          resumen
        })

        // Guardar notificación en BD para el creador
        const notiRepo = AppDataSource.getRepository(Notificacion)
        await notiRepo.save({
          usuario_uuid: incendio.creado_por_uuid,
          tipo: 'cierre_actualizado',
          titulo: '📝 Cierre actualizado',
          mensaje: `${titulo}: ${resumen}`,
          payload: {
            incendio_id: incendio_uuid,
            campos_actualizados: camposActualizados.length
          }
        })

        // Guardar notificación para seguidores
        for (const suscriptorId of seguidores) {
          if (suscriptorId !== incendio.creado_por_uuid && suscriptorId !== user.usuario_uuid) {
            await notiRepo.save({
              usuario_uuid: suscriptorId,
              tipo: 'cierre_actualizado',
              titulo: '📝 Cierre actualizado',
              mensaje: `${titulo}: ${resumen}`,
              payload: {
                incendio_id: incendio_uuid,
                campos_actualizados: camposActualizados.length
              }
            })
          }
        }
      } catch (notifError) {
        loggers.cierre.error({ err: notifError }, 'Error enviando notificación')
      }
    }

    return res.json({ ok: true, respuestas_guardadas: saved.length })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// PATCH /:incendio_uuid/respuestas/:campo_uuid - Actualizar una sola respuesta
router.patch('/:incendio_uuid/respuestas/:campo_uuid', loadIncendio, async (req, res, next) => {
  try {
    const { incendio_uuid, campo_uuid } = z.object({
      incendio_uuid: z.string().uuid(),
      campo_uuid: z.string().uuid()
    }).parse(req.params)
    const body = respuestaSchema.omit({ campo_uuid: true }).parse(req.body)
    const user = res.locals.ctx?.user as UserContext
    const incendio = res.locals.incendio as IncendioBasicData

    // Verificar permisos
    if (!canEditCierre(user, incendio)) {
      return ErrorHelpers.forbidden(res, 'No tienes permisos para editar este cierre')
    }

    // Verificar que el campo existe
    const campo = await AppDataSource.getRepository(CierreCampo).findOne({
      where: { campo_uuid, eliminado_en: IsNull() }
    })

    if (!campo) return ErrorHelpers.notFound(res, 'Campo no encontrado')

    const repo = AppDataSource.getRepository(CierreRespuesta)
    let respuesta = await repo.findOne({
      where: {
        incendio_uuid,
        campo_uuid,
        eliminado_en: IsNull()
      }
    })

    if (respuesta) {
      // Actualizar
      respuesta.valor_texto = body.valor_texto ?? null
      respuesta.valor_numero = body.valor_numero ?? null
      respuesta.valor_fecha = body.valor_fecha ?? null
      respuesta.valor_datetime = body.valor_datetime ?? null
      respuesta.valor_boolean = body.valor_boolean ?? null
      respuesta.valor_json = body.valor_json ?? null
      respuesta.respondido_por_uuid = user.usuario_uuid!
    } else {
      // Crear
      respuesta = repo.create({
        incendio_uuid,
        campo_uuid,
        valor_texto: body.valor_texto ?? null,
        valor_numero: body.valor_numero ?? null,
        valor_fecha: body.valor_fecha ?? null,
        valor_datetime: body.valor_datetime ?? null,
        valor_boolean: body.valor_boolean ?? null,
        valor_json: body.valor_json ?? null,
        respondido_por_uuid: user.usuario_uuid!
      })
    }

    await repo.save(respuesta)

    await auditRecord({
      tabla: 'cierre_respuestas',
      registro_uuid: respuesta.respuesta_uuid,
      accion: respuesta ? 'UPDATE' : 'INSERT',
      antes: null,
      despues: { campo_uuid, incendio_uuid },
      ctx: res.locals.ctx
    })

    // Enviar notificación
    try {
      // Obtener título del incendio
      const incendioInfo = await AppDataSource.query(
        `SELECT titulo FROM incendios WHERE incendio_uuid = $1`,
        [incendio_uuid]
      )
      const titulo = incendioInfo?.[0]?.titulo || 'Incendio'

      // Obtener seguidores
      const seguidores = await getSubscribedUsers(incendio_uuid, 'avisarmeActualizaciones')

      // Determinar valor actualizado
      let valorStr = ''
      if (body.valor_texto) valorStr = body.valor_texto
      else if (body.valor_numero !== null && body.valor_numero !== undefined) valorStr = String(body.valor_numero)
      else if (body.valor_boolean !== null && body.valor_boolean !== undefined) valorStr = body.valor_boolean ? 'Sí' : 'No'
      else if (body.valor_fecha) valorStr = new Date(body.valor_fecha).toLocaleDateString()
      else if (body.valor_datetime) valorStr = new Date(body.valor_datetime).toLocaleString()
      else if (body.valor_json) valorStr = Array.isArray(body.valor_json) ? `${body.valor_json.length} opciones` : 'datos'

      const resumen = valorStr
        ? `${campo.nombre}: ${valorStr.length > 50 ? valorStr.substring(0, 50) + '...' : valorStr}`
        : `${campo.nombre} actualizado`

      // Enviar notificación push
      await notifyCierreEvento({
        type: 'cierre_actualizado',
        incendio: {
          id: incendio_uuid,
          titulo,
          creadorUserId: incendio.creado_por_uuid,
          seguidoresUserIds: seguidores
        },
        autorNombre: user.nombre || 'Usuario',
        resumen
      })

      // Guardar notificación en BD para el creador
      const notiRepo = AppDataSource.getRepository(Notificacion)
      await notiRepo.save({
        usuario_uuid: incendio.creado_por_uuid,
        tipo: 'cierre_actualizado',
        titulo: '📝 Cierre actualizado',
        mensaje: `${titulo}: ${resumen}`,
        payload: {
          incendio_id: incendio_uuid,
          campo_actualizado: campo.nombre
        }
      })

      // Guardar notificación para seguidores
      for (const suscriptorId of seguidores) {
        if (suscriptorId !== incendio.creado_por_uuid && suscriptorId !== user.usuario_uuid) {
          await notiRepo.save({
            usuario_uuid: suscriptorId,
            tipo: 'cierre_actualizado',
            titulo: '📝 Cierre actualizado',
            mensaje: `${titulo}: ${resumen}`,
            payload: {
              incendio_id: incendio_uuid,
              campo_actualizado: campo.nombre
            }
          })
        }
      }
    } catch (notifError) {
      loggers.cierre.error({ err: notifError }, 'Error enviando notificación')
    }

    return res.json({ ok: true, respuesta_uuid: respuesta.respuesta_uuid })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// DELETE /:incendio_uuid/respuestas/:campo_uuid - Eliminar respuesta
router.delete('/:incendio_uuid/respuestas/:campo_uuid', loadIncendio, async (req, res, next) => {
  try {
    const { incendio_uuid, campo_uuid } = z.object({
      incendio_uuid: z.string().uuid(),
      campo_uuid: z.string().uuid()
    }).parse(req.params)
    const user = res.locals.ctx?.user as UserContext
    const incendio = res.locals.incendio as IncendioBasicData

    // Verificar permisos
    if (!canEditCierre(user, incendio)) {
      return ErrorHelpers.forbidden(res, 'No tienes permisos para editar este cierre')
    }

    const repo = AppDataSource.getRepository(CierreRespuesta)
    const respuesta = await repo.findOne({
      where: {
        incendio_uuid,
        campo_uuid,
        eliminado_en: IsNull()
      }
    })

    if (!respuesta) return ErrorHelpers.notFound(res, 'Respuesta no encontrada')

    respuesta.eliminado_en = new Date()
    await repo.save(respuesta)

    await auditRecord({
      tabla: 'cierre_respuestas',
      registro_uuid: respuesta.respuesta_uuid,
      accion: 'DELETE',
      antes: { campo_uuid, incendio_uuid },
      despues: null,
      ctx: res.locals.ctx
    })

    return res.json({ ok: true })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// POST /:incendio_uuid/finalizar - Finalizar incendio (establecer fecha de extinción)
router.post('/:incendio_uuid/finalizar', async (req, res, next) => {
  try {
    const { incendio_uuid } = z.object({ incendio_uuid: z.string().uuid() }).parse(req.params)
    const user = res.locals.ctx?.user as UserContext

    // Solo admin puede finalizar
    if (!canFinalizeIncendio(user)) {
      return ErrorHelpers.forbidden(res, 'Solo administradores pueden finalizar incendios')
    }

    const repo = AppDataSource.getRepository(Incendio)
    const incendio = await repo.findOne({
      where: { incendio_uuid, eliminado_en: IsNull() }
    })

    if (!incendio) return ErrorHelpers.notFound(res, 'Incendio no encontrado')

    // Verificar si ya está extinguido
    if ((incendio as any).extinguido_at) {
      return res.json({ ok: true, message: 'El incendio ya está extinguido', extinguido_at: (incendio as any).extinguido_at })
    }

    // Establecer fecha de extinción
    const extinguido_at = new Date()
    await AppDataSource.query(
      `UPDATE incendios SET extinguido_at = $1, actualizado_en = now() WHERE incendio_uuid = $2`,
      [extinguido_at, incendio_uuid]
    )

    await auditRecord({
      tabla: 'incendios',
      registro_uuid: incendio_uuid,
      accion: 'UPDATE',
      antes: { extinguido_at: null },
      despues: { extinguido_at },
      ctx: res.locals.ctx
    })

    // Notificar cierre
    try {
      const seguidoresCierre = await getSubscribedUsers(incendio_uuid, 'avisarmeCierres')

      await notifyIncendioCerrado({
        id: incendio_uuid,
        titulo: (incendio as any).titulo || 'Incendio',
        creadorUserId: (incendio as any).creado_por_uuid,
        seguidoresUserIds: seguidoresCierre,
        resumenCierre: 'El incendio ha sido extinguido'
      })

      // Guardar notificación en BD
      const notiRepo = AppDataSource.getRepository(Notificacion)
      await notiRepo.save({
        usuario_uuid: (incendio as any).creado_por_uuid,
        tipo: 'incendio_cerrado',
        titulo: '🏁 Incendio cerrado',
        mensaje: `El incendio "${(incendio as any).titulo}" ha sido extinguido`,
        payload: {
          incendio_id: incendio_uuid,
          extinguido_at
        }
      })

      // Notificar a seguidores
      for (const suscriptorId of seguidoresCierre) {
        if (suscriptorId !== (incendio as any).creado_por_uuid) {
          await notiRepo.save({
            usuario_uuid: suscriptorId,
            tipo: 'incendio_cerrado',
            titulo: '🏁 Incendio cerrado en tu región',
            mensaje: `El incendio "${(incendio as any).titulo}" ha sido extinguido`,
            payload: {
              incendio_id: incendio_uuid,
              extinguido_at
            }
          })
        }
      }
    } catch (notifError) {
      console.error('[notificacion] Error notificando cierre:', notifError)
    }

    return res.json({ ok: true, extinguido_at })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

export default router
