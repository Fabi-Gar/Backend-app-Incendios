import { MigrationInterface, QueryRunner } from "typeorm";

export class UsuariosEmailUnique1759626803529 implements MigrationInterface {
  name = 'UsuariosEmailUnique1759626803529'

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_usuarios_email_notnull
      ON usuarios (email)
      WHERE email IS NOT NULL;
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX IF EXISTS uq_usuarios_email_notnull;`);
  }
}
