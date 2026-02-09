# API Etokisana

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

## Description

API Etokisana est une application backend construite avec **NestJS**, **MongoDB** et **TypeScript**. Elle fournit une API RESTful documentée avec **Swagger**, configurable via des variables d'environnement avec **@nestjs/config** et **Joi** pour la validation.

### Technologies

- **Framework**: NestJS 11.0
- **Database**: MongoDB avec Mongoose ORM
- **Documentation API**: Swagger/OpenAPI
- **Configuration**: @nestjs/config avec Joi validation
- **Language**: TypeScript
- **Logging**: Logger service uniforme


## Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine du projet en vous basant sur `.env.example`. Voici les variables requises :

#### Configuration de base
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/api-etokisana
NODE_ENV=development
```

#### Configuration JWT
```env
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_change_in_production
JWT_REFRESH_EXPIRES_IN=7d
```

#### Configuration SMTP
```env
SMTP_HOST=your_smtp_host
SMTP_PORT=your_smtp_port
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM="Etokisana Support <no-reply@etokisana.com>"
```

#### Configuration applicative
```env
APP_NAME=CommerceGestion
APP_URL=http://localhost:5000
ADMIN_EMAIL=admin@example.com
CORS_ALLOWLIST=http://localhost:3000,http://localhost:4200
FRONTEND_URL=http://localhost:3000
```

### Installation des dépendances

```bash
npm install
```

## Démarrage

```bash
# Mode développement
npm run start:dev

# Mode production
npm run start:prod
```

## Documentation API

Une fois l'application lancée, la documentation Swagger est accessible à :

```
http://localhost:3000/api/docs
```

## Versions de l'API

L'application supporte deux versions de l'API :

### V1 (`/api/v1`)
Version complète avec fonctionnalités avancées :
- **Authentification**: Gestion JWT avec refresh token
- **Autorisation**: Système de rôles et permissions
- **Audit**: Logging des actions utilisateur
- **Modules**: Users, Auth, Audit

**Endpoints disponibles**:
- `GET/POST /api/v1/users` - Gestion des utilisateurs
- `POST /api/v1/auth/login` - Authentification
- `GET /api/v1/audit` - Logs d'audit

### V2 (`/api/v2`)
Version allégée et optimisée :
- Fonctionnalités essentielles
- Performance améliorée
- Modules**: Users, Upload

**Endpoints disponibles**:
- `GET/POST /api/v2/users` - Gestion des utilisateurs
- `POST /api/v2/upload` - Gestion des fichiers

**Conseil**: Utilisez V1 pour une intégration complète avec audit et autorisation, V2 pour des cas d'usage simples et performants.

## Structure du projet

```
src/
├── config/                    # Configurations (Swagger, etc.)
├── common/
│   └── logger/               # Logger service uniforme
├── shared/
│   ├── interfaces/           # Interfaces partagées (pagination, etc.)
│   ├── mail/                 # Service d'emailing avec templates Handlebars
│   └── upload/               # Service de gestion des fichiers
├── database/                 # Configuration MongoDB et Mongoose
├── v1/                       # API Version 1 (Complète)
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   ├── auth/                 # Authentification JWT avec refresh token
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── guards/           # JWT & Role guards
│   │   ├── strategies/       # JWT strategies
│   │   ├── decorators/       # Auth decorators
│   │   └── dto/              # DTOs (Login, Logout, VerifyToken)
│   ├── users/                # Gestion des utilisateurs
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   ├── users.schema.ts
│   │   └── dto/              # DTOs (Create, Update)
│   └── audit/                # Logging et audit
│       ├── audit.service.ts
│       ├── audit.controller.ts
│       └── audit.schema.ts
├── v2/                       # API Version 2 (Allégée & Optimisée)
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   └── users/                # Gestion basique des utilisateurs
│       ├── users.service.ts
│       ├── users.controller.ts
│       ├── users.schema.ts
│       └── dto/              # DTOs (Create, Update)
├── app.module.ts             # Module principal
├── main.ts                   # Point d'entrée
```

## Tests

```bash
# Tests unitaires
npm run test

# Tests e2e
npm run test:e2e

# Couverture de code
npm run test:cov
```

## Linting

```bash
npm run lint
```

## License

MIT
