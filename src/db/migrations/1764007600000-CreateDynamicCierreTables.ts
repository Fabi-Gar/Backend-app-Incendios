import { MigrationInterface, QueryRunner } from "typeorm"

export class CreateDynamicCierreTables1764007600000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Crear tabla cierre_plantillas
        await queryRunner.query(`
            CREATE TABLE cierre_plantillas (
                plantilla_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                nombre text NOT NULL,
                descripcion text,
                activa boolean NOT NULL DEFAULT false,
                version integer NOT NULL DEFAULT 1,
                creado_por_uuid uuid NOT NULL,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_cierre_plantillas_creado_por
                    FOREIGN KEY (creado_por_uuid)
                    REFERENCES usuarios(usuario_uuid)
            )
        `)

        // Crear índice para plantillas activas
        await queryRunner.query(`
            CREATE INDEX idx_cierre_plantillas_activa
            ON cierre_plantillas(activa)
            WHERE eliminado_en IS NULL
        `)

        // 2. Crear tabla cierre_secciones
        await queryRunner.query(`
            CREATE TABLE cierre_secciones (
                seccion_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                plantilla_uuid uuid NOT NULL,
                nombre text NOT NULL,
                descripcion text,
                orden integer NOT NULL,
                icono text,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_cierre_secciones_plantilla
                    FOREIGN KEY (plantilla_uuid)
                    REFERENCES cierre_plantillas(plantilla_uuid)
            )
        `)

        // Crear índice para secciones por plantilla
        await queryRunner.query(`
            CREATE INDEX idx_cierre_secciones_plantilla
            ON cierre_secciones(plantilla_uuid)
            WHERE eliminado_en IS NULL
        `)

        // 3. Crear tabla cierre_campos (con soporte jerárquico)
        await queryRunner.query(`
            CREATE TABLE cierre_campos (
                campo_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                seccion_uuid uuid NOT NULL,
                campo_padre_uuid uuid,
                nombre text NOT NULL,
                descripcion text,
                placeholder text,
                tipo text NOT NULL,
                orden integer NOT NULL,
                requerido boolean NOT NULL DEFAULT false,
                opciones jsonb,
                validaciones jsonb,
                dependencias jsonb,
                unidad text,
                ayuda text,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_cierre_campos_seccion
                    FOREIGN KEY (seccion_uuid)
                    REFERENCES cierre_secciones(seccion_uuid),
                CONSTRAINT fk_cierre_campos_campo_padre
                    FOREIGN KEY (campo_padre_uuid)
                    REFERENCES cierre_campos(campo_uuid)
            )
        `)

        // Crear índices para campos
        await queryRunner.query(`
            CREATE INDEX idx_cierre_campos_seccion
            ON cierre_campos(seccion_uuid)
            WHERE eliminado_en IS NULL
        `)

        await queryRunner.query(`
            CREATE INDEX idx_cierre_campos_campo_padre
            ON cierre_campos(campo_padre_uuid)
            WHERE eliminado_en IS NULL AND campo_padre_uuid IS NOT NULL
        `)

        // 4. Crear tabla cierre_respuestas (respuestas de usuarios)
        await queryRunner.query(`
            CREATE TABLE cierre_respuestas (
                respuesta_uuid uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                incendio_uuid uuid NOT NULL,
                campo_uuid uuid NOT NULL,
                valor_texto text,
                valor_numero numeric,
                valor_fecha date,
                valor_datetime timestamptz,
                valor_boolean boolean,
                valor_json jsonb,
                respondido_por_uuid uuid NOT NULL,
                creado_en timestamptz NOT NULL DEFAULT now(),
                actualizado_en timestamptz NOT NULL DEFAULT now(),
                eliminado_en timestamptz,
                CONSTRAINT fk_cierre_respuestas_incendio
                    FOREIGN KEY (incendio_uuid)
                    REFERENCES incendios(incendio_uuid),
                CONSTRAINT fk_cierre_respuestas_campo
                    FOREIGN KEY (campo_uuid)
                    REFERENCES cierre_campos(campo_uuid),
                CONSTRAINT fk_cierre_respuestas_respondido_por
                    FOREIGN KEY (respondido_por_uuid)
                    REFERENCES usuarios(usuario_uuid)
            )
        `)

        // Crear índices para respuestas
        await queryRunner.query(`
            CREATE INDEX idx_cierre_respuestas_incendio
            ON cierre_respuestas(incendio_uuid)
            WHERE eliminado_en IS NULL
        `)

        await queryRunner.query(`
            CREATE INDEX idx_cierre_respuestas_campo
            ON cierre_respuestas(campo_uuid)
            WHERE eliminado_en IS NULL
        `)

        // Crear índice compuesto único para evitar respuestas duplicadas (un campo por incendio)
        await queryRunner.query(`
            CREATE UNIQUE INDEX uq_cierre_respuestas_incendio_campo
            ON cierre_respuestas(incendio_uuid, campo_uuid)
            WHERE eliminado_en IS NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar en orden inverso para respetar foreign keys
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_respuestas CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_campos CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_secciones CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_plantillas CASCADE`)
    }
}
