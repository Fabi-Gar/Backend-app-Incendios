// src/db/migrations/TIMESTAMP-CreateIncendioSeguidores.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIncendioSeguidores1761081740020 implements MigrationInterface {
    name = 'CreateIncendioSeguidores1761081740020'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE incendio_seguidores (
                incendio_uuid UUID NOT NULL,
                usuario_uuid UUID NOT NULL,
                creado_en TIMESTAMP NOT NULL DEFAULT NOW(),
                eliminado_en TIMESTAMP,
                CONSTRAINT pk_incendio_seguidores PRIMARY KEY (incendio_uuid, usuario_uuid),
                CONSTRAINT fk_incendio_seguidores_incendio 
                    FOREIGN KEY (incendio_uuid) 
                    REFERENCES incendios(incendio_uuid) 
                    ON DELETE CASCADE,
                CONSTRAINT fk_incendio_seguidores_usuario 
                    FOREIGN KEY (usuario_uuid) 
                    REFERENCES usuarios(usuario_uuid) 
                    ON DELETE CASCADE
            )
        `);

        // Crear índice para búsquedas por usuario
        await queryRunner.query(`
            CREATE INDEX idx_seguidores_usuario 
            ON incendio_seguidores(usuario_uuid) 
            WHERE eliminado_en IS NULL
        `);

        // Crear índice para búsquedas por incendio
        await queryRunner.query(`
            CREATE INDEX idx_seguidores_incendio 
            ON incendio_seguidores(incendio_uuid) 
            WHERE eliminado_en IS NULL
        `);

        // Comentarios para documentación
        await queryRunner.query(`
            COMMENT ON TABLE incendio_seguidores IS 'Relación de usuarios que siguen incendios para recibir notificaciones'
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN incendio_seguidores.incendio_uuid IS 'ID del incendio que se está siguiendo'
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN incendio_seguidores.usuario_uuid IS 'ID del usuario que sigue el incendio'
        `);
        
        await queryRunner.query(`
            COMMENT ON COLUMN incendio_seguidores.eliminado_en IS 'Fecha de soft delete (dejar de seguir)'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Eliminar índices
        await queryRunner.query(`DROP INDEX IF EXISTS idx_seguidores_incendio`);
        await queryRunner.query(`DROP INDEX IF EXISTS idx_seguidores_usuario`);
        
        // Eliminar tabla
        await queryRunner.query(`DROP TABLE IF EXISTS incendio_seguidores`);
    }
}