import { MigrationInterface, QueryRunner } from "typeorm"

export class addUniqueHashDedupe1761039613324 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM puntos_calor a USING puntos_calor b
            WHERE a.punto_calor_uuid < b.punto_calor_uuid
            AND a.hash_dedupe = b.hash_dedupe
            AND a.hash_dedupe IS NOT NULL
        `)
        
        await queryRunner.query(`
            CREATE UNIQUE INDEX idx_puntos_calor_hash_dedupe 
            ON puntos_calor (hash_dedupe) 
            WHERE hash_dedupe IS NOT NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_puntos_calor_hash_dedupe`)
    }
}