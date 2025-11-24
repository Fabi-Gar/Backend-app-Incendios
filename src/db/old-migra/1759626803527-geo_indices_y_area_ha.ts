import { MigrationInterface, QueryRunner } from "typeorm";

export class GeoIndicesYAreaHa1759626803527 implements MigrationInterface {
  name = 'GeoIndicesYAreaHa1759626803527'

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE OR REPLACE FUNCTION calc_area_ha()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.geom IS NOT NULL THEN
          NEW.area_ha := ST_Area(geography(NEW.geom)) / 10000.0;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_zonas_afectadas_area ON zonas_afectadas;
      CREATE TRIGGER trg_zonas_afectadas_area
      BEFORE INSERT OR UPDATE ON zonas_afectadas
      FOR EACH ROW EXECUTE FUNCTION calc_area_ha();
    `);

    // Índices geoespaciales (GiST en geometry)
    await q.query(`CREATE INDEX IF NOT EXISTS idx_incendios_centroid_gist ON incendios USING GiST (centroide);`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_reportes_ubicacion_gist ON reportes USING GiST (ubicacion);`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_puntos_calor_geom_gist ON puntos_calor USING GiST (geom);`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_zonas_afectadas_geom_gist ON zonas_afectadas USING GiST (geom);`);

    // Índices BTREE por fechas
    await q.query(`CREATE INDEX IF NOT EXISTS idx_reportes_reportado_en ON reportes (reportado_en);`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_puntos_calor_acq_date ON puntos_calor (acq_date);`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_actualizaciones_creado_en ON actualizaciones (creado_en);`);

    // Índices parciales soft-delete (lectura alta)
    await q.query(`CREATE INDEX IF NOT EXISTS idx_incendios_soft ON incendios (estado_incendio_uuid, aprobado) WHERE eliminado_en IS NULL;`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_reportes_soft ON reportes (incendio_uuid) WHERE eliminado_en IS NULL;`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_puntos_calor_soft ON puntos_calor (acq_date) WHERE eliminado_en IS NULL;`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_zonas_afectadas_soft ON zonas_afectadas (incendio_uuid, fecha) WHERE eliminado_en IS NULL;`);
    await q.query(`CREATE INDEX IF NOT EXISTS idx_actualizaciones_soft ON actualizaciones (incendio_uuid, creado_en) WHERE eliminado_en IS NULL;`);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TRIGGER IF EXISTS trg_zonas_afectadas_area ON zonas_afectadas;`);
    await q.query(`DROP FUNCTION IF EXISTS calc_area_ha;`);

    await q.query(`DROP INDEX IF EXISTS idx_incendios_centroid_gist;`);
    await q.query(`DROP INDEX IF EXISTS idx_reportes_ubicacion_gist;`);
    await q.query(`DROP INDEX IF EXISTS idx_puntos_calor_geom_gist;`);
    await q.query(`DROP INDEX IF EXISTS idx_zonas_afectadas_geom_gist;`);

    await q.query(`DROP INDEX IF EXISTS idx_reportes_reportado_en;`);
    await q.query(`DROP INDEX IF EXISTS idx_puntos_calor_acq_date;`);
    await q.query(`DROP INDEX IF EXISTS idx_actualizaciones_creado_en;`);

    await q.query(`DROP INDEX IF EXISTS idx_incendios_soft;`);
    await q.query(`DROP INDEX IF EXISTS idx_reportes_soft;`);
    await q.query(`DROP INDEX IF EXISTS idx_puntos_calor_soft;`);
    await q.query(`DROP INDEX IF EXISTS idx_zonas_afectadas_soft;`);
    await q.query(`DROP INDEX IF EXISTS idx_actualizaciones_soft;`);
  }
}
