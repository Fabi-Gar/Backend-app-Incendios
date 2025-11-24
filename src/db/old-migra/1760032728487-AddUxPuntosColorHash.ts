// src/db/migrations/1760032728487-AddUxPuntosCalorHash.ts
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUxPuntosCalorHash1760032728487 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // crea índice único si no existe
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_puntos_calor_hash
      ON public.puntos_calor (hash_dedupe);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS ux_puntos_calor_hash;
    `);
  }
}
