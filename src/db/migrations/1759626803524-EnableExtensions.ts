import { MigrationInterface, QueryRunner } from 'typeorm'

export class EnableExtensions1759626803524 implements MigrationInterface {
  name = 'EnableExtensions1759626803524'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis;`)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist;`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS btree_gist;`)
    await queryRunner.query(`DROP EXTENSION IF EXISTS postgis;`)
    await queryRunner.query(`DROP EXTENSION IF EXISTS pgcrypto;`)
  }
}
