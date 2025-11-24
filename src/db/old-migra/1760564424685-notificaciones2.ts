import { MigrationInterface, QueryRunner } from "typeorm";

export class Notificaciones21760564424685 implements MigrationInterface {
    name = 'Notificaciones21760564424685'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "insertados" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "ignorados" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "asociados" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "creado_en" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "insertados" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "ignorados" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "asociados" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "creado_en" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "creado_en" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "asociados" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "ignorados" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "insertados" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "creado_en" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "asociados" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "ignorados" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "insertados" DROP NOT NULL`);
        await queryRunner.query(`DROP TABLE "tecnicas_extincion_catalogo"`);
        await queryRunner.query(`DROP INDEX "public"."idx_notif_usuario"`);
    }

}
