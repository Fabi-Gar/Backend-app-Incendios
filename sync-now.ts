import { AppDataSource } from './src/db/data-source';
import { syncInabIncidents } from './src/modules/incendios/inabSync.service';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Connecting to database...');
  await AppDataSource.initialize();
  console.log('Connected. Starting INAB sync...');
  await syncInabIncidents();
  console.log('Sync finished.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
