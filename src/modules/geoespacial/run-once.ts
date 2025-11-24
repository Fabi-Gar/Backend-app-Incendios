import { AppDataSource } from '../../db/data-source';
import { runFirmsIngest } from './services/firms.service';

(async () => {
  if (!AppDataSource.isInitialized) await AppDataSource.initialize();
  const r = await runFirmsIngest();
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(r));
  process.exit(0);
})();
