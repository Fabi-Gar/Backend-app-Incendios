import { MigrationInterface, QueryRunner } from "typeorm"

export class AddExtinguidoAtToIncendios1764007700000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE incendios
            ADD COLUMN extinguido_at timestamptz
        `)

        await queryRunner.query(`
            CREATE INDEX idx_incendios_extinguido_at
            ON incendios(extinguido_at)
            WHERE eliminado_en IS NULL AND extinguido_at IS NOT NULL
        `)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX IF EXISTS idx_incendios_extinguido_at`)
        await queryRunner.query(`ALTER TABLE incendios DROP COLUMN extinguido_at`)
    }
}
