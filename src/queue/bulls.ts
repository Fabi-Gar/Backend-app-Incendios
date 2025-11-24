// src/queue/bulls.ts
import { Queue, Worker, JobsOptions } from 'bullmq'
import IORedis from 'ioredis'
import env from '../config/env'

// ⚠️ BullMQ v5: ioredis debe tener maxRetriesPerRequest=null (y conviene enableReadyCheck=false)
const connection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  // Si tu Redis requiere TLS (Redis Cloud/Upstash), descomenta:
  // tls: { rejectUnauthorized: false },
})

export const queuePrefix = env.QUEUE_PREFIX || 'incendios' // sin ':'

export function buildQueue(name: string) {
  return new Queue(name, { connection, prefix: queuePrefix })
}

export function buildWorker(name: string, processor: any) {
  // Worker creará su conexión de bloqueo internamente usando estas opciones
  return new Worker(name, processor, { connection, prefix: queuePrefix })
}

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: 50,
  removeOnFail: 100,
}
