import 'reflect-metadata'
import { DataSource } from 'typeorm'
import env from '../config/env'
import { SnakeNamingStrategy } from '../naming-strategy'

delete (process.env as any).PGSSLMODE
delete (process.env as any).PGSSLROOTCERT
delete (process.env as any).PGSSLCERT
delete (process.env as any).PGSSLKEY
delete (process.env as any).PGSSLPASSWORD
delete (process.env as any).DATABASE_URL

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  ssl: false,
  extra: {
    ssl: false,
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: env.DB_POOL_IDLE_MS,
  },
  synchronize: false,
  logging: false,
  entities: [
    'src/modules/**/entities/**/*.{ts,js}',   
    'dist/modules/**/entities/**/*.js' ],  
  migrations: ['src/db/migrations/*.{ts,js}', 'dist/db/migrations/*.js'],
  migrationsTableName: 'migrations',
  namingStrategy: new SnakeNamingStrategy(),
})
