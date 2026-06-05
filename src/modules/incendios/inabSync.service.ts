import { AppDataSource } from '../../db/data-source'
import { Incendio } from './entities/incendio.entity'
import { EstadoIncendio } from '../catalogos/entities/estado-incendio.entity'

const INAB_API_URL = 'https://sig.inab.gob.gt/server/rest/services/Hosted/Monitoreo_de_Incendios_Forestales_resultados/FeatureServer/0/query'

export async function syncInabIncidents() {
  try {
    console.log('[INAB SYNC] Iniciando sincronización con API de ArcGIS de INAB...')

    // Obtener estado "REPORTADO" por defecto para llenar el not null, o "CONFIRMADO"
    const estadoRepo = AppDataSource.getRepository(EstadoIncendio)
    let estado = await estadoRepo.findOne({ where: { codigo: 'REPORTADO' } })
    if (!estado) {
      estado = await estadoRepo.createQueryBuilder('e').orderBy('e.orden', 'ASC').getOne()
    }
    if (!estado) {
      console.warn('[INAB SYNC] No hay estados de incendio disponibles. Cancelando.')
      return
    }

    const params = new URLSearchParams({
      where: '1=1',
      outFields: '*',
      f: 'json',
      returnGeometry: 'false'
    })

    const response = await fetch(`${INAB_API_URL}?${params.toString()}`)
    if (!response.ok) {
      throw new Error(`Error de red: ${response.status}`)
    }

    const data: any = await response.json()
    if (data.error) {
      throw new Error(data.error.message)
    }

    const features = data.features || []
    console.log(`[INAB SYNC] Se descargaron ${features.length} incendios de INAB.`)

    const incendioRepo = AppDataSource.getRepository(Incendio)

    let upsertCount = 0

    for (const feature of features) {
      const attr = feature.attributes
      if (!attr.objectid) continue

      // Extraer fechas si existen
      let fechaHora = null
      if (attr.fecha_hora_incendio) {
        fechaHora = new Date(attr.fecha_hora_incendio)
      }

      // Upsert basado en inab_objectid
      const existing = await incendioRepo.findOne({ where: { inab_objectid: attr.objectid } })

      if (existing) {
        // Actualizar
        existing.inab_globalid = attr.globalid
        existing.inab_tipo_incendio = attr.tipo_incendio
        existing.inab_estado_aviso = attr.estado_aviso
        existing.inab_coordenada_x = attr.coordenada_x
        existing.inab_coordenada_y = attr.coordenada_y
        existing.inab_departamento = attr.departamento
        existing.inab_municipio = attr.municipio
        existing.inab_region = attr.region_inab
        existing.inab_subregion = attr.subregion_inab
        existing.inab_institucion = attr.institucion
        existing.inab_reportado_por = attr.reportado_por
        existing.inab_fecha_hora = fechaHora
        existing.inab_link_googlemaps = attr.link_googlemaps

        // Sincronizar título y coordenadas nativas para que funcione el visor general
        existing.titulo = `INAB: Incendio en ${attr.municipio || 'desconocido'}`
        
        await incendioRepo.save(existing)
        upsertCount++
      } else {
        // Crear nuevo
        const nuevo = incendioRepo.create({
          inab_objectid: attr.objectid,
          inab_globalid: attr.globalid,
          inab_tipo_incendio: attr.tipo_incendio,
          inab_estado_aviso: attr.estado_aviso,
          inab_coordenada_x: attr.coordenada_x,
          inab_coordenada_y: attr.coordenada_y,
          inab_departamento: attr.departamento,
          inab_municipio: attr.municipio,
          inab_region: attr.region_inab,
          inab_subregion: attr.subregion_inab,
          inab_institucion: attr.institucion,
          inab_reportado_por: attr.reportado_por,
          inab_fecha_hora: fechaHora,
          inab_link_googlemaps: attr.link_googlemaps,

          titulo: `INAB: Incendio en ${attr.municipio || 'desconocido'}`,
          aprobado: true, // Auto aprobado porque viene del INAB
          requiere_aprobacion: false,
          estado_incendio: { estado_incendio_uuid: estado.estado_incendio_uuid } as any,
          // Falso creador (sistema) o dejar nulo si la DB lo permite (si la relacion no es obligatoria)
          // La entidad Incendio actualmente requiere 'creado_por', vamos a ver si se puede ignorar o buscar un admin
        })
        
        // Asignar un usuario por defecto si creado_por es NOT NULL (nuestro esquema pide creado_por).
        // Podríamos intentar obtener el primer admin:
        const { Usuario } = await import('../seguridad/entities/usuario.entity')
        const admin = await AppDataSource.getRepository(Usuario).findOne({ where: { is_admin: true } as any })
        if (admin) {
          nuevo.creado_por = admin as any
        } else {
           console.warn('[INAB SYNC] No se pudo encontrar un usuario para asignarlo como creador del reporte. El insert podría fallar.')
        }

        // Si hay coordenadas, crear el centroide para el mapa interno
        if (attr.coordenada_x && attr.coordenada_y) {
           (nuevo as any).centroide = {
              type: 'Point',
              coordinates: [attr.coordenada_x, attr.coordenada_y]
           }
        }

        await incendioRepo.save(nuevo)
        upsertCount++
      }
    }

    console.log(`[INAB SYNC] Completado. Se procesaron ${upsertCount} registros.`)
  } catch (error) {
    console.error('[INAB SYNC] Error:', error)
  }
}
