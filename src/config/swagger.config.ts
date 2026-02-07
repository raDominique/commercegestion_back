import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModuleV1 } from '../v1/app.module';
import { AppModuleV2 } from '../v2/app.module';

interface SwaggerVersionConfig {
  module: any;
  version: string;
  path: string;
}

export function setupSwagger(app: INestApplication, versions: SwaggerVersionConfig[]) {
  // --- V1 ---
  const configV1 = new DocumentBuilder()
    .setTitle('API commercegestion v1')
    .setDescription('Documentation de l\'API commercegestion v1')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documentV1 = SwaggerModule.createDocument(app, configV1, {
    include: [AppModuleV1],
    deepScanRoutes: true,
  });

  // --- V2 ---
  const configV2 = new DocumentBuilder()
    .setTitle('API commercegestion v2')
    .setDescription('Documentation de l\'API commercegestion v2')
    .setVersion('2.0')
    .addBearerAuth()
    .build();

  const documentV2 = SwaggerModule.createDocument(app, configV2, {
    include: [AppModuleV2],
    deepScanRoutes: true,
  });

  // --- JSON endpoints ---
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/docs/v1-json', (_, res) => res.json(documentV1));
  httpAdapter.get('/docs/v2-json', (_, res) => res.json(documentV2));

  // --- Swagger UI ---
  SwaggerModule.setup('swagger', app, documentV1, {
    explorer: true,
    swaggerOptions: {
      urls: [
        { url: '/docs/v1-json', name: 'v1' },
        { url: '/docs/v2-json', name: 'v2' },
      ],
    },
  });
}