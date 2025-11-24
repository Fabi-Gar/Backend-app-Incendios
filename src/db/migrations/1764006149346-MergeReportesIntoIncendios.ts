import { MigrationInterface, QueryRunner } from "typeorm"

export class MergeReportesIntoIncendios1764006149346 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Agregar columnas de reportes a incendios
        await queryRunner.query(`
            ALTER TABLE incendios
            ADD COLUMN reportado_por_uuid uuid,
            ADD COLUMN reportado_por_nombre text,
            ADD COLUMN institucion_reporte_uuid uuid,
            ADD COLUMN telefono text,
            ADD COLUMN reportado_en timestamptz,
            ADD COLUMN medio_uuid uuid,
            ADD COLUMN departamento_uuid uuid,
            ADD COLUMN municipio_uuid uuid,
            ADD COLUMN lugar_poblado text,
            ADD COLUMN finca text
        `)

        // 2. Migrar datos del primer reporte de cada incendio
        await queryRunner.query(`
            WITH primer_reporte AS (
                SELECT DISTINCT ON (r.incendio_uuid)
                    r.incendio_uuid,
                    r.reportado_por_uuid,
                    r.reportado_por_nombre,
                    r.institucion_uuid,
                    r.telefono,
                    r.reportado_en,
                    r.medio_uuid,
                    r.ubicacion,
                    r.departamento_uuid,
                    r.municipio_uuid,
                    r.lugar_poblado,
                    r.finca,
                    r.observaciones
                FROM reportes r
                WHERE r.incendio_uuid IS NOT NULL
                  AND r.eliminado_en IS NULL
                ORDER BY r.incendio_uuid, r.reportado_en ASC NULLS LAST, r.creado_en ASC
            )
            UPDATE incendios i
            SET
                reportado_por_uuid = pr.reportado_por_uuid,
                reportado_por_nombre = pr.reportado_por_nombre,
                institucion_reporte_uuid = pr.institucion_uuid,
                telefono = pr.telefono,
                reportado_en = pr.reportado_en,
                medio_uuid = pr.medio_uuid,
                departamento_uuid = pr.departamento_uuid,
                municipio_uuid = pr.municipio_uuid,
                lugar_poblado = pr.lugar_poblado,
                finca = pr.finca,
                -- Si centroide es NULL, usar ubicacion del reporte
                centroide = CASE
                    WHEN i.centroide IS NULL THEN pr.ubicacion
                    ELSE i.centroide
                END,
                -- Si descripcion es NULL o vacía, usar observaciones del reporte
                descripcion = CASE
                    WHEN COALESCE(TRIM(i.descripcion), '') = '' THEN pr.observaciones
                    WHEN pr.observaciones IS NOT NULL AND TRIM(pr.observaciones) != '' THEN
                        COALESCE(i.descripcion, '') || E'\n\nReporte inicial: ' || pr.observaciones
                    ELSE i.descripcion
                END
            FROM primer_reporte pr
            WHERE i.incendio_uuid = pr.incendio_uuid
        `)

        // 3. Modificar fotos_reporte para apuntar a incendio en lugar de reporte
        // Primero agregar la nueva columna
        await queryRunner.query(`
            ALTER TABLE fotos_reporte
            ADD COLUMN incendio_uuid uuid
        `)

        // 4. Migrar fotos del primer reporte al incendio
        await queryRunner.query(`
            WITH primer_reporte AS (
                SELECT DISTINCT ON (r.incendio_uuid)
                    r.reporte_uuid,
                    r.incendio_uuid
                FROM reportes r
                WHERE r.incendio_uuid IS NOT NULL
                  AND r.eliminado_en IS NULL
                ORDER BY r.incendio_uuid, r.reportado_en ASC NULLS LAST, r.creado_en ASC
            )
            UPDATE fotos_reporte fr
            SET incendio_uuid = pr.incendio_uuid
            FROM primer_reporte pr
            WHERE fr.reporte_uuid = pr.reporte_uuid
        `)

        // 5. Eliminar fotos de reportes que no son el primero (opcional, o mantenerlas huérfanas)
        await queryRunner.query(`
            DELETE FROM fotos_reporte
            WHERE incendio_uuid IS NULL
        `)

        // 6. Hacer incendio_uuid NOT NULL y agregar FK
        await queryRunner.query(`
            ALTER TABLE fotos_reporte
            ALTER COLUMN incendio_uuid SET NOT NULL
        `)

        await queryRunner.query(`
            ALTER TABLE fotos_reporte
            ADD CONSTRAINT fk_fotos_reporte_incendio_uuid
            FOREIGN KEY (incendio_uuid)
            REFERENCES incendios(incendio_uuid)
            ON DELETE CASCADE
        `)

        // 7. Crear índice en incendio_uuid
        await queryRunner.query(`
            CREATE INDEX idx_fotos_reporte_incendio ON fotos_reporte(incendio_uuid)
        `)

        // 8. Eliminar la columna reporte_uuid y su FK
        await queryRunner.query(`
            ALTER TABLE fotos_reporte
            DROP CONSTRAINT IF EXISTS fk_fotos_reporte_reporte_uuid
        `)

        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_fotos_reporte_reporte
        `)

        await queryRunner.query(`
            ALTER TABLE fotos_reporte
            DROP COLUMN reporte_uuid
        `)

        // 9. Agregar FKs a incendios para los nuevos campos
        await queryRunner.query(`
            ALTER TABLE incendios
            ADD CONSTRAINT fk_incendios_reportado_por_uuid
            FOREIGN KEY (reportado_por_uuid)
            REFERENCES usuarios(usuario_uuid)
            ON DELETE SET NULL
        `)

        await queryRunner.query(`
            ALTER TABLE incendios
            ADD CONSTRAINT fk_incendios_institucion_reporte_uuid
            FOREIGN KEY (institucion_reporte_uuid)
            REFERENCES instituciones(institucion_uuid)
            ON DELETE SET NULL
        `)

        await queryRunner.query(`
            ALTER TABLE incendios
            ADD CONSTRAINT fk_incendios_medio_uuid
            FOREIGN KEY (medio_uuid)
            REFERENCES catalogo_medios(medio_uuid)
            ON DELETE SET NULL
        `)

        await queryRunner.query(`
            ALTER TABLE incendios
            ADD CONSTRAINT fk_incendios_departamento_uuid
            FOREIGN KEY (departamento_uuid)
            REFERENCES departamentos(departamento_uuid)
            ON DELETE SET NULL
        `)

        await queryRunner.query(`
            ALTER TABLE incendios
            ADD CONSTRAINT fk_incendios_municipio_uuid
            FOREIGN KEY (municipio_uuid)
            REFERENCES municipios(municipio_uuid)
            ON DELETE SET NULL
        `)

        // 10. Eliminar tabla reportes
        await queryRunner.query(`DROP TABLE IF EXISTS reportes CASCADE`)

        // 11. Crear índices para mejor performance
        await queryRunner.query(`
            CREATE INDEX idx_incendios_reportado_en ON incendios(reportado_en)
        `)

        await queryRunner.query(`
            CREATE INDEX idx_incendios_departamento ON incendios(departamento_uuid)
        `)

        await queryRunner.query(`
            CREATE INDEX idx_incendios_municipio ON incendios(municipio_uuid)
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Revertir no es práctico después de eliminar la tabla reportes
        // pero se puede intentar recrear la estructura básica

        // 1. Recrear tabla reportes
        await queryRunner.query(`
            CREATE TABLE reportes (
                reporte_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                incendio_uuid uuid,
                reportado_por_uuid uuid NOT NULL,
                reportado_por_nombre text NOT NULL,
                institucion_uuid uuid,
                telefono text,
                reportado_en timestamptz NOT NULL,
                medio_uuid uuid NOT NULL,
                ubicacion geometry(Point, 4326) NOT NULL,
                departamento_uuid uuid,
                municipio_uuid uuid,
                lugar_poblado text,
                finca text,
                observaciones text,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_reportes_incendio_uuid FOREIGN KEY (incendio_uuid) REFERENCES incendios(incendio_uuid),
                CONSTRAINT fk_reportes_reportado_por_uuid FOREIGN KEY (reportado_por_uuid) REFERENCES usuarios(usuario_uuid),
                CONSTRAINT fk_reportes_institucion_uuid FOREIGN KEY (institucion_uuid) REFERENCES instituciones(institucion_uuid),
                CONSTRAINT fk_reportes_medio_uuid FOREIGN KEY (medio_uuid) REFERENCES catalogo_medios(medio_uuid),
                CONSTRAINT fk_reportes_departamento_uuid FOREIGN KEY (departamento_uuid) REFERENCES departamentos(departamento_uuid),
                CONSTRAINT fk_reportes_municipio_uuid FOREIGN KEY (municipio_uuid) REFERENCES municipios(municipio_uuid)
            )
        `)

        await queryRunner.query(`
            CREATE INDEX idx_reportes_incendio ON reportes(incendio_uuid)
        `)

        await queryRunner.query(`
            CREATE INDEX idx_reportes_reportado_en ON reportes(reportado_en)
        `)

        // 2. Migrar datos de incendios de vuelta a reportes
        await queryRunner.query(`
            INSERT INTO reportes (
                incendio_uuid, reportado_por_uuid, reportado_por_nombre,
                institucion_uuid, telefono, reportado_en, medio_uuid,
                ubicacion, departamento_uuid, municipio_uuid,
                lugar_poblado, finca, observaciones
            )
            SELECT
                incendio_uuid, reportado_por_uuid, reportado_por_nombre,
                institucion_reporte_uuid, telefono, reportado_en, medio_uuid,
                centroide, departamento_uuid, municipio_uuid,
                lugar_poblado, finca, NULL
            FROM incendios
            WHERE reportado_por_uuid IS NOT NULL
        `)

        // 3. Modificar fotos_reporte de vuelta a reporte_uuid
        await queryRunner.query(`
            ALTER TABLE fotos_reporte
            ADD COLUMN reporte_uuid uuid
        `)

        await queryRunner.query(`
            UPDATE fotos_reporte fr
            SET reporte_uuid = r.reporte_uuid
            FROM reportes r
            WHERE fr.incendio_uuid = r.incendio_uuid
        `)

        await queryRunner.query(`
            ALTER TABLE fotos_reporte
            ALTER COLUMN reporte_uuid SET NOT NULL
        `)

        await queryRunner.query(`
            ALTER TABLE fotos_reporte
            ADD CONSTRAINT fk_fotos_reporte_reporte_uuid
            FOREIGN KEY (reporte_uuid)
            REFERENCES reportes(reporte_uuid)
            ON DELETE CASCADE
        `)

        await queryRunner.query(`
            CREATE INDEX idx_fotos_reporte_reporte ON fotos_reporte(reporte_uuid)
        `)

        // 4. Eliminar columnas de incendios
        await queryRunner.query(`DROP INDEX IF EXISTS idx_incendios_municipio`)
        await queryRunner.query(`DROP INDEX IF EXISTS idx_incendios_departamento`)
        await queryRunner.query(`DROP INDEX IF EXISTS idx_incendios_reportado_en`)

        await queryRunner.query(`
            ALTER TABLE fotos_reporte
            DROP CONSTRAINT IF EXISTS fk_fotos_reporte_incendio_uuid
        `)

        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_fotos_reporte_incendio
        `)

        await queryRunner.query(`
            ALTER TABLE fotos_reporte
            DROP COLUMN incendio_uuid
        `)

        await queryRunner.query(`
            ALTER TABLE incendios
            DROP CONSTRAINT IF EXISTS fk_incendios_municipio_uuid,
            DROP CONSTRAINT IF EXISTS fk_incendios_departamento_uuid,
            DROP CONSTRAINT IF EXISTS fk_incendios_medio_uuid,
            DROP CONSTRAINT IF EXISTS fk_incendios_institucion_reporte_uuid,
            DROP CONSTRAINT IF EXISTS fk_incendios_reportado_por_uuid
        `)

        await queryRunner.query(`
            ALTER TABLE incendios
            DROP COLUMN reportado_por_uuid,
            DROP COLUMN reportado_por_nombre,
            DROP COLUMN institucion_reporte_uuid,
            DROP COLUMN telefono,
            DROP COLUMN reportado_en,
            DROP COLUMN medio_uuid,
            DROP COLUMN departamento_uuid,
            DROP COLUMN municipio_uuid,
            DROP COLUMN lugar_poblado,
            DROP COLUMN finca
        `)
    }
}
