import { INestApplication, Logger } from '@nestjs/common';
import { seeders } from './index';

export async function runSeeders(app: INestApplication): Promise<void> {
  const logger = new Logger('SeederRunner');

  logger.log('Début exécution des seeders...');

  for (const seeder of seeders) {
    await seeder.run(app);
  }

  logger.log('Tous les seeders ont été exécutés.');
}
