import { AppDataSource } from './db/data-source'
import { syncInabIncidents } from './modules/incendios/inabSync.service'
import { FotoReporte } from './modules/incendios/entities/foto-reporte.entity'
import { Incendio } from './modules/incendios/entities/incendio.entity'

async function main() {
  await AppDataSource.initialize()
  console.log('DB connected')
  
  const fotoRepo = AppDataSource.getRepository(FotoReporte)
  await fotoRepo.delete({ credito: 'INAB' })
  console.log('Cleared old INAB photos')
  
  await syncInabIncidents()
  
  console.log('Done')
  process.exit(0)
}

main().catch(console.error)
