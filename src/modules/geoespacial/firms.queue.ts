// src/modules/geoespacial/firms.queue.ts
import env from '../../config/env'
import { buildQueue, buildWorker, defaultJobOptions } from '../../queue/bulls'
import { runFirmsIngest } from './services/firms.service'

const QUEUE_NAME = 'firms_ingest'
const JOB_NAME = 'firms:ingest'

export const firmsQueue = buildQueue(QUEUE_NAME)

buildWorker(QUEUE_NAME, async () => {
  await runFirmsIngest()
})

export async function ensureFirmsCron() {
  if (!env.FIRMS_ENABLED) return
  await firmsQueue.add(JOB_NAME, {}, { ...defaultJobOptions, repeat: { pattern: env.FIRMS_FETCH_CRON } })
}
