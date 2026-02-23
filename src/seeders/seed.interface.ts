import { INestApplication } from '@nestjs/common';

export interface Seeder {
  run(app: INestApplication): Promise<void>;
}
