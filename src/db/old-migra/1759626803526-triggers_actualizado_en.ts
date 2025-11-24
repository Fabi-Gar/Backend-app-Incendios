import { MigrationInterface, QueryRunner } from "typeorm";

export class TriggersActualizadoEn1759626803526 implements MigrationInterface {
  name = 'TriggersActualizadoEn1759626803526'

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION trg_touch_actualizado_en()
      RETURNS trigger AS $$
      BEGIN
        NEW.actualizado_en := now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    const tablas = [
      'roles','instituciones','usuarios',
      'medios','departamentos','municipios','estado_incendio',
      'incendios','incendio_estado_historial','reportes','fotos_reporte',
      'puntos_calor','zonas_afectadas','incendio_registro_responsable',
      'tipos_incendio','cierre_operaciones','cierre_eventos_operativos','actualizaciones',
      'cierre_tecnicas_extincion','cierre_topografia','cierre_superficie',
      'cierre_secuencia_control','cierre_superficie_vegetacion','tipo_propiedad',
      'cierre_propiedad','cierre_meteorologia','medios_terrestres_catalogo',
      'cierre_medios_terrestres','cierre_medios_instituciones','medios_aereos_catalogo',
      'cierre_medios_aereos','medios_acuaticos_catalogo','cierre_medios_acuaticos',
      'iniciado_junto_a_catalogo','cierre_iniciado_junto_a','cierre_composicion_tipo',
      'causas_catalogo','cierre_causa','abastos_catalogo','cierre_abastos'
    ];

    for (const t of tablas) {
      await q.query(`
        DROP TRIGGER IF EXISTS trg_${t}_touch ON "${t}";
        CREATE TRIGGER trg_${t}_touch
        BEFORE UPDATE ON "${t}"
        FOR EACH ROW EXECUTE FUNCTION trg_touch_actualizado_en();
      `);
    }
  }

  public async down(q: QueryRunner): Promise<void> {
    const tablas = [
      'roles','instituciones','usuarios','medios','departamentos','municipios','estado_incendio',
      'incendios','incendio_estado_historial','reportes','fotos_reporte','puntos_calor',
      'zonas_afectadas','incendio_registro_responsable','tipos_incendio','cierre_operaciones',
      'cierre_eventos_operativos','actualizaciones','cierre_tecnicas_extincion','cierre_topografia',
      'cierre_superficie','cierre_secuencia_control','cierre_superficie_vegetacion','tipo_propiedad',
      'cierre_propiedad','cierre_meteorologia','medios_terrestres_catalogo','cierre_medios_terrestres',
      'cierre_medios_instituciones','medios_aereos_catalogo','cierre_medios_aereos','medios_acuaticos_catalogo',
      'cierre_medios_acuaticos','iniciado_junto_a_catalogo','cierre_iniciado_junto_a','cierre_composicion_tipo',
      'causas_catalogo','cierre_causa','abastos_catalogo','cierre_abastos'
    ];
    for (const t of tablas) {
      await q.query(`DROP TRIGGER IF EXISTS trg_${t}_touch ON "${t}";`);
    }
    await q.query(`DROP FUNCTION IF EXISTS trg_touch_actualizado_en;`);
  }
}
