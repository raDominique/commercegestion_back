import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './common/logger/logger.service';
import { setupSwagger } from './config/swagger.config';
import { AppModule } from './app.module';
import { AppModuleV1 } from './v1/app.module';
import { AppModuleV2 } from './v2/app.module';
import { VersioningType } from '@nestjs/common';

async function bootstrap() {
  // Create the application with the main module
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const logger = new LoggerService('Bootstrap');

  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Configure Swagger for both versions
  setupSwagger(app, [
    { module: AppModuleV1, version: 'v1', path: 'v1' },
    { module: AppModuleV2, version: 'v2', path: 'v2' },
  ]);

  // Start the application
  await app.listen(port);
  
  // Log information
  logger.log('Bootstrap', `🚀 Application démarrée sur le port: ${port}`);
  logger.log('Bootstrap', `📚 Swagger UI: http://localhost:${port}/swagger`);
  logger.log('Bootstrap', `📄 Swagger JSON v1: http://localhost:${port}/docs/v1-json`);
  logger.log('Bootstrap', `📄 Swagger JSON v2: http://localhost:${port}/docs/v2-json`);
}

bootstrap();