import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { version } from 'process';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('API commercegestion')
    .setDescription('Documentation de l’API commercegestion')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
