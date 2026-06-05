// src/db/seeds/171004_seed_inicial.ts
import 'reflect-metadata'
import { AppDataSource } from '../data-source'

async function tableExists(q: any, table: string) {
  const r = await q.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1 LIMIT 1`,
    [table]
  )
  return r.length > 0
}

async function upsertByNombre(q: any, table: string, values: string[]) {
  if (!(await tableExists(q, table))) return
  for (const v of values) {
    await q.query(
      `INSERT INTO ${table} (nombre) VALUES ($1)
       ON CONFLICT (nombre) DO NOTHING;`,
      [v]
    )
  }
}

async function main() {
  await AppDataSource.initialize()
  const q = AppDataSource.createQueryRunner()

  await q.connect()
  await q.startTransaction()
  try {
    // ===== ROLES
    await q.query(`
      INSERT INTO roles (nombre, descripcion) VALUES
      ('ADMIN','Administrador'),
      ('OPERADOR','Operador de campo'),
      ('ANALISTA','Analista'),
      ('USUARIO','Usuario')
      ON CONFLICT (nombre) DO NOTHING;
    `)


    // ===== ESTADOS (códigos usados por los endpoints)
    await q.query(`
      INSERT INTO estado_incendio (codigo, nombre, orden) VALUES
      ('REPORTADO', 'Reportado (INAB)', 0),
      ('INFO_FALSA','Información falsa', 1),
      ('ACTIVO','Incendio activo', 2),
      ('CIERRE','Cierre de operaciones', 3)
      ON CONFLICT (codigo) DO NOTHING;
    `)

    // ===== MEDIOS (para reportes e incendios)
    await upsertByNombre(q, 'medios', [
      'TELÉFONO','WHATSAPP','RADIO','RED_SOCIAL','EMAIL','APP','PRESENCIAL','911'
    ])

    // ===== INSTITUCIONES base
    await upsertByNombre(q, 'instituciones', [
      'CONRED','INAB','MARN','Municipalidad',
      'Bomberos Voluntarios','Bomberos Municipales','Ejército de Guatemala'
    ])

    // ===== DEPARTAMENTOS Y MUNICIPIOS
    const hasDepartamentos = await tableExists(q, 'departamentos')
const hasMunicipios = await tableExists(q, 'municipios')
if (hasDepartamentos && hasMunicipios) {
  // Inserta el departamento si no existe
  await q.query(
    `INSERT INTO departamentos (nombre)
     SELECT $1
     WHERE NOT EXISTS (SELECT 1 FROM departamentos WHERE nombre = $1);`,
    ['Huehuetenango']
  )

  // Obtén su UUID
  const depRes = await q.query(
    `SELECT departamento_uuid FROM departamentos WHERE nombre = $1 LIMIT 1`,
    ['Huehuetenango']
  )
  const deptoUuid = depRes?.[0]?.departamento_uuid

  if (deptoUuid) {
    const municipiosHuehue = [
      'Huehuetenango',
      'Chiantla',
      'Malacatancito',
      'Cuilco',
      'Nentón',
      'San Pedro Necta',
      'San Juan Ixcoy',
      'San Antonio Huista',
      'San Sebastián Huehuetenango',
      'Santa Bárbara',
      'La Libertad',
      'La Democracia',
      'San Miguel Acatán',
      'San Rafael La Independencia',
      'Todos Santos Cuchumatán',
      'San Juan Atitán',
      'Santa Eulalia',
      'San Mateo Ixtatán',
      'Colotenango',
      'San Sebastián Coatán',
      'Santa Cruz Barillas',
      'San Pedro Soloma',
      'San Ildefonso Ixtahuacán',
      'Jacaltenango',
      'San Rafael Petzal',
      'San Gaspar Ixchil',
      'Santiago Chimaltenango',
      'Santa Ana Huista',
      'Tectitán',
      'Concepción Huista',
      'San Juan Huista',
      'Unión Cantinil',
      'Aguacatán',
    ]

    for (const m of municipiosHuehue) {
      await q.query(
        `INSERT INTO municipios (departamento_uuid, nombre)
         SELECT $1, $2
         WHERE NOT EXISTS (
           SELECT 1 FROM municipios WHERE departamento_uuid = $1 AND nombre = $2
         );`,
        [deptoUuid, m]
      )
    }
  }
}

    // ===== ADMIN por defecto (requiere pgcrypto)
    await q.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)
    await q.query(`
      WITH r AS (SELECT rol_uuid FROM roles WHERE nombre='ADMIN'),
           i AS (SELECT institucion_uuid FROM instituciones WHERE nombre='CONRED')
      INSERT INTO usuarios (nombre, apellido, email, password_hash, rol_uuid, institucion_uuid, is_admin)
      SELECT 'Admin','Principal','admin@demo.local', crypt('Admin123!', gen_salt('bf')),
             r.rol_uuid, i.institucion_uuid, true
      FROM r, i
      WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='admin@demo.local');
    `)

    // ===== INCENDIOS FICTICIOS PARA EL LISTADO "SIN APROBAR"
    await q.query(`DELETE FROM incendios;`)

    await q.query(`
      WITH u AS (SELECT usuario_uuid FROM usuarios WHERE email='admin@demo.local' LIMIT 1),
           e AS (SELECT estado_incendio_uuid FROM estado_incendio WHERE codigo='REPORTADO' LIMIT 1),
           m AS (SELECT municipio_uuid FROM municipios WHERE nombre='Huehuetenango' LIMIT 1),
           ins AS (
             INSERT INTO incendios (titulo, descripcion, centroide, requiere_aprobacion, aprobado, creado_por_uuid, estado_incendio_uuid, inab_objectid)
             SELECT 'Incendio forestal cerro Cruz Quemada', 'Se reporta una gran columna de humo visible desde la carretera', ST_SetSRID(ST_MakePoint(-91.472, 15.319), 4326), true, false, u.usuario_uuid, e.estado_incendio_uuid, 1001
             FROM u, e
             WHERE NOT EXISTS (SELECT 1 FROM incendios WHERE titulo='Incendio forestal cerro Cruz Quemada')
             RETURNING incendio_uuid
           ),
           loc AS (
             INSERT INTO incendio_localizaciones (incendio_uuid, municipio_uuid)
             SELECT ins.incendio_uuid, m.municipio_uuid FROM ins, m
           )
      INSERT INTO incendio_responsables (incendio_uuid, reportado_por, institucion)
      SELECT ins.incendio_uuid, 'Vecino Anónimo', 'INAB' FROM ins;
    `)

    await q.query(`
      WITH u AS (SELECT usuario_uuid FROM usuarios WHERE email='admin@demo.local' LIMIT 1),
           e AS (SELECT estado_incendio_uuid FROM estado_incendio WHERE codigo='REPORTADO' LIMIT 1),
           m AS (SELECT municipio_uuid FROM municipios WHERE nombre='Chiantla' LIMIT 1),
           ins AS (
             INSERT INTO incendios (titulo, descripcion, centroide, requiere_aprobacion, aprobado, creado_por_uuid, estado_incendio_uuid)
             SELECT 'Incendio cerca de Los Cuchumatanes', 'El fuego avanza rápidamente hacia la parte boscosa', ST_SetSRID(ST_MakePoint(-91.45, 15.35), 4326), true, false, u.usuario_uuid, e.estado_incendio_uuid
             FROM u, e
             WHERE NOT EXISTS (SELECT 1 FROM incendios WHERE titulo='Incendio cerca de Los Cuchumatanes')
             RETURNING incendio_uuid
           ),
           loc AS (
             INSERT INTO incendio_localizaciones (incendio_uuid, municipio_uuid)
             SELECT ins.incendio_uuid, m.municipio_uuid FROM ins, m
           )
      INSERT INTO incendio_responsables (incendio_uuid, reportado_por)
      SELECT ins.incendio_uuid, 'Guardabosques local' FROM ins;
    `)

    // ===== INCENDIOS FICTICIOS APROBADOS (PARA EL MAPA)
    await q.query(`
      WITH u AS (SELECT usuario_uuid FROM usuarios WHERE email='admin@demo.local' LIMIT 1),
           e AS (SELECT estado_incendio_uuid FROM estado_incendio WHERE codigo='ACTIVO' LIMIT 1),
           m AS (SELECT municipio_uuid FROM municipios WHERE nombre='Huehuetenango' LIMIT 1),
           ins AS (
             INSERT INTO incendios (titulo, descripcion, centroide, requiere_aprobacion, aprobado, aprobado_en, aprobado_por, creado_por_uuid, estado_incendio_uuid, inab_objectid)
             SELECT 'Incendio Finca El Peñasco', 'Incendio forestal activo, brigadas de CONRED en camino', ST_SetSRID(ST_MakePoint(-91.46, 15.30), 4326), false, true, NOW(), u.usuario_uuid, u.usuario_uuid, e.estado_incendio_uuid, 1002
             FROM u, e
             WHERE NOT EXISTS (SELECT 1 FROM incendios WHERE titulo='Incendio Finca El Peñasco')
             RETURNING incendio_uuid
           ),
           loc AS (
             INSERT INTO incendio_localizaciones (incendio_uuid, municipio_uuid)
             SELECT ins.incendio_uuid, m.municipio_uuid FROM ins, m
           ),
           con AS (
             INSERT INTO incendio_controles (incendio_uuid, es_forestal)
             SELECT ins.incendio_uuid, false FROM ins
           )
      INSERT INTO incendio_responsables (incendio_uuid, reportado_por, institucion)
      SELECT ins.incendio_uuid, 'Reporte Ciudadano', 'Bomberos Voluntarios' FROM ins;
    `)

    await q.query(`
      WITH u AS (SELECT usuario_uuid FROM usuarios WHERE email='admin@demo.local' LIMIT 1),
           e AS (SELECT estado_incendio_uuid FROM estado_incendio WHERE codigo='ACTIVO' LIMIT 1),
           m AS (SELECT municipio_uuid FROM municipios WHERE nombre='Malacatancito' LIMIT 1),
           ins AS (
             INSERT INTO incendios (titulo, descripcion, centroide, requiere_aprobacion, aprobado, aprobado_en, aprobado_por, creado_por_uuid, estado_incendio_uuid)
             SELECT 'Incendio en la cuenca del río', 'Fuego afecta áreas cercanas al río, riesgo para cultivos', ST_SetSRID(ST_MakePoint(-91.50, 15.25), 4326), false, true, NOW(), u.usuario_uuid, u.usuario_uuid, e.estado_incendio_uuid
             FROM u, e
             WHERE NOT EXISTS (SELECT 1 FROM incendios WHERE titulo='Incendio en la cuenca del río')
             RETURNING incendio_uuid
           ),
           loc AS (
             INSERT INTO incendio_localizaciones (incendio_uuid, municipio_uuid)
             SELECT ins.incendio_uuid, m.municipio_uuid FROM ins, m
           )
      INSERT INTO incendio_responsables (incendio_uuid, reportado_por)
      SELECT ins.incendio_uuid, 'Bomberos Voluntarios' FROM ins;
    `)

    // ===== FOTOS PARA LOS INCENDIOS =====
    await q.query(`
      INSERT INTO fotos_reporte (incendio_uuid, url, credito)
      SELECT i.incendio_uuid, 'https://images.unsplash.com/photo-1602979607519-5eb42322cb00?auto=format&fit=crop&w=800&q=80', 'Unsplash'
      FROM incendios i
      WHERE i.titulo = 'Incendio forestal cerro Cruz Quemada'
      AND NOT EXISTS (SELECT 1 FROM fotos_reporte f WHERE f.incendio_uuid = i.incendio_uuid);
    `)

    await q.query(`
      INSERT INTO fotos_reporte (incendio_uuid, url, credito)
      SELECT i.incendio_uuid, 'https://images.unsplash.com/photo-1596788068800-4786bc67e231?auto=format&fit=crop&w=800&q=80', 'Unsplash'
      FROM incendios i
      WHERE i.titulo = 'Incendio cerca de Los Cuchumatanes'
      AND NOT EXISTS (SELECT 1 FROM fotos_reporte f WHERE f.incendio_uuid = i.incendio_uuid);
    `)

    await q.query(`
      INSERT INTO fotos_reporte (incendio_uuid, url, credito)
      SELECT i.incendio_uuid, 'https://images.unsplash.com/photo-1542614488-82ab8706d859?auto=format&fit=crop&w=800&q=80', 'Unsplash'
      FROM incendios i
      WHERE i.titulo = 'Incendio Finca El Peñasco'
      AND NOT EXISTS (SELECT 1 FROM fotos_reporte f WHERE f.incendio_uuid = i.incendio_uuid);
    `)

    await q.query(`
      INSERT INTO fotos_reporte (incendio_uuid, url, credito)
      SELECT i.incendio_uuid, 'https://images.unsplash.com/photo-1447012984180-877f6b986161?auto=format&fit=crop&w=800&q=80', 'Unsplash'
      FROM incendios i
      WHERE i.titulo = 'Incendio en la cuenca del río'
      AND NOT EXISTS (SELECT 1 FROM fotos_reporte f WHERE f.incendio_uuid = i.incendio_uuid);
    `)

    await q.commitTransaction()
    console.log('Seed OK ✅ (roles, estados, medios, instituciones, Huehuetenango y admin)')
  } catch (e) {
    await q.rollbackTransaction()
    console.error('Seed FAILED', e)
  } finally {
    await q.release()
    await AppDataSource.destroy()
  }
}

main()
