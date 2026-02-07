import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from './common/logger/logger.service';
import { setupSwagger } from './config/swagger.config';
import { AppModule } from './app.module';
import { AppModuleV1 } from './v1/app.module';
import { AppModuleV2 } from './v2/app.module';
import { VersioningType } from '@nestjs/common';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;
  const logger = new LoggerService('Bootstrap');

  app.enableVersioning({
    type: VersioningType.URI,
  });

  // Cors configuration
  const allowlist =
    configService.get<string>('CORS_ALLOWLIST')?.split(',') || [];
  if (allowlist.length > 0) {
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || allowlist.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      allowedHeaders: 'Content-Type, Accept',
    });
    logger.log(
      'Bootstrap',
      `CORS configuré avec allowlist: ${allowlist.join(', ')}`,
    );
  } else {
    app.enableCors({
      origin: '*',
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      allowedHeaders: 'Content-Type, Accept',
    });
    logger.warn(
      'Bootstrap',
      'CORS configuré pour autoriser toutes les origines (pas de allowlist définie)',
    );
  }
  app.setGlobalPrefix('api');
  // Configure Swagger for both versions
  setupSwagger(app, [
    { module: AppModuleV1, version: 'v1', path: 'v1' },
    { module: AppModuleV2, version: 'v2', path: 'v2' },
  ]);

  // Servir les fichiers statiques
  app.use('/upload', express.static(join(process.cwd(), 'upload')));

  // Start the application
  await app.listen(port);

  // Log information
  logger.log('Bootstrap', `Application démarrée sur le port: ${port}`);
  logger.log('Bootstrap', `Swagger UI: http://localhost:${port}/swagger`);
}

bootstrap();
