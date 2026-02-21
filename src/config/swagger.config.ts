import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModuleV1 } from '../v1/app.module';
import { AppModuleV2 } from '../v2/app.module';

interface SwaggerVersionConfig {
  module: any;
  version: string;
  path: string;
}

/**
 * Description détaillée des WebSockets pour Swagger
 * Cela permet de documenter les événements sans support natif OpenAPI
 */
const wsDescription = `
---
## 📡 Documentation WebSockets (Socket.io)
L'API utilise **Socket.io** pour les notifications en temps réel et les alertes administrateur.

### 🔌 Détails de Connexion
- **URL :** \`ws://votre-serveur:port\`
- **Query Params obligatoires :**
    - \`userId\`: ID unique de l'utilisateur.
    - \`userAccess\`: Rôle de l'utilisateur (\`ADMIN\` ou \`UTILISATEUR\`).

### 📥 Événements en écoute (Client)
| Événement | Room | Description |
| :--- | :--- | :--- |
| **\`notification\`** | \`user_{userId}\` | Notifications personnelles (ex: validation de compte). |
| **\`admin_event\`** | \`admin_room\` | Alertes globales pour tous les admins (ex: nouveau compte créé). |

### 💻 Exemple d'implémentation (Frontend)
\`\`\`javascript
const socket = io('http://localhost:3000', {
  query: { 
    userId: '65d63f...', 
    userAccess: 'ADMIN' 
  }
});

socket.on('admin_event', (data) => {
  console.log('Nouvelle alerte admin :', data.message);
});
\`\`\`
---
`;

export function setupSwagger(
  app: INestApplication,
  versions: SwaggerVersionConfig[],
) {
  // --- CONFIGURATION V1 ---
  const configV1 = new DocumentBuilder()
    .setTitle('API commercegestion v1')
    .setDescription(
      `${wsDescription}\n\nDocumentation de l'API commercegestion v1`,
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const documentV1 = SwaggerModule.createDocument(app, configV1, {
    include: [AppModuleV1],
    deepScanRoutes: true,
  });

  // --- CONFIGURATION V2 ---
  const configV2 = new DocumentBuilder()
    .setTitle('API commercegestion v2')
    .setDescription(
      `${wsDescription}\n\nDocumentation de l'API commercegestion v2`,
    )
    .setVersion('2.0')
    .addBearerAuth()
    .build();

  const documentV2 = SwaggerModule.createDocument(app, configV2, {
    include: [AppModuleV2],
    deepScanRoutes: true,
  });

  // --- Endpoints JSON (pour l'explorer ou outils tiers) ---
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/docs/v1-json', (_, res) => res.json(documentV1));
  httpAdapter.get('/docs/v2-json', (_, res) => res.json(documentV2));

  // --- SETUP SWAGGER UI ---
  SwaggerModule.setup('swagger', app, documentV1, {
    explorer: true,
    swaggerOptions: {
      urls: [
        { url: '/docs/v1-json', name: 'Version 1 (V1)' },
        { url: '/docs/v2-json', name: 'Version 2 (V2)' },
      ],
      persistAuthorization: true, // Garde le token Bearer après refresh
      displayRequestDuration: true,
    },
    customSiteTitle: 'Documentation API CommerceGestion',
  });
}
