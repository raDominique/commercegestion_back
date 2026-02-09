# API Etokisana

<p align="center">
  <a href="http://nestjs.com/" target="blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
  </a>
</p>

<p align="center">
  Une API RESTful moderne et évolutive construite avec NestJS, MongoDB et TypeScript
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#démarrage">Démarrage</a> •
  <a href="#documentation-api">Documentation</a> •
  <a href="#versions-de-lapi">Versions</a>
</p>

---

## 📋 Table des matières

- [Description](#description)
- [Fonctionnalités](#fonctionnalités)
- [Technologies](#technologies)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Documentation API](#documentation-api)
- [Versions de l'API](#versions-de-lapi)
- [Structure du projet](#structure-du-projet)
- [Tests](#tests)
- [Linting](#linting)
- [Dépannage](#dépannage)
- [License](#license)

---

## Description

**API Etokisana** est une application backend robuste et performante développée avec **NestJS**, offrant une architecture modulaire et évolutive. L'API fournit deux versions distinctes pour répondre à différents besoins :

- **Version 1 (V1)** : Solution complète avec authentification avancée, autorisation basée sur les rôles et système d'audit
- **Version 2 (V2)** : Version allégée et optimisée pour des cas d'usage simples nécessitant des performances maximales

L'application utilise **MongoDB** comme base de données, **Mongoose** comme ORM, et propose une documentation interactive via **Swagger/OpenAPI**.

---

## ✨ Fonctionnalités

### Version 1 (Complète)
- ✅ Authentification JWT avec refresh tokens
- ✅ Système d'autorisation basé sur les rôles et permissions
- ✅ Logging et audit des actions utilisateurs
- ✅ Gestion avancée des utilisateurs
- ✅ Service d'envoi d'emails avec templates Handlebars
- ✅ Gestion sécurisée des fichiers

### Version 2 (Optimisée)
- ⚡ Performance optimisée
- ⚡ Gestion basique des utilisateurs
- ⚡ Upload de fichiers simplifié
- ⚡ Idéale pour les intégrations légères

### Fonctionnalités communes
- 📚 Documentation API interactive (Swagger)
- 🔒 Validation des données avec Joi
- 🌍 Configuration flexible via variables d'environnement
- 📝 Logger service uniforme
- 🔄 Support CORS configurable

---

## 🛠 Technologies

| Technologie | Version | Usage |
|------------|---------|-------|
| **NestJS** | 11.0 | Framework backend |
| **MongoDB** | Latest | Base de données NoSQL |
| **Mongoose** | Latest | ODM pour MongoDB |
| **TypeScript** | Latest | Langage de programmation |
| **Swagger/OpenAPI** | Latest | Documentation API |
| **@nestjs/config** | Latest | Gestion de configuration |
| **Joi** | Latest | Validation de schémas |
| **Passport JWT** | Latest | Authentification |
| **Handlebars** | Latest | Moteur de templates pour emails |

---

## 📦 Installation

### Prérequis

Assurez-vous d'avoir installé :
- **Node.js** (version 18.x ou supérieure)
- **npm** ou **yarn**
- **MongoDB** (version 6.x ou supérieure)

### Installation des dépendances

```bash
# Cloner le projet
git clone <repository-url>
cd api-etokisana

# Installer les dépendances
npm install
```

---

## ⚙️ Configuration

### Variables d'environnement

Créez un fichier `.env` à la racine du projet en vous basant sur `.env.example` :

```bash
cp .env.example .env
```

### Configuration de base

```env
# Application
PORT=5000
NODE_ENV=development
APP_NAME=CommerceGestion
APP_URL=http://localhost:5000
ADMIN_EMAIL=admin@example.com

# Frontend
FRONTEND_URL=http://localhost:3000
CORS_ALLOWLIST=http://localhost:3000,http://localhost:4200

# Base de données
MONGO_URI=mongodb://localhost:27017/api-etokisana
```

### Configuration JWT

```env
# Access Token
JWT_SECRET=your_jwt_secret_key_change_in_production
JWT_EXPIRES_IN=15m

# Refresh Token
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_change_in_production
JWT_REFRESH_EXPIRES_IN=7d
```

> ⚠️ **Important** : Changez les secrets JWT en production pour assurer la sécurité.

### Configuration SMTP

```env
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM="Etokisana Support <no-reply@etokisana.com>"
```

---

## 🚀 Démarrage

### Mode développement

```bash
npm run start:dev
```

L'API sera accessible sur `http://localhost:5000`

### Mode production

```bash
# Build
npm run build

# Démarrage
npm run start:prod
```

### Mode watch

```bash
npm run start:watch
```

---

## 📖 Documentation API

La documentation Swagger/OpenAPI est automatiquement générée et accessible une fois l'application lancée :

```
http://localhost:5000/api/docs
```

La documentation interactive vous permet de :
- 📋 Explorer tous les endpoints disponibles
- 🧪 Tester les requêtes directement depuis l'interface
- 📝 Consulter les schémas de données
- 🔐 Tester l'authentification JWT

---

## 🔄 Versions de l'API

### Version 1 - Complète (`/api/v1`)

Version avec fonctionnalités avancées incluant l'authentification, l'autorisation et l'audit.

#### Modules disponibles
- **Auth** : Authentification JWT avec refresh tokens
- **Users** : Gestion complète des utilisateurs
- **Audit** : Système de logging et traçabilité

#### Endpoints principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `POST` | `/api/v1/auth/login` | Connexion utilisateur |
| `POST` | `/api/v1/auth/refresh` | Rafraîchir le token |
| `POST` | `/api/v1/auth/logout` | Déconnexion |
| `GET` | `/api/v1/users` | Liste des utilisateurs |
| `POST` | `/api/v1/users` | Créer un utilisateur |
| `GET` | `/api/v1/users/:id` | Détails d'un utilisateur |
| `PATCH` | `/api/v1/users/:id` | Modifier un utilisateur |
| `DELETE` | `/api/v1/users/:id` | Supprimer un utilisateur |
| `GET` | `/api/v1/audit` | Consulter les logs d'audit |

**Cas d'usage recommandés :**
- Applications nécessitant une authentification robuste
- Systèmes avec gestion de rôles et permissions
- Applications nécessitant un audit trail complet

---

### Version 2 - Optimisée (`/api/v2`)

Version allégée pour des performances maximales et une intégration simplifiée.

#### Modules disponibles
- **Users** : Gestion simplifiée des utilisateurs
- **Upload** : Gestion des fichiers

#### Endpoints principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/api/v2/users` | Liste des utilisateurs |
| `POST` | `/api/v2/users` | Créer un utilisateur |
| `POST` | `/api/v2/upload` | Upload de fichiers |

**Cas d'usage recommandés :**
- Microservices simples
- Prototypes et MVP
- Applications nécessitant des temps de réponse minimaux

---

## 📁 Structure du projet

```
src/
├── config/                      # Configuration de l'application
│   ├── swagger.config.ts        # Configuration Swagger
│   └── database.config.ts       # Configuration MongoDB
│
├── common/                      # Modules communs
│   └── logger/                  # Service de logging uniforme
│       └── logger.service.ts
│
├── shared/                      # Modules partagés
│   ├── interfaces/              # Interfaces TypeScript
│   │   └── pagination.interface.ts
│   ├── mail/                    # Service d'emailing
│   │   ├── mail.service.ts
│   │   └── templates/           # Templates Handlebars
│   └── upload/                  # Service de gestion des fichiers
│       └── upload.service.ts
│
├── database/                    # Configuration base de données
│   ├── database.module.ts
│   └── database.providers.ts
│
├── v1/                          # API Version 1 (Complète)
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   │
│   ├── auth/                    # Module d'authentification
│   │   ├── auth.module.ts
│   │   ├── auth.service.ts
│   │   ├── auth.controller.ts
│   │   ├── guards/              # Guards (JWT, Roles)
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── strategies/          # Stratégies Passport
│   │   │   ├── jwt.strategy.ts
│   │   │   └── jwt-refresh.strategy.ts
│   │   ├── decorators/          # Décorateurs personnalisés
│   │   │   ├── current-user.decorator.ts
│   │   │   └── roles.decorator.ts
│   │   └── dto/                 # Data Transfer Objects
│   │       ├── login.dto.ts
│   │       ├── logout.dto.ts
│   │       └── verify-token.dto.ts
│   │
│   ├── users/                   # Module utilisateurs
│   │   ├── users.module.ts
│   │   ├── users.service.ts
│   │   ├── users.controller.ts
│   │   ├── schemas/
│   │   │   └── user.schema.ts
│   │   └── dto/
│   │       ├── create-user.dto.ts
│   │       └── update-user.dto.ts
│   │
│   └── audit/                   # Module d'audit
│       ├── audit.module.ts
│       ├── audit.service.ts
│       ├── audit.controller.ts
│       └── schemas/
│           └── audit.schema.ts
│
├── v2/                          # API Version 2 (Optimisée)
│   ├── app.module.ts
│   ├── app.controller.ts
│   ├── app.service.ts
│   │
│   └── users/                   # Gestion basique des utilisateurs
│       ├── users.module.ts
│       ├── users.service.ts
│       ├── users.controller.ts
│       ├── schemas/
│       │   └── user.schema.ts
│       └── dto/
│           ├── create-user.dto.ts
│           └── update-user.dto.ts
│
├── app.module.ts                # Module racine
└── main.ts                      # Point d'entrée de l'application
```

---

## 🧪 Tests

```bash
# Tests unitaires
npm run test

# Tests unitaires en mode watch
npm run test:watch

# Tests end-to-end
npm run test:e2e

# Couverture de code
npm run test:cov
```

Les résultats de couverture sont disponibles dans le dossier `coverage/`.

---

## 🔍 Linting

```bash
# Vérifier le code
npm run lint

# Corriger automatiquement
npm run lint:fix
```

---

## 🛠 Dépannage

### Erreur : "Transaction numbers are only allowed on a replica set member or mongos"

Cette erreur survient lorsque l'application tente d'utiliser des transactions MongoDB sur une instance standalone. Les transactions nécessitent un **Replica Set**.

---

#### 🍎 Configuration pour macOS

**Méthode 1 : Avec Homebrew (Recommandé)**

Si MongoDB est installé via Homebrew, suivez ces étapes :

**Étape 1 : Arrêter MongoDB**

```bash
brew services stop mongodb-community
```

**Étape 2 : Créer un fichier de configuration**

Créez ou éditez le fichier `/usr/local/etc/mongod.conf` :

```bash
nano /usr/local/etc/mongod.conf
```

Ajoutez la configuration du replica set :

```yaml
# mongod.conf
storage:
  dbPath: /usr/local/var/mongodb
systemLog:
  destination: file
  path: /usr/local/var/log/mongodb/mongo.log
  logAppend: true
net:
  bindIp: 127.0.0.1
  port: 27017
replication:
  replSetName: rs0
```

**Étape 3 : Démarrer MongoDB avec le replica set**

```bash
brew services start mongodb-community
```

**Étape 4 : Initialiser le replica set**

Connectez-vous au shell MongoDB :

```bash
mongosh
```

Initialisez le replica set :

```javascript
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" }
  ]
})
```

Vérifiez le statut :

```javascript
rs.status()
```

Vous devriez voir `"stateStr": "PRIMARY"` dans la sortie.

**Méthode 2 : Démarrage manuel**

Si vous préférez démarrer MongoDB manuellement :

```bash
# Créer le dossier de données (si nécessaire)
mkdir -p ~/mongodb/data

# Démarrer MongoDB avec replica set
mongod --replSet rs0 --dbPath ~/mongodb/data --port 27017
```

Dans un nouveau terminal, initialisez le replica set :

```bash
mongosh
```

```javascript
rs.initiate()
```

---

#### 🪟 Configuration pour Windows

**Méthode 1 : Avec MongoDB en tant que service (Recommandé)**

**Étape 1 : Arrêter le service MongoDB**

Ouvrez PowerShell ou CMD en tant qu'administrateur :

```powershell
net stop MongoDB
```

**Étape 2 : Modifier le fichier de configuration**

Localisez et éditez le fichier `mongod.cfg` (généralement dans `C:\Program Files\MongoDB\Server\{version}\bin\mongod.cfg`) :

```yaml
# mongod.cfg
storage:
  dbPath: C:\data\db
systemLog:
  destination: file
  path: C:\data\log\mongod.log
  logAppend: true
net:
  bindIp: 127.0.0.1
  port: 27017
replication:
  replSetName: rs0
```

**Étape 3 : Démarrer le service MongoDB**

```powershell
net start MongoDB
```

**Étape 4 : Initialiser le replica set**

Ouvrez le shell MongoDB :

```powershell
mongosh
```

Initialisez le replica set :

```javascript
rs.initiate({
  _id: "rs0",
  members: [
    { _id: 0, host: "localhost:27017" }
  ]
})
```

Vérifiez le statut :

```javascript
rs.status()
```

**Méthode 2 : Démarrage manuel**

Si vous ne voulez pas modifier le service, démarrez MongoDB manuellement :

**Étape 1 : Arrêter le service**

```powershell
net stop MongoDB
```

**Étape 2 : Créer les dossiers nécessaires**

```powershell
mkdir C:\mongodb\data
mkdir C:\mongodb\log
```

**Étape 3 : Démarrer MongoDB avec replica set**

```powershell
"C:\Program Files\MongoDB\Server\{version}\bin\mongod.exe" --replSet rs0 --dbpath C:\mongodb\data --port 27017
```

Remplacez `{version}` par votre version de MongoDB (ex: `7.0`).

**Étape 4 : Initialiser le replica set**

Dans un nouveau terminal PowerShell :

```powershell
mongosh
```

```javascript
rs.initiate()
```

---

#### 🔧 Configuration finale commune (Windows & macOS)

**Étape 1 : Mettre à jour l'URI MongoDB**

Dans votre fichier `.env`, ajoutez le paramètre `replicaSet` :

```env
MONGO_URI=mongodb://localhost:27017/api-etokisana?replicaSet=rs0
```

**Étape 2 : Vérifier la configuration**

Connectez-vous à MongoDB et vérifiez :

```bash
mongosh
```

```javascript
// Vérifier le statut du replica set
rs.status()

// Vérifier la configuration
rs.conf()

// Vous devriez voir quelque chose comme :
// {
//   _id: 'rs0',
//   members: [ { _id: 0, host: 'localhost:27017' } ]
// }
```

**Étape 3 : Redémarrer l'application**

```bash
npm run start:dev
```

---

#### ✅ Vérification finale

Pour confirmer que tout fonctionne correctement :

1. **Vérifier que MongoDB est en mode replica set :**

```bash
mongosh
```

```javascript
db.adminCommand({ replSetGetStatus: 1 })
```

Vous devriez voir `"ok": 1` et `"myState": 1` (PRIMARY).

2. **Tester une transaction :**

```javascript
const session = db.getMongo().startSession()
session.startTransaction()
// Vos opérations ici
session.commitTransaction()
session.endSession()
```

3. **Lancer l'application et vérifier les logs :**

```bash
npm run start:dev
```

Si vous ne voyez pas d'erreur de transaction, la configuration est réussie ! 🎉

### Autres problèmes courants

#### Port déjà utilisé

Si le port 5000 est déjà utilisé, modifiez la variable `PORT` dans le fichier `.env`.

#### Connexion MongoDB refusée

Vérifiez que MongoDB est en cours d'exécution :

```bash
# Sur macOS/Linux
sudo systemctl status mongod

# Sur Windows
net start MongoDB
```

#### Problèmes d'installation des dépendances

Supprimez `node_modules` et le fichier `package-lock.json`, puis réinstallez :

```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 📄 License

Ce projet est sous licence **MIT**.

---

## 👥 Support

Pour toute question ou problème :

- 📧 Email : support@etokisana.com
- 🐛 Issues : [GitHub Issues](https://github.com/your-repo/issues)
- 📚 Documentation complète : [Wiki](https://github.com/your-repo/wiki)

---

<p align="center">
  Développé avec ❤️ par l'équipe Etokisana
</p>