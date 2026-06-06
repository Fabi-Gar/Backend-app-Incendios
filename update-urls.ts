import { AppDataSource } from './src/db/data-source'
async function run() {
  await AppDataSource.initialize();
  await AppDataSource.query("UPDATE fotos_reporte SET url = REPLACE(url, 'localhost', '192.168.1.8')");
  console.log('URLs updated!');
  process.exit(0);
}
run().catch(console.error);
