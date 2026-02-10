import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppModuleV1 } from './v1/app.module';
import { AppModuleV2 } from './v2/app.module';
import { ConfigService } from '@nestjs/config';
import { VersioningType } from '@nestjs/common';
import { join } from 'path';
import * as express from 'express';

import { LoggerService } from './common/logger/logger.service';
import { setupSwagger } from './config/swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const logger = new LoggerService('Bootstrap');

  const port = configService.get<number>('PORT') ?? 5000;
  const appUrl = configService.get<string>('APP_URL');

  /**
   * ===============================
   * API VERSIONING
   * ===============================
   */
  app.enableVersioning({
    type: VersioningType.URI,
  });

  /**
   * ===============================
   * CORS CONFIGURATION
   * ===============================
   */
  const allowlist =
    configService
      .get<string>('CORS_ALLOWLIST')
      ?.split(',')
      .map(origin => origin.trim())
      .filter(Boolean) || [];

  logger.log(
    'Bootstrap',
    `CORS allowlist chargée: ${allowlist.join(', ')}`,
  );

  app.enableCors({
    origin: (origin, callback) => {
      // Requêtes server-to-server (curl, Postman, cron, etc.)
      if (!origin) {
        return callback(null, true);
      }

      // Autorise les origines listées ou l’URL de l’API elle-même (Swagger)
      if (allowlist.includes(origin) || origin === appUrl) {
        return callback(null, true);
      }

      logger.warn(
        'CORS',
        `Origin refusée: ${origin}`,
      );

      return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
    ],
    credentials: true,
  });

  /**
   * ===============================
   * GLOBAL PREFIX
   * ===============================
   */
  app.setGlobalPrefix('api');

  /**
   * ===============================
   * SWAGGER (MULTI-VERSIONS)
   * ===============================
   */
  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app, [
      { module: AppModuleV1, version: 'v1', path: 'v1' },
      { module: AppModuleV2, version: 'v2', path: 'v2' },
    ]);

    logger.log(
      'Bootstrap',
      `Swagger UI: ${appUrl}/swagger`,
    );
  }

  /**
   * ===============================
   * STATIC FILES
   * ===============================
   */
  app.use(
    '/upload',
    express.static(join(process.cwd(), 'upload')),
  );

  /**
   * ===============================
   * START SERVER
   * ===============================
   */
  await app.listen(port);

  logger.log(
    'Bootstrap',
    `Application démarrée sur ${appUrl} (port ${port})`,
  );

  logger.log(
    'Bootstrap',
    `Swagger UI: ${appUrl}/swagger`,
  );
}

bootstrap();
