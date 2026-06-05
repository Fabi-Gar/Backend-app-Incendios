import env from '../../config/env'
import { buildQueue, buildWorker, defaultJobOptions } from '../../queue/bulls'
import { syncInabIncidents } from './inabSync.service'

const QUEUE_NAME = 'inab_sync'
const JOB_NAME = 'inab:sync'

export const inabQueue = buildQueue(QUEUE_NAME)

buildWorker(QUEUE_NAME, async () => {
  await syncInabIncidents()
})

export async function ensureInabCron() {
  await inabQueue.add(JOB_NAME, {}, { ...defaultJobOptions, repeat: { pattern: env.INAB_FETCH_CRON } })
}
