import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from './config/swagger.config';
import { LoggerService } from './common/logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const logger = new LoggerService('Bootstrap');

  // Swagger configuration
  setupSwagger(app);
  await app.listen(port);

  logger.log('Bootstrap', `Application is running on: http://localhost:${port}`);

  logger.log('Bootstrap', `Swagger docs available at: http://localhost:${port}/api/docs`);
}
bootstrap();
