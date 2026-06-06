import { AppDataSource } from '../../db/data-source'
import { Incendio } from './entities/incendio.entity'
import { IncendioLocalizacion } from './entities/incendio-localizacion.entity'
import { IncendioResponsable } from './entities/incendio-responsable.entity'
import { IncendioControl } from './entities/incendio-control.entity'
import { FotoReporte } from './entities/foto-reporte.entity'
import { EstadoIncendio } from '../catalogos/entities/estado-incendio.entity'
import { Usuario } from '../seguridad/entities/usuario.entity'
import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { env } from 'process'

const INAB_API_URL = 'https://sig.inab.gob.gt/server/rest/services/Hosted/Monitoreo_de_Incendios_Forestales_resultados/FeatureServer/0/query'

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads')
const PUBLIC_BASE = env.MEDIA_BASE_URL ?? `http://localhost:${env.PORT || 4000}`

async function ensureUploadsDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

// La API entrega coordenada_x/y en proyección GTM (no sirven para una geometría 4326).
// El campo link_googlemaps trae el lat/lng real, p.ej:
// https://www.google.com/maps/place/15.0708,-89.6592
// Los nombres del INAB vienen como "san_andres_1704" / "alta_verapaz".
// Quitamos el sufijo numérico, cambiamos "_" por espacios y capitalizamos.
function prettyPlace(raw?: string | null): string {
  if (!raw) return 'desconocido'
  return String(raw)
    .replace(/_\d+\s*$/, '')
    .replace(/_/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
}

function parseLatLngFromLink(link?: string | null): { lat: number; lng: number } | null {
  if (!link) return null
  const m = link.match(/place\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
  if (!m) return null
  const lat = Number(m[1])
  const lng = Number(m[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export async function syncInabIncidents() {
  try {
    console.log('[INAB SYNC] Iniciando sincronización con API de ArcGIS de INAB...')

    // Estado por defecto (NOT NULL en incendios)
    const estadoRepo = AppDataSource.getRepository(EstadoIncendio)
    let estado = await estadoRepo.findOne({ where: { codigo: 'REPORTADO' } })
    if (!estado) {
      estado = await estadoRepo.createQueryBuilder('e').orderBy('e.orden', 'ASC').getOne()
    }
    if (!estado) {
      console.warn('[INAB SYNC] No hay estados de incendio disponibles. Cancelando.')
      return
    }

    // creado_por es NOT NULL: usamos el primer admin como autor de los reportes del INAB
    const admin = await AppDataSource.getRepository(Usuario).findOne({ where: { is_admin: true } as any })
    if (!admin) {
      console.warn('[INAB SYNC] No hay un usuario admin para asignar como creador. Cancelando.')
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
    const locRepo = AppDataSource.getRepository(IncendioLocalizacion)
    const respRepo = AppDataSource.getRepository(IncendioResponsable)
    const ctrlRepo = AppDataSource.getRepository(IncendioControl)

    let upsertCount = 0
    const objectIdToUuid = new Map<number, string>()

    for (const feature of features) {
      const attr = feature.attributes
      if (!attr?.objectid) continue

      const fechaHora = attr.fecha_hora_incendio ? new Date(attr.fecha_hora_incendio) : null
      const latLng = parseLatLngFromLink(attr.link_googlemaps)

      // ---- Incendio (padre) ----
      let incendio = await incendioRepo.findOne({ where: { inab_objectid: attr.objectid } })
      if (incendio) {
        incendio.inab_globalid = attr.globalid
        incendio.titulo = `INAB: Incendio en ${prettyPlace(attr.municipio)}`
      } else {
        incendio = incendioRepo.create({
          inab_objectid: attr.objectid,
          inab_globalid: attr.globalid,
          titulo: `INAB: Incendio en ${prettyPlace(attr.municipio)}`,
          aprobado: true, // Auto aprobado: viene del INAB
          requiere_aprobacion: false,
          estado_incendio: { estado_incendio_uuid: estado.estado_incendio_uuid } as any,
          creado_por: { usuario_uuid: admin.usuario_uuid } as any,
        })
      }

      // Centroide en 4326 a partir del lat/lng real (GeoJSON usa [lng, lat])
      if (latLng) {
        ;(incendio as any).centroide = { type: 'Point', coordinates: [latLng.lng, latLng.lat] }
      }

      const saved = await incendioRepo.save(incendio)

      // ---- Hijos: upsert explícito por incendio_uuid (no dependemos del cascade,
      //      que con PK compartida no persiste de forma fiable) ----
      await locRepo.save({
        incendio_uuid: saved.incendio_uuid,
        coordenada_x: attr.coordenada_x ?? null,
        coordenada_y: attr.coordenada_y ?? null,
        altitud: attr.altitud ?? null,
        zona: attr.zona ?? null,
        departamento: attr.departamento ?? null,
        municipio: attr.municipio ?? null,
        region_inab: attr.region_inab ?? null,
        subregion_inab: attr.subregion_inab ?? null,
        lugar_poblado: attr.aldea_lugar ?? null,
        finca: attr.finca ?? null,
      })

      await respRepo.save({
        incendio_uuid: saved.incendio_uuid,
        institucion: attr.institucion ?? null,
        otra_institucion: attr.institucion_otra ?? null,
        reportado_por: attr.reportado_por ?? null,
        telefono: attr.telefono != null ? String(attr.telefono) : null,
        medio_aviso: attr.forma_comunicacion ?? null,
        fecha_hora_aviso: fechaHora,
      })

      await ctrlRepo.save({
        incendio_uuid: saved.incendio_uuid,
        es_forestal: attr.tipo_incendio != null ? attr.tipo_incendio === 'Forestal' : null,
      })

      objectIdToUuid.set(attr.objectid, saved.incendio_uuid)
      upsertCount++
    }

    console.log(`[INAB SYNC] Completado. Se procesaron ${upsertCount} registros.`)

    // ---- Fotos: las imágenes vienen como attachments del feature service ----
    await syncInabAttachments(objectIdToUuid)
  } catch (error) {
    console.error('[INAB SYNC] Error:', error)
  }
}

// El feature service expone las fotos como attachments. Usamos queryAttachments
// por lotes para traer la URL pública de la primera imagen de cada incendio y la
// guardamos en fotos_reporte (que es de donde el front saca la portada).
async function syncInabAttachments(objectIdToUuid: Map<number, string>) {
  try {
    const fotoRepo = AppDataSource.getRepository(FotoReporte)
    const LAYER_BASE = INAB_API_URL.replace(/\/query$/, '')

    // URLs ya guardadas, para que el sync sea idempotente
    const existingInabUuids = new Set<string>(
      (await fotoRepo.find({ where: { credito: 'INAB' }, relations: ['incendio'] })).map((f) => f.incendio.incendio_uuid)
    )

    const allIds = Array.from(objectIdToUuid.keys())
    let fotoCount = 0

    await ensureUploadsDir()

    for (let i = 0; i < allIds.length; i += 100) {
      const chunk = allIds.slice(i, i + 100)
      try {
        const res = await fetch(
          `${LAYER_BASE}/queryAttachments?objectIds=${chunk.join(',')}&returnUrl=true&f=json`
        )
        if (!res.ok) continue
        const j: any = await res.json()
        for (const g of j.attachmentGroups || []) {
          const uuid = objectIdToUuid.get(g.parentObjectId)
          if (!uuid || existingInabUuids.has(uuid)) continue
          
          const img = (g.attachmentInfos || []).find((a: any) =>
            String(a.contentType || '').startsWith('image/')
          )
          if (!img?.url) continue
          
          try {
            // Descargar la imagen desde INAB
            const imgRes = await fetch(img.url)
            if (!imgRes.ok) continue
            const imgBuffer = await imgRes.arrayBuffer()
            
            const filename = `${uuid}-inab-${Date.now()}.webp`
            
            // Comprimir la imagen antes de guardarla localmente
            const compressedBuffer = await sharp(Buffer.from(imgBuffer))
              .resize(1080, 1080, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: 80 })
              .toBuffer()

            await fs.writeFile(path.join(UPLOAD_DIR, filename), compressedBuffer)
            const publicUrl = `${PUBLIC_BASE}/uploads/${filename}`

            await fotoRepo.save({
              incendio: { incendio_uuid: uuid } as any,
              url: publicUrl,
              credito: 'INAB',
            })
            
            existingInabUuids.add(uuid)
            fotoCount++
          } catch (fetchErr) {
            console.warn(`[INAB SYNC] Error descargando/comprimiendo foto para ${uuid}:`, fetchErr)
          }
        }
      } catch (e) {
        console.warn(`[INAB SYNC] Error en lote de attachments (offset ${i}):`, e)
      }
    }

    console.log(`[INAB SYNC] Fotos locales nuevas insertadas y comprimidas: ${fotoCount}`)
  } catch (error) {
    console.error('[INAB SYNC] Error sincronizando fotos:', error)
  }
}
