import { MigrationInterface, QueryRunner } from "typeorm"

export class AddEsMiembroInstitucionToUsuarios1764007273130 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Agregar columna es_miembro_institucion con default false
        await queryRunner.query(`
            ALTER TABLE usuarios
            ADD COLUMN es_miembro_institucion boolean NOT NULL DEFAULT false
        `)

        // 2. Actualizar registros existentes: marcar como miembro si tienen institucion_uuid
        await queryRunner.query(`
            UPDATE usuarios
            SET es_miembro_institucion = true
            WHERE institucion_uuid IS NOT NULL
              AND eliminado_en IS NULL
        `)

        // 3. Crear índice para consultas rápidas por es_miembro_institucion
        await queryRunner.query(`
            CREATE INDEX idx_usuarios_es_miembro_institucion
            ON usuarios(es_miembro_institucion)
            WHERE eliminado_en IS NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar índice
        await queryRunner.query(`
            DROP INDEX IF EXISTS idx_usuarios_es_miembro_institucion
        `)

        // Eliminar columna
        await queryRunner.query(`
            ALTER TABLE usuarios
            DROP COLUMN es_miembro_institucion
        `)
    }
}
