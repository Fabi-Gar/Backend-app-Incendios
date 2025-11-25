// src/modules/cierre/plantillas.routes.ts
import { Router } from 'express'
import { z } from 'zod'
import { AppDataSource } from '../../db/data-source'
import { guardAuth, guardAdmin } from '../../middlewares/auth'
import { CierrePlantilla } from './entities/cierre-plantilla.entity'
import { CierreSeccion } from './entities/cierre-seccion.entity'
import { CierreCampo } from './entities/cierre-campo.entity'
import { auditRecord } from '../auditoria/auditoria.service'
import { sendError, ErrorHelpers } from '../../utils/response'
import { IsNull } from 'typeorm'

const router = Router()

// Todos los endpoints requieren auth + admin
router.use(guardAuth, guardAdmin)

// ================== PLANTILLAS ==================

const createPlantillaSchema = z.object({
  nombre: z.string().min(1).max(255),
  descripcion: z.string().optional().nullable(),
  version: z.number().int().min(1).default(1)
})

const updatePlantillaSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  descripcion: z.string().optional().nullable()
})

// POST /plantillas - Crear nueva plantilla
router.post('/plantillas', async (req, res, next) => {
  try {
    const body = createPlantillaSchema.parse(req.body)
    const user = res.locals.ctx?.user

    const repo = AppDataSource.getRepository(CierrePlantilla)
    const plantilla = repo.create({
      nombre: body.nombre,
      descripcion: body.descripcion ?? null,
      version: body.version,
      activa: false,
      creado_por: { usuario_uuid: user.usuario_uuid }
    })

    await repo.save(plantilla)

    await auditRecord({
      tabla: 'cierre_plantillas',
      registro_uuid: plantilla.plantilla_uuid,
      accion: 'INSERT',
      antes: null,
      despues: { nombre: body.nombre, version: body.version },
      ctx: res.locals.ctx
    })

    return res.status(201).json(plantilla)
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// GET /plantillas - Listar todas las plantillas
router.get('/plantillas', async (req, res, next) => {
  try {
    const repo = AppDataSource.getRepository(CierrePlantilla)
    const plantillas = await repo.find({
      where: { eliminado_en: null as any },
      relations: ['creado_por'],
      order: { creado_en: 'DESC' }
    })

    return res.json({ total: plantillas.length, plantillas })
  } catch (e) {
    next(e)
  }
})

// GET /plantillas/:plantilla_uuid - Obtener plantilla con secciones y campos
router.get('/plantillas/:plantilla_uuid', async (req, res, next) => {
  try {
    const { plantilla_uuid } = z.object({ plantilla_uuid: z.string().uuid() }).parse(req.params)

    const plantilla = await AppDataSource.getRepository(CierrePlantilla).findOne({
      where: { plantilla_uuid, eliminado_en: IsNull() },
      relations: ['creado_por']
    })

    if (!plantilla) return ErrorHelpers.notFound(res, 'Plantilla no encontrada')

    const secciones = await AppDataSource.getRepository(CierreSeccion).find({
      where: { plantilla_uuid, eliminado_en: IsNull() },
      order: { orden: 'ASC' }
    })

    const seccionesConCampos = await Promise.all(
      secciones.map(async (seccion) => {
        const campos = await AppDataSource.getRepository(CierreCampo).find({
          where: { seccion_uuid: seccion.seccion_uuid, eliminado_en: null as any },
          order: { orden: 'ASC' }
        })
        return { ...seccion, campos }
      })
    )

    return res.json({ ...plantilla, secciones: seccionesConCampos })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// PATCH /plantillas/:plantilla_uuid - Actualizar plantilla
router.patch('/plantillas/:plantilla_uuid', async (req, res, next) => {
  try {
    const { plantilla_uuid } = z.object({ plantilla_uuid: z.string().uuid() }).parse(req.params)
    const body = updatePlantillaSchema.parse(req.body)

    const repo = AppDataSource.getRepository(CierrePlantilla)
    const plantilla = await repo.findOne({
      where: { plantilla_uuid, eliminado_en: IsNull() }
    })

    if (!plantilla) return ErrorHelpers.notFound(res, 'Plantilla no encontrada')

    const antes = { nombre: plantilla.nombre, descripcion: plantilla.descripcion }

    if (body.nombre !== undefined) plantilla.nombre = body.nombre
    if (body.descripcion !== undefined) plantilla.descripcion = body.descripcion

    await repo.save(plantilla)

    await auditRecord({
      tabla: 'cierre_plantillas',
      registro_uuid: plantilla_uuid,
      accion: 'UPDATE',
      antes,
      despues: { nombre: plantilla.nombre, descripcion: plantilla.descripcion },
      ctx: res.locals.ctx
    })

    return res.json({ ok: true })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// DELETE /plantillas/:plantilla_uuid - Soft delete plantilla
router.delete('/plantillas/:plantilla_uuid', async (req, res, next) => {
  try {
    const { plantilla_uuid } = z.object({ plantilla_uuid: z.string().uuid() }).parse(req.params)

    const repo = AppDataSource.getRepository(CierrePlantilla)
    const plantilla = await repo.findOne({
      where: { plantilla_uuid, eliminado_en: IsNull() }
    })

    if (!plantilla) return ErrorHelpers.notFound(res, 'Plantilla no encontrada')

    // No se puede eliminar la plantilla activa
    if (plantilla.activa) {
      return ErrorHelpers.badRequest(res, 'No se puede eliminar la plantilla activa')
    }

    plantilla.eliminado_en = new Date()
    await repo.save(plantilla)

    await auditRecord({
      tabla: 'cierre_plantillas',
      registro_uuid: plantilla_uuid,
      accion: 'DELETE',
      antes: { nombre: plantilla.nombre },
      despues: null,
      ctx: res.locals.ctx
    })

    return res.json({ ok: true })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// POST /plantillas/:plantilla_uuid/activar - Activar plantilla (desactiva otras)
router.post('/plantillas/:plantilla_uuid/activar', async (req, res, next) => {
  try {
    const { plantilla_uuid } = z.object({ plantilla_uuid: z.string().uuid() }).parse(req.params)

    const repo = AppDataSource.getRepository(CierrePlantilla)
    const plantilla = await repo.findOne({
      where: { plantilla_uuid, eliminado_en: IsNull() }
    })

    if (!plantilla) return ErrorHelpers.notFound(res, 'Plantilla no encontrada')

    // Desactivar todas las demás plantillas
    await repo.update({ activa: true }, { activa: false })

    // Activar esta plantilla
    plantilla.activa = true
    await repo.save(plantilla)

    await auditRecord({
      tabla: 'cierre_plantillas',
      registro_uuid: plantilla_uuid,
      accion: 'UPDATE',
      antes: { activa: false },
      despues: { activa: true },
      ctx: res.locals.ctx
    })

    return res.json({ ok: true })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// ================== SECCIONES ==================

const createSeccionSchema = z.object({
  nombre: z.string().min(1).max(255),
  descripcion: z.string().optional().nullable(),
  orden: z.number().int().min(0),
  icono: z.string().optional().nullable()
})

const updateSeccionSchema = z.object({
  nombre: z.string().min(1).max(255).optional(),
  descripcion: z.string().optional().nullable(),
  orden: z.number().int().min(0).optional(),
  icono: z.string().optional().nullable()
})

// POST /plantillas/:plantilla_uuid/secciones - Agregar sección a plantilla
router.post('/plantillas/:plantilla_uuid/secciones', async (req, res, next) => {
  try {
    const { plantilla_uuid } = z.object({ plantilla_uuid: z.string().uuid() }).parse(req.params)
    const body = createSeccionSchema.parse(req.body)

    // Verificar que la plantilla existe
    const plantillaRepo = AppDataSource.getRepository(CierrePlantilla)
    const plantilla = await plantillaRepo.findOne({
      where: { plantilla_uuid, eliminado_en: IsNull() }
    })

    if (!plantilla) return ErrorHelpers.notFound(res, 'Plantilla no encontrada')

    const repo = AppDataSource.getRepository(CierreSeccion)
    const seccion = repo.create({
      plantilla: { plantilla_uuid } as any,
      nombre: body.nombre,
      descripcion: body.descripcion ?? null,
      orden: body.orden,
      icono: body.icono ?? null
    })

    await repo.save(seccion)

    await auditRecord({
      tabla: 'cierre_secciones',
      registro_uuid: seccion.seccion_uuid,
      accion: 'INSERT',
      antes: null,
      despues: { plantilla_uuid, nombre: body.nombre, orden: body.orden },
      ctx: res.locals.ctx
    })

    return res.status(201).json(seccion)
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// PATCH /secciones/:seccion_uuid - Actualizar sección
router.patch('/secciones/:seccion_uuid', async (req, res, next) => {
  try {
    const { seccion_uuid } = z.object({ seccion_uuid: z.string().uuid() }).parse(req.params)
    const body = updateSeccionSchema.parse(req.body)

    const repo = AppDataSource.getRepository(CierreSeccion)
    const seccion = await repo.findOne({
      where: { seccion_uuid, eliminado_en: null as any }
    })

    if (!seccion) return ErrorHelpers.notFound(res, 'Sección no encontrada')

    const antes = { nombre: seccion.nombre, descripcion: seccion.descripcion, orden: seccion.orden }

    if (body.nombre !== undefined) seccion.nombre = body.nombre
    if (body.descripcion !== undefined) seccion.descripcion = body.descripcion
    if (body.orden !== undefined) seccion.orden = body.orden
    if (body.icono !== undefined) seccion.icono = body.icono

    await repo.save(seccion)

    await auditRecord({
      tabla: 'cierre_secciones',
      registro_uuid: seccion_uuid,
      accion: 'UPDATE',
      antes,
      despues: { nombre: seccion.nombre, descripcion: seccion.descripcion, orden: seccion.orden },
      ctx: res.locals.ctx
    })

    return res.json({ ok: true })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// DELETE /secciones/:seccion_uuid - Soft delete sección
router.delete('/secciones/:seccion_uuid', async (req, res, next) => {
  try {
    const { seccion_uuid } = z.object({ seccion_uuid: z.string().uuid() }).parse(req.params)

    const repo = AppDataSource.getRepository(CierreSeccion)
    const seccion = await repo.findOne({
      where: { seccion_uuid, eliminado_en: null as any }
    })

    if (!seccion) return ErrorHelpers.notFound(res, 'Sección no encontrada')

    seccion.eliminado_en = new Date()
    await repo.save(seccion)

    await auditRecord({
      tabla: 'cierre_secciones',
      registro_uuid: seccion_uuid,
      accion: 'DELETE',
      antes: { nombre: seccion.nombre },
      despues: null,
      ctx: res.locals.ctx
    })

    return res.json({ ok: true })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// ================== CAMPOS ==================

const createCampoSchema = z.object({
  campo_padre_uuid: z.string().uuid().optional().nullable(),
  nombre: z.string().min(1).max(255),
  descripcion: z.string().optional().nullable(),
  placeholder: z.string().optional().nullable(),
  tipo: z.enum(['text', 'textarea', 'number', 'date', 'datetime', 'select', 'multiselect', 'checkbox', 'radio', 'file', 'currency', 'percentage']),
  orden: z.number().int().min(0),
  requerido: z.boolean().default(false),
  opciones: z.any().optional().nullable(),
  validaciones: z.any().optional().nullable(),
  dependencias: z.any().optional().nullable(),
  unidad: z.string().optional().nullable(),
  ayuda: z.string().optional().nullable()
})

const updateCampoSchema = createCampoSchema.partial()

// POST /secciones/:seccion_uuid/campos - Agregar campo a sección
router.post('/secciones/:seccion_uuid/campos', async (req, res, next) => {
  try {
    const { seccion_uuid } = z.object({ seccion_uuid: z.string().uuid() }).parse(req.params)
    const body = createCampoSchema.parse(req.body)

    // Verificar que la sección existe
    const seccionRepo = AppDataSource.getRepository(CierreSeccion)
    const seccion = await seccionRepo.findOne({
      where: { seccion_uuid, eliminado_en: null as any }
    })

    if (!seccion) return ErrorHelpers.notFound(res, 'Sección no encontrada')

    const repo = AppDataSource.getRepository(CierreCampo)
    const campo = repo.create({
      seccion: { seccion_uuid } as any,
      campo_padre: body.campo_padre_uuid ? { campo_uuid: body.campo_padre_uuid } as any : null,
      nombre: body.nombre,
      descripcion: body.descripcion ?? null,
      placeholder: body.placeholder ?? null,
      tipo: body.tipo,
      orden: body.orden,
      requerido: body.requerido,
      opciones: body.opciones ?? null,
      validaciones: body.validaciones ?? null,
      dependencias: body.dependencias ?? null,
      unidad: body.unidad ?? null,
      ayuda: body.ayuda ?? null
    })

    await repo.save(campo)

    await auditRecord({
      tabla: 'cierre_campos',
      registro_uuid: campo.campo_uuid,
      accion: 'INSERT',
      antes: null,
      despues: { seccion_uuid, nombre: body.nombre, tipo: body.tipo },
      ctx: res.locals.ctx
    })

    return res.status(201).json(campo)
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// PATCH /campos/:campo_uuid - Actualizar campo
router.patch('/campos/:campo_uuid', async (req, res, next) => {
  try {
    const { campo_uuid } = z.object({ campo_uuid: z.string().uuid() }).parse(req.params)
    const body = updateCampoSchema.parse(req.body)

    const repo = AppDataSource.getRepository(CierreCampo)
    const campo = await repo.findOne({
      where: { campo_uuid, eliminado_en: null as any }
    })

    if (!campo) return ErrorHelpers.notFound(res, 'Campo no encontrado')

    const antes = { ...campo }

    if (body.campo_padre_uuid !== undefined) campo.campo_padre_uuid = body.campo_padre_uuid
    if (body.nombre !== undefined) campo.nombre = body.nombre
    if (body.descripcion !== undefined) campo.descripcion = body.descripcion
    if (body.placeholder !== undefined) campo.placeholder = body.placeholder
    if (body.tipo !== undefined) campo.tipo = body.tipo
    if (body.orden !== undefined) campo.orden = body.orden
    if (body.requerido !== undefined) campo.requerido = body.requerido
    if (body.opciones !== undefined) campo.opciones = body.opciones
    if (body.validaciones !== undefined) campo.validaciones = body.validaciones
    if (body.dependencias !== undefined) campo.dependencias = body.dependencias
    if (body.unidad !== undefined) campo.unidad = body.unidad
    if (body.ayuda !== undefined) campo.ayuda = body.ayuda

    await repo.save(campo)

    await auditRecord({
      tabla: 'cierre_campos',
      registro_uuid: campo_uuid,
      accion: 'UPDATE',
      antes: { nombre: antes.nombre, tipo: antes.tipo },
      despues: { nombre: campo.nombre, tipo: campo.tipo },
      ctx: res.locals.ctx
    })

    return res.json({ ok: true })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

// DELETE /campos/:campo_uuid - Soft delete campo
router.delete('/campos/:campo_uuid', async (req, res, next) => {
  try {
    const { campo_uuid } = z.object({ campo_uuid: z.string().uuid() }).parse(req.params)

    const repo = AppDataSource.getRepository(CierreCampo)
    const campo = await repo.findOne({
      where: { campo_uuid, eliminado_en: null as any }
    })

    if (!campo) return ErrorHelpers.notFound(res, 'Campo no encontrado')

    campo.eliminado_en = new Date()
    await repo.save(campo)

    await auditRecord({
      tabla: 'cierre_campos',
      registro_uuid: campo_uuid,
      accion: 'DELETE',
      antes: { nombre: campo.nombre },
      despues: null,
      ctx: res.locals.ctx
    })

    return res.json({ ok: true })
  } catch (e: any) {
    if (e?.issues) return ErrorHelpers.badRequest(res, 'Datos de entrada inválidos')
    next(e)
  }
})

export default router
