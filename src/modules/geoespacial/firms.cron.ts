// src/modules/geoespacial/firms.cron.ts
import cron from 'node-cron' 
import { runFirmsIngest } from './services/firms.service'

let started = false

export function startFirmsCron() {
  if (started) return
  started = true

  // Cada 2 horas (ajusta si quieres horarios fijos)
  cron.schedule('0 */2 * * *', async () => {
    try {
      console.log('⏰ [cron] FIRMS ingest...')
      await runFirmsIngest()
      console.log('✅ [cron] FIRMS OK')
    } catch (e: any) {
      console.error('❌ [cron] FIRMS error:', e?.message || e)
    }
  }, { timezone: 'America/Guatemala' })

  // (Opcional) Ejecutar una vez al arrancar
  ;(async () => {
    try {
      console.log('🚀 [boot] FIRMS ingest inicial...')
      await runFirmsIngest()
      console.log('✅ [boot] FIRMS OK')
    } catch (e: any) {
      console.error('❌ [boot] FIRMS error:', e?.message || e)
    }
  })()
}
