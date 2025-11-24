// config/env.ts
import { z } from 'zod'
import dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'

dotenvExpand.expand(dotenv.config())

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  APP_TIMEZONE: z.string().min(1).default('America/Guatemala'),
  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace']).default('info'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_SSL: z.coerce.boolean().default(false),
  DB_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_IDLE_MS: z.coerce.number().int().nonnegative().default(10000),

  HASH_ALGO: z.enum(['argon2id','bcrypt']).default('argon2id'),
  ARGON2_MEMORY: z.coerce.number().int().positive().default(65536),
  ARGON2_TIME: z.coerce.number().int().positive().default(3),
  ARGON2_PARALLELISM: z.coerce.number().int().positive().default(1),

  JWT_SECRET: z.string().min(1),
  JWT_ISSUER: z.string().min(1).default('app-incendios'),
  JWT_AUDIENCE: z.string().min(1).default('usuarios-app'), 
  JWT_EXPIRES_IN: z.string().min(1).default('2h'),

  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  PAYLOAD_LIMIT_MB: z.coerce.number().int().positive().default(10),

  STORAGE_BUCKET_BASE_URL: z.string().url().optional(),

  MEDIA_BASE_URL: z.string().url().optional(),

  FIRMS_ENABLED: z.coerce.boolean().default(true),
  FIRMS_API_KEY: z.string().min(1),
  FIRMS_COUNTRY: z.string().min(2).default('GTM'),
  FIRMS_PRODUCTS: z.string().default('VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,MODIS_NRT')
    .transform(s => s.split(',').map(x => x.trim()).filter(Boolean)),
  FIRMS_DAYS: z.coerce.number().int().positive().default(3),
  FIRMS_BBOX_GTM: z.string().default(''),
  FIRMS_USE_AREA_FALLBACK: z.coerce.boolean().default(true),
  FIRMS_FETCH_CRON: z.string().default('0 */2 * * *'),

  FIRMS_BUFFER_KM: z.coerce.number().positive().default(25),
  FIRMS_TIME_WINDOW_H: z.coerce.number().int().positive().default(48),
  FIRMS_BATCH_SIZE: z.coerce.number().int().positive().default(2000),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  QUEUE_PREFIX: z.string().default('incendios'),
  SSE_HEARTBEAT_MS: z.coerce.number().int().positive().default(15000),

  HEALTHCHECK_PATH: z.string().min(1).default('/health/liveness'),
  HEALTHCHECK_INTERVAL: z.string().min(1).default('30s'),
  HEALTHCHECK_TIMEOUT: z.string().min(1).default('5s'),

  TZ: z.string().min(1).default('America/Guatemala'),
})

const raw = schema.parse(process.env)

const DEFAULT_BASE = `http://localhost:${raw.PORT}`

const env = {
  ...raw,
  MEDIA_BASE_URL: raw.MEDIA_BASE_URL ?? DEFAULT_BASE, 
  CORS_ALLOWED_ORIGINS_LIST: raw.CORS_ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean),
}

export default env
