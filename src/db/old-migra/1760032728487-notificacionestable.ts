import { MigrationInterface, QueryRunner } from "typeorm";

export class Notificacionestable1760032728487 implements MigrationInterface {
    name = 'Notificacionestable1760032728487'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_puntos_calor_geom"`);
        await queryRunner.query(`DROP INDEX "public"."ux_puntos_calor_hash"`);
        await queryRunner.query(`DROP INDEX "public"."idx_puntos_calor_fecha_time"`);
        await queryRunner.query(`CREATE TABLE "notificaciones" ("notificacion_uuid" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_uuid" uuid NOT NULL, "tipo" text NOT NULL, "payload" jsonb, "leida_en" TIMESTAMP WITH TIME ZONE, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f4228a4d04139e6fb3f6685bae4" PRIMARY KEY ("notificacion_uuid"))`);
        await queryRunner.query(`CREATE INDEX "idx_notif_usuario" ON "notificaciones" ("usuario_uuid", "creado_en") `);
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
        await queryRunner.query(`DROP INDEX "public"."idx_notif_usuario"`);
        await queryRunner.query(`DROP TABLE "notificaciones"`);
        await queryRunner.query(`CREATE INDEX "idx_puntos_calor_fecha_time" ON "puntos_calor" ("acq_date", "acq_time") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "ux_puntos_calor_hash" ON "puntos_calor" ("hash_dedupe") `);
        await queryRunner.query(`CREATE INDEX "idx_puntos_calor_geom" ON "puntos_calor" USING GiST ("geom") `);
    }

}
