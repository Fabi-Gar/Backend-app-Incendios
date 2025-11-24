import { MigrationInterface, QueryRunner } from "typeorm";

export class BaselineFinal1760340155551 implements MigrationInterface {
  name = 'BaselineFinal1760340155551'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);

    // Dropear índices (si existen)
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."ux_puntos_calor_hash";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_puntos_calor_fecha_time";`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_puntos_calor_geom";`);

        await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "ux_puntos_calor_hash" ON "puntos_calor" ("hash_dedupe")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_puntos_calor_fecha_time" ON "puntos_calor" ("acq_date","acq_time")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_puntos_calor_geom" ON "puntos_calor" USING GIST ("geom")`);


    // Asegurar NOT NULL en job_runs (una vez por columna, sin duplicar)
    await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "insertados" SET NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "ignorados" SET NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "asociados" SET NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "creado_en" SET NOT NULL;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir NOT NULL
    await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "creado_en" DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "asociados" DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "ignorados" DROP NOT NULL;`);
    await queryRunner.query(`ALTER TABLE "job_runs" ALTER COLUMN "insertados" DROP NOT NULL;`);

    // Índices y tabla de notificaciones
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_notif_usuario";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "notificaciones";`);

    // Recrear los índices que tiraste en up()
    await queryRunner.query(`CREATE UNIQUE INDEX "ux_puntos_calor_hash" ON "puntos_calor" ("hash_dedupe");`);
    await queryRunner.query(`CREATE INDEX "idx_puntos_calor_fecha_time" ON "puntos_calor" ("acq_date", "acq_time");`);
    await queryRunner.query(`CREATE INDEX "idx_puntos_calor_geom" ON "puntos_calor" USING GIST ("geom");`);
  }




  
}
