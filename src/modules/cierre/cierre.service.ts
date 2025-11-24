// src/modules/cierre/cierre.service.ts
import { AppDataSource } from '../../db/data-source'
import { IsNull } from 'typeorm'
import { CierreOperaciones } from './entities/cierre-operaciones.entity'
import { CierreTopografia } from './entities/cierre-topografia.entity'
import { CierreSuperficie } from './entities/cierre-superficie.entity'
import { CierreTecnicasExtincion } from './entities/cierre-tecnicas-extincion.entity'
import { Incendio } from '../incendios/entities/incendio.entity'
import { auditRecord } from '../auditoria/auditoria.service'

type Ctx = { requestId: string; ip: string; ua: string; user?: { usuario_uuid?: string } | null }

export async function crearCierre(input: { incendio_uuid: string }, ctx: Ctx): Promise<{
  cierre: CierreOperaciones
  topografia: CierreTopografia
  superficie: CierreSuperficie
  tecnicas: CierreTecnicasExtincion
}> {
  const cierreRepo = AppDataSource.getRepository(CierreOperaciones)
  const topoRepo   = AppDataSource.getRepository(CierreTopografia)
  const supRepo    = AppDataSource.getRepository(CierreSuperficie)
  const tecRepo    = AppDataSource.getRepository(CierreTecnicasExtincion)
  const incRepo    = AppDataSource.getRepository(Incendio)

  const incendio = await incRepo.findOne({ where: { incendio_uuid: input.incendio_uuid, eliminado_en: IsNull() } })
  if (!incendio) {
    const e: any = new Error('Incendio no existe')
    e.status = 404; e.code = 'NOT_FOUND'
    throw e
  }

  // 1) Cierre general
  const cierreToCreate = cierreRepo.create({ incendio: { incendio_uuid: input.incendio_uuid } as any })
  const cierre: CierreOperaciones = await cierreRepo.save(cierreToCreate)

  // 2) Topografía (1:1 por incendio)
  let topo: CierreTopografia | null = await topoRepo.findOne({ where: { incendio_uuid: input.incendio_uuid, eliminado_en: IsNull() } })
  if (!topo) {
    const topoNew = topoRepo.create({
      incendio_uuid: input.incendio_uuid,
      incendio: { incendio_uuid: input.incendio_uuid } as any,
      plano_pct: '0',
      ondulado_pct: '0',
      quebrado_pct: '0'
    })
    topo = await topoRepo.save(topoNew)

    await auditRecord({
      tabla: 'cierre_topografia',
      registro_uuid: input.incendio_uuid,
      accion: 'INSERT',
      despues: { incendio_uuid: input.incendio_uuid, plano_pct: '0', ondulado_pct: '0', quebrado_pct: '0' },
      ctx
    })
  }

  let sup: CierreSuperficie | null = await supRepo.findOne({ where: { incendio_uuid: input.incendio_uuid, eliminado_en: IsNull() } })
  if (!sup) {
    const supDefaults: Record<string, string> = {
      bosque_pct: '0',
      matorral_pct: '0',
      pastizal_pct: '0',
      agricola_pct: '0',
      urbana_pct: '0'
    }
    const supNew = supRepo.create({
      incendio_uuid: input.incendio_uuid,
      incendio: { incendio_uuid: input.incendio_uuid } as any
    } as Partial<CierreSuperficie> as CierreSuperficie)

    for (const [k, v] of Object.entries(supDefaults)) {
      ;(supNew as any)[k] = v
    }

    sup = await supRepo.save(supNew)

    await auditRecord({
      tabla: 'cierre_superficie',
      registro_uuid: input.incendio_uuid,
      accion: 'INSERT',
      despues: { incendio_uuid: input.incendio_uuid, ...supDefaults },
      ctx
    })
  }

  let tec: CierreTecnicasExtincion | null = await tecRepo.findOne({ where: { incendio_uuid: input.incendio_uuid, eliminado_en: IsNull() } })
  if (!tec) {
    const tecDefaults: Record<string, string> = {
      ataque_directo_pct: '0',
      ataque_indirecto_pct: '0',
      contrafuego_pct: '0',
      vigilancia_pct: '0'
    }
    const tecNew = tecRepo.create({
      incendio_uuid: input.incendio_uuid,
      incendio: { incendio_uuid: input.incendio_uuid } as any
    } as Partial<CierreTecnicasExtincion> as CierreTecnicasExtincion)

    for (const [k, v] of Object.entries(tecDefaults)) {
      ;(tecNew as any)[k] = v
    }

    tec = await tecRepo.save(tecNew)

    await auditRecord({
      tabla: 'cierre_tecnicas_extincion',
      registro_uuid: input.incendio_uuid,
      accion: 'INSERT',
      despues: { incendio_uuid: input.incendio_uuid, ...tecDefaults },
      ctx
    })
  }

  const cierreUuid =
    (cierre as any).cierre_operaciones_uuid ??
    (cierre as any).cierre_uuid ??
    input.incendio_uuid

  await auditRecord({
    tabla: 'cierre_operaciones',
    registro_uuid: cierreUuid,
    accion: 'INSERT',
    despues: { cierre_uuid: cierreUuid, incendio_uuid: input.incendio_uuid },
    ctx
  })

  return { cierre, topografia: topo!, superficie: sup!, tecnicas: tec! }
}
