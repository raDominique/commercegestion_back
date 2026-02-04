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

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```env
MONGO_URI=mongodb://localhost:27017/etokisana
PORT=3000
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES=24h
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

## Structure du projet

```
src/
├── config/          # Configurations (Swagger, etc.)
├── common/          # Utilitaires partagés (Logger, etc.)
├── shared/          # Ressources partagées
├── app.module.ts    # Module principal
├── app.controller.ts
├── app.service.ts
└── main.ts          # Point d'entrée
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
