// src/middlewares/load-incendio.ts
import { Request, Response, NextFunction } from 'express'
import { AppDataSource } from '../db/data-source'
import { ErrorHelpers } from '../utils/response'

export interface IncendioBasicData {
  incendio_uuid: string
  creado_por_uuid: string
  extinguido_at: Date | null
  titulo?: string
}

/**
 * Middleware que carga datos básicos del incendio y los agrega a res.locals
 *
 * @example
 * router.post('/:incendio_uuid/respuestas', loadIncendio, async (req, res) => {
 *   const incendio = res.locals.incendio // Ya cargado
 * })
 */
export async function loadIncendio(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  const { incendio_uuid } = req.params

  if (!incendio_uuid) {
    return ErrorHelpers.badRequest(res, 'incendio_uuid es requerido')
  }

  try {
    const incendioRow = await AppDataSource.query(
      `SELECT i.incendio_uuid, i.creado_por_uuid, ctrl.extinguido_at, i.titulo
       FROM incendios i
       LEFT JOIN incendio_controles ctrl ON ctrl.incendio_uuid = i.incendio_uuid
       WHERE i.incendio_uuid = $1 AND i.eliminado_en IS NULL`,
      [incendio_uuid]
    )

    const incendio: IncendioBasicData | undefined = incendioRow?.[0]

    if (!incendio) {
      return ErrorHelpers.notFound(res, 'Incendio no encontrado')
    }

    // Agregar incendio a res.locals para acceso en handlers
    res.locals.incendio = incendio

    next()
  } catch (error) {
    next(error)
  }
}

/**
 * Middleware que carga datos completos del incendio incluyendo relaciones
 */
export async function loadIncendioComplete(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> {
  const { incendio_uuid } = req.params

  if (!incendio_uuid) {
    return ErrorHelpers.badRequest(res, 'incendio_uuid es requerido')
  }

  try {
    const incendioRow = await AppDataSource.query(
      `SELECT i.incendio_uuid, i.creado_por_uuid, ctrl.extinguido_at, i.titulo,
              i.descripcion, i.aprobado, i.estado_incendio_uuid,
              loc.departamento, loc.municipio
       FROM incendios i
       LEFT JOIN incendio_controles ctrl ON ctrl.incendio_uuid = i.incendio_uuid
       LEFT JOIN incendio_localizaciones loc ON loc.incendio_uuid = i.incendio_uuid
       WHERE i.incendio_uuid = $1 AND i.eliminado_en IS NULL`,
      [incendio_uuid]
    )

    const incendio = incendioRow?.[0]

    if (!incendio) {
      return ErrorHelpers.notFound(res, 'Incendio no encontrado')
    }

    res.locals.incendio = incendio

    next()
  } catch (error) {
    next(error)
  }
}
