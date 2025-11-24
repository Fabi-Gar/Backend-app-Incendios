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
      ('INFO_FALSA','Información falsa', 0),
      ('ACTIVO','Incendio activo', 1),
      ('CIERRE','Cierre de operaciones', 2)
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

    // ===== CATÁLOGOS de cierre y soporte (todos por nombre)
    await upsertByNombre(q, 'tipos_incendio', ['Rastrero','De copas','Subterráneo'])

    await upsertByNombre(q, 'tipo_propiedad', [
      'Privada','Pública','Comunal','Ejidal','Área protegida','Derecho de vía'
    ])

    await upsertByNombre(q, 'causas_catalogo', [
      'Quema agrícola','Fogata','Colilla de cigarro','Quema de basura',
      'Quema pecuaria','Rayo','Intencional','Desconocida'
    ])

    await upsertByNombre(q, 'iniciado_junto_a_catalogo', [
      'Carretera','Cultivo','Basurero','Vivienda','Área boscosa',
      'Tendido eléctrico','Riberas/Quebradas'
    ])

    await upsertByNombre(q, 'medios_aereos_catalogo', [
      'Avión de sobrevuelo','Avión cisterna','Helicóptero con helibalde','Helicóptero de monitoreo'
    ])

    await upsertByNombre(q, 'medios_terrestres_catalogo', [
      'Pick-up','Camión','Ambulancia','Microbús','Motobomba','Cisterna','Motocicleta','Vehículo de rescate'
    ])

    await upsertByNombre(q, 'medios_acuaticos_catalogo', ['Lancha','Otro'])

    await upsertByNombre(q, 'abastos_catalogo', [
      'Raciones frías','Incaparina','Agua','Raciones calientes'
    ])

    // (Opcional) Si algún día agregas este catálogo, quedará poblado automáticamente:
    await upsertByNombre(q, 'tecnicas_extincion_catalogo', [
      'Ataque directo','Ataque indirecto','Control natural'
    ])

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

    // ===== ADMIN por defecto (requiere pgcrypto en migraciones)
    await q.query(`
      WITH r AS (SELECT rol_uuid FROM roles WHERE nombre='ADMIN'),
           i AS (SELECT institucion_uuid FROM instituciones WHERE nombre='CONRED')
      INSERT INTO usuarios (nombre, apellido, email, password_hash, rol_uuid, institucion_uuid, is_admin)
      SELECT 'Admin','Principal','admin@demo.local', crypt('Admin123!', gen_salt('bf')),
             r.rol_uuid, i.institucion_uuid, true
      FROM r, i
      WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE email='admin@demo.local');
    `)

    await q.commitTransaction()
    console.log('Seed OK ✅ (roles, estados, medios, instituciones, catálogos, Huehuetenango y admin)')
  } catch (e) {
    await q.rollbackTransaction()
    console.error('Seed FAILED', e)
  } finally {
    await q.release()
    await AppDataSource.destroy()
  }
}

main()
