import { MigrationInterface, QueryRunner } from "typeorm"

export class DropOldCierreTables1764007500000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Drop all cierre tables (data/join tables)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_abastos CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_causa CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_composicion_tipo CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_iniciando_junto_a CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_medios_aereos CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_medios_acuaticos CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_medios_instituciones CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_medios_terrestres CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_operaciones CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_meteorologia CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_propiedad CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_superficie_vegetacion CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_superficie CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_topografia CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS cierre_tecnicas_extincion CASCADE`)

        // 2. Drop catalog tables
        await queryRunner.query(`DROP TABLE IF EXISTS abastos_catalogo CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS causas_catalogo CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS iniciado_junto_a_catalogo CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS medios_acuaticos_catalogo CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS medios_terrestres_catalogo CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS medios_aereos_catalogo CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS tipo_incendio CASCADE`)
        await queryRunner.query(`DROP TABLE IF EXISTS tipo_propiedad CASCADE`)
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // No podemos recrear las tablas automáticamente sin conocer su estructura completa
        // Si se necesita hacer rollback, se debe restaurar desde un backup de la base de datos
        throw new Error("No se puede hacer rollback de esta migración. Restaure desde backup si es necesario.")
    }
}
