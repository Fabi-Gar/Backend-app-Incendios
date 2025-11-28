// src/db/seeds/172000_seed_plantilla_cierre.ts
import 'reflect-metadata'
import { AppDataSource } from '../data-source'

async function tableExists(q: any, table: string) {
  const r = await q.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1`,
    [table]
  )
  return r.length > 0
}

async function main() {
  await AppDataSource.initialize()
  const q = AppDataSource.createQueryRunner()

  await q.connect()
  await q.startTransaction()
  try {
    // Verificar que las tablas del nuevo sistema existan
    const hasPlantillas = await tableExists(q, 'cierre_plantillas')
    const hasSecciones = await tableExists(q, 'cierre_secciones')
    const hasCampos = await tableExists(q, 'cierre_campos')

    if (!hasPlantillas || !hasSecciones || !hasCampos) {
      console.log('⚠️  Tablas de cierre dinámico no existen. Ejecute las migraciones primero.')
      await q.rollbackTransaction()
      return
    }

    // Obtener admin para creado_por
    const adminRes = await q.query(
      `SELECT usuario_uuid FROM usuarios WHERE is_admin = true LIMIT 1`
    )
    const adminUuid = adminRes?.[0]?.usuario_uuid

    if (!adminUuid) {
      console.log('⚠️  No se encontró usuario admin. Ejecute el seed inicial primero.')
      await q.rollbackTransaction()
      return
    }

    // Verificar si ya existe una plantilla activa
    const existingActive = await q.query(
      `SELECT plantilla_uuid FROM cierre_plantillas WHERE activa = true AND eliminado_en IS NULL LIMIT 1`
    )

    if (existingActive.length > 0) {
      console.log('ℹ️  Ya existe una plantilla activa. No se creará otra.')
      await q.commitTransaction()
      return
    }

    // ===== 1. CREAR PLANTILLA BASE =====
    const plantillaRes = await q.query(
      `INSERT INTO cierre_plantillas (nombre, descripcion, activa, version, creado_por_uuid)
       VALUES ($1, $2, true, 1, $3)
       RETURNING plantilla_uuid`,
      [
        'Plantilla de Cierre Estándar',
        'Plantilla por defecto para el cierre de operaciones de incendios forestales en Guatemala',
        adminUuid
      ]
    )
    const plantillaUuid = plantillaRes[0].plantilla_uuid

    console.log(`✅ Plantilla creada: ${plantillaUuid}`)

    // ===== 2. CREAR SECCIONES =====
    const secciones: Record<string, string> = {}

    const seccionesData = [
      { key: 'general', nombre: 'Datos Generales', descripcion: 'Información general del incendio', orden: 1, icono: 'info-circle' },
      { key: 'superficie', nombre: 'Superficie Afectada', descripcion: 'Área y vegetación afectada', orden: 2, icono: 'map' },
      { key: 'composicion', nombre: 'Composición y Tipo', descripcion: 'Tipo de incendio y composición', orden: 3, icono: 'fire' },
      { key: 'propiedad', nombre: 'Propiedad', descripcion: 'Tipo de propiedad afectada', orden: 4, icono: 'home' },
      { key: 'topografia', nombre: 'Topografía', descripcion: 'Características del terreno', orden: 5, icono: 'mountain' },
      { key: 'meteorologia', nombre: 'Meteorología', descripcion: 'Condiciones meteorológicas', orden: 6, icono: 'cloud' },
      { key: 'causas', nombre: 'Causas', descripcion: 'Causas del incendio', orden: 7, icono: 'question-circle' },
      { key: 'recursos', nombre: 'Recursos Utilizados', descripcion: 'Personal, instituciones y medios empleados', orden: 8, icono: 'users' },
      { key: 'tecnicas', nombre: 'Técnicas de Extinción', descripcion: 'Métodos utilizados para extinguir el incendio', orden: 9, icono: 'tools' },
      { key: 'abastos', nombre: 'Abastos', descripcion: 'Suministros proporcionados', orden: 10, icono: 'box' }
    ]

    for (const sec of seccionesData) {
      const secRes = await q.query(
        `INSERT INTO cierre_secciones (plantilla_uuid, nombre, descripcion, orden, icono)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING seccion_uuid`,
        [plantillaUuid, sec.nombre, sec.descripcion, sec.orden, sec.icono]
      )
      secciones[sec.key] = secRes[0].seccion_uuid
    }

    console.log(`✅ ${seccionesData.length} secciones creadas`)

    // ===== 3. CREAR CAMPOS =====
    let campoCount = 0

    // 3.1 DATOS GENERALES
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, placeholder)
       VALUES
       ($1, 'Fecha de inicio', 'Fecha y hora en que inició el incendio', 'datetime', 1, true, null),
       ($1, 'Fecha de control', 'Fecha y hora en que se controló el incendio', 'datetime', 2, false, null),
       ($1, 'Fecha de extinción', 'Fecha y hora de extinción total', 'datetime', 3, false, null),
       ($1, 'Duración (horas)', 'Duración total del incendio en horas', 'number', 4, false, null),
       ($1, 'Observaciones generales', 'Notas adicionales sobre el incendio', 'textarea', 5, false, 'Ingrese cualquier observación relevante')`,
      [secciones.general]
    )
    campoCount += 5

    // 3.2 SUPERFICIE AFECTADA
    const superficieCampoRes = await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, unidad, validaciones)
       VALUES
       ($1, 'Superficie total afectada', 'Área total afectada por el incendio', 'number', 1, true, 'hectáreas', '{"min": 0, "step": 0.01}')
       RETURNING campo_uuid`,
      [secciones.superficie]
    )
    const superficiePadreUuid = superficieCampoRes[0].campo_uuid
    campoCount += 1

    // Sub-campos de superficie
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, campo_padre_uuid, nombre, tipo, orden, requerido, unidad, validaciones)
       VALUES
       ($1, $2, 'Vegetación arbórea', 'number', 1, false, 'hectáreas', '{"min": 0, "step": 0.01}'),
       ($1, $2, 'Vegetación arbustiva', 'number', 2, false, 'hectáreas', '{"min": 0, "step": 0.01}'),
       ($1, $2, 'Vegetación herbácea', 'number', 3, false, 'hectáreas', '{"min": 0, "step": 0.01}'),
       ($1, $2, 'Hojarasca', 'number', 4, false, 'hectáreas', '{"min": 0, "step": 0.01}'),
       ($1, $2, 'Suelo desnudo', 'number', 5, false, 'hectáreas', '{"min": 0, "step": 0.01}')`,
      [secciones.superficie, superficiePadreUuid]
    )
    campoCount += 5

    // 3.3 COMPOSICIÓN Y TIPO
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, opciones)
       VALUES
       ($1, 'Tipo de incendio', 'Clasificación del tipo de incendio (puede seleccionar múltiples tipos con porcentaje)', 'multiselect', 1, true,
        '[
          {"value":"rastrero","label":"Rastrero (fuego superficial)","requiresPercentage":true,"percentageLabel":"% del área"},
          {"value":"copas","label":"De copas (fuego aéreo)","requiresPercentage":true,"percentageLabel":"% del área"},
          {"value":"subterraneo","label":"Subterráneo (fuego de suelo)","requiresPercentage":true,"percentageLabel":"% del área"}
        ]'::jsonb),
       ($1, 'Intensidad', 'Nivel de intensidad del incendio', 'select', 2, false,
        '[{"value":"baja","label":"Baja"},{"value":"media","label":"Media"},{"value":"alta","label":"Alta"}]'::jsonb)`,
      [secciones.composicion]
    )
    campoCount += 2

    // 3.4 PROPIEDAD
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, opciones)
       VALUES
       ($1, 'Tipo de propiedad', 'Clasificación de la propiedad afectada', 'select', 1, true,
        '[{"value":"privada","label":"Privada"},{"value":"publica","label":"Pública"},{"value":"comunal","label":"Comunal"},{"value":"ejidal","label":"Ejidal"},{"value":"protegida","label":"Área protegida"},{"value":"derecho_via","label":"Derecho de vía"}]'::jsonb),
       ($1, 'Nombre del propietario', 'Nombre del propietario o responsable', 'text', 2, false, null)`,
      [secciones.propiedad]
    )
    campoCount += 2

    // 3.5 TOPOGRAFÍA
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, tipo, orden, requerido, unidad, validaciones)
       VALUES
       ($1, 'Pendiente promedio', 'percentage', 1, false, '%', '{"min": 0, "max": 100}'),
       ($1, 'Altitud mínima', 'number', 2, false, 'msnm', '{"min": 0}'),
       ($1, 'Altitud máxima', 'number', 3, false, 'msnm', '{"min": 0}'),
       ($1, 'Orientación predominante', 'select', 4, false, null, null)`,
      [secciones.topografia]
    )
    // Agregar opciones para orientación
    await q.query(
      `UPDATE cierre_campos
       SET opciones = '[{"value":"N","label":"Norte"},{"value":"NE","label":"Noreste"},{"value":"E","label":"Este"},{"value":"SE","label":"Sureste"},{"value":"S","label":"Sur"},{"value":"SO","label":"Suroeste"},{"value":"O","label":"Oeste"},{"value":"NO","label":"Noroeste"}]'::jsonb
       WHERE seccion_uuid = $1 AND nombre = 'Orientación predominante'`,
      [secciones.topografia]
    )
    campoCount += 4

    // 3.6 METEOROLOGÍA
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, tipo, orden, requerido, unidad, validaciones)
       VALUES
       ($1, 'Temperatura promedio', 'number', 1, false, '°C', '{"step": 0.1}'),
       ($1, 'Humedad relativa promedio', 'percentage', 2, false, '%', '{"min": 0, "max": 100}'),
       ($1, 'Velocidad del viento', 'number', 3, false, 'km/h', '{"min": 0, "step": 0.1}'),
       ($1, 'Dirección del viento', 'select', 4, false, null, null),
       ($1, 'Precipitación', 'number', 5, false, 'mm', '{"min": 0, "step": 0.1}'),
       ($1, 'Condiciones especiales', 'textarea', 6, false, null, null)`,
      [secciones.meteorologia]
    )
    // Agregar opciones para dirección del viento
    await q.query(
      `UPDATE cierre_campos
       SET opciones = '[{"value":"N","label":"Norte"},{"value":"NE","label":"Noreste"},{"value":"E","label":"Este"},{"value":"SE","label":"Sureste"},{"value":"S","label":"Sur"},{"value":"SO","label":"Suroeste"},{"value":"O","label":"Oeste"},{"value":"NO","label":"Noroeste"}]'::jsonb
       WHERE seccion_uuid = $1 AND nombre = 'Dirección del viento'`,
      [secciones.meteorologia]
    )
    campoCount += 6

    // 3.7 CAUSAS
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, opciones)
       VALUES
       ($1, 'Causa principal', 'Causa identificada del incendio', 'select', 1, true,
        '[{"value":"quema_agricola","label":"Quema agrícola"},{"value":"fogata","label":"Fogata"},{"value":"colilla","label":"Colilla de cigarro"},{"value":"quema_basura","label":"Quema de basura"},{"value":"quema_pecuaria","label":"Quema pecuaria"},{"value":"rayo","label":"Rayo"},{"value":"intencional","label":"Intencional"},{"value":"desconocida","label":"Desconocida"}]'::jsonb),
       ($1, 'Iniciado junto a', 'Lugar cercano donde inició', 'multiselect', 2, false,
        '[{"value":"carretera","label":"Carretera"},{"value":"cultivo","label":"Cultivo"},{"value":"basurero","label":"Basurero"},{"value":"vivienda","label":"Vivienda"},{"value":"bosque","label":"Área boscosa"},{"value":"electrico","label":"Tendido eléctrico"},{"value":"ribera","label":"Riberas/Quebradas"}]'::jsonb),
       ($1, 'Descripción de la causa', 'Detalles adicionales sobre la causa', 'textarea', 3, false, null)`,
      [secciones.causas]
    )
    campoCount += 3

    // 3.8 RECURSOS UTILIZADOS
    const recursosPersonalRes = await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, validaciones)
       VALUES
       ($1, 'Personal total', 'Total de personas que participaron', 'number', 1, false, '{"min": 0, "step": 1}')
       RETURNING campo_uuid`,
      [secciones.recursos]
    )
    const personalPadreUuid = recursosPersonalRes[0].campo_uuid
    campoCount += 1

    // Sub-campos de personal
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, campo_padre_uuid, nombre, tipo, orden, requerido, validaciones)
       VALUES
       ($1, $2, 'Bomberos', 'number', 1, false, '{"min": 0, "step": 1}'),
       ($1, $2, 'Militares', 'number', 2, false, '{"min": 0, "step": 1}'),
       ($1, $2, 'Personal CONRED', 'number', 3, false, '{"min": 0, "step": 1}'),
       ($1, $2, 'Personal INAB', 'number', 4, false, '{"min": 0, "step": 1}'),
       ($1, $2, 'Voluntarios', 'number', 5, false, '{"min": 0, "step": 1}'),
       ($1, $2, 'Otros', 'number', 6, false, '{"min": 0, "step": 1}')`,
      [secciones.recursos, personalPadreUuid]
    )
    campoCount += 6

    // Instituciones participantes
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, opciones)
       VALUES
       ($1, 'Instituciones participantes', 'Instituciones que apoyaron', 'multiselect', 2, false,
        '[{"value":"conred","label":"CONRED"},{"value":"inab","label":"INAB"},{"value":"marn","label":"MARN"},{"value":"municipalidad","label":"Municipalidad"},{"value":"bomberos_vol","label":"Bomberos Voluntarios"},{"value":"bomberos_mun","label":"Bomberos Municipales"},{"value":"ejercito","label":"Ejército de Guatemala"}]'::jsonb)`,
      [secciones.recursos]
    )
    campoCount += 1

    // Medios terrestres (con cantidad)
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, opciones)
       VALUES
       ($1, 'Medios terrestres', 'Vehículos y equipos terrestres utilizados', 'multiselect', 3, false,
        '[
          {"value":"pickup","label":"Pick-up","requiresQuantity":true,"quantityLabel":"Cantidad de pick-ups"},
          {"value":"camion","label":"Camión","requiresQuantity":true,"quantityLabel":"Cantidad de camiones"},
          {"value":"ambulancia","label":"Ambulancia","requiresQuantity":true,"quantityLabel":"Cantidad de ambulancias"},
          {"value":"microbus","label":"Microbús","requiresQuantity":true,"quantityLabel":"Cantidad de microbuses"},
          {"value":"motobomba","label":"Motobomba","requiresQuantity":true,"quantityLabel":"Cantidad de motobombas"},
          {"value":"cisterna","label":"Cisterna","requiresQuantity":true,"quantityLabel":"Cantidad de cisternas"},
          {"value":"motocicleta","label":"Motocicleta","requiresQuantity":true,"quantityLabel":"Cantidad de motocicletas"},
          {"value":"rescate","label":"Vehículo de rescate","requiresQuantity":true,"quantityLabel":"Cantidad de vehículos"}
        ]'::jsonb)`,
      [secciones.recursos]
    )
    campoCount += 1

    // Medios aéreos (con cantidad)
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, opciones)
       VALUES
       ($1, 'Medios aéreos', 'Aeronaves utilizadas', 'multiselect', 4, false,
        '[
          {"value":"avion_sobrevuelo","label":"Avión de sobrevuelo","requiresQuantity":true,"quantityLabel":"Cantidad de aviones"},
          {"value":"avion_cisterna","label":"Avión cisterna","requiresQuantity":true,"quantityLabel":"Cantidad de aviones"},
          {"value":"helicoptero_helibalde","label":"Helicóptero con helibalde","requiresQuantity":true,"quantityLabel":"Cantidad de helicópteros"},
          {"value":"helicoptero_monitoreo","label":"Helicóptero de monitoreo","requiresQuantity":true,"quantityLabel":"Cantidad de helicópteros"}
        ]'::jsonb)`,
      [secciones.recursos]
    )
    campoCount += 1

    // Medios acuáticos (con cantidad)
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, opciones)
       VALUES
       ($1, 'Medios acuáticos', 'Embarcaciones utilizadas', 'multiselect', 5, false,
        '[
          {"value":"lancha","label":"Lancha","requiresQuantity":true,"quantityLabel":"Cantidad de lanchas"},
          {"value":"bote","label":"Bote","requiresQuantity":true,"quantityLabel":"Cantidad de botes"},
          {"value":"otro","label":"Otro","requiresQuantity":true,"quantityLabel":"Cantidad"}
        ]'::jsonb)`,
      [secciones.recursos]
    )
    campoCount += 1

    // 3.9 TÉCNICAS DE EXTINCIÓN
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, opciones)
       VALUES
       ($1, 'Técnicas empleadas', 'Métodos utilizados para extinguir', 'multiselect', 1, false,
        '[{"value":"ataque_directo","label":"Ataque directo"},{"value":"ataque_indirecto","label":"Ataque indirecto"},{"value":"control_natural","label":"Control natural"}]'::jsonb),
       ($1, 'Descripción de técnicas', 'Detalles sobre las técnicas aplicadas', 'textarea', 2, false, null)`,
      [secciones.tecnicas]
    )
    campoCount += 2

    // 3.10 ABASTOS
    await q.query(
      `INSERT INTO cierre_campos (seccion_uuid, nombre, descripcion, tipo, orden, requerido, opciones)
       VALUES
       ($1, 'Suministros proporcionados', 'Abastos entregados al personal', 'multiselect', 1, false,
        '[{"value":"raciones_frias","label":"Raciones frías"},{"value":"incaparina","label":"Incaparina"},{"value":"agua","label":"Agua"},{"value":"raciones_calientes","label":"Raciones calientes"}]'::jsonb),
       ($1, 'Cantidad de personas abastecidas', 'Número de personas que recibieron suministros', 'number', 2, false, null),
       ($1, 'Observaciones de abastos', 'Detalles adicionales sobre suministros', 'textarea', 3, false, null)`,
      [secciones.abastos]
    )
    campoCount += 3

    console.log(`✅ ${campoCount} campos creados`)

    await q.commitTransaction()
    console.log('🎉 Seed de plantilla de cierre completado exitosamente!')
    console.log(`   - Plantilla UUID: ${plantillaUuid}`)
    console.log(`   - Secciones: ${seccionesData.length}`)
    console.log(`   - Campos: ${campoCount}`)
  } catch (e) {
    await q.rollbackTransaction()
    console.error('❌ Seed de plantilla FAILED', e)
    throw e
  } finally {
    await q.release()
    await AppDataSource.destroy()
  }
}

main()
