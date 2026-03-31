# Documentation des Modules de Transactions et Affichage du Grand Livre

## Vue d'ensemble

Deux nouveaux modules ont été implémentés pour gérer les transactions (dépôts et retours) et afficher le grand livre des transactions:

1. **TransactionsModule** - Gère les transactions de dépôt, retour et initialisation
2. **LedgerDisplayModule** - Affiche le grand livre des actifs et passifs

---

## Module Transactions (`/transactions`)

### Description

Le module Transactions gère les mouvements de produits entre utilisateurs. Il supporte trois types de transactions:
- **DÉPÔT**: Un utilisateur dépose un produit chez un autre
- **RETOUR**: Un utilisateur retourne un produit au propriétaire
- **INITIALISATION**: Un utilisateur initialise son stock initial

### Architecture

```
transactions/
├── transactions.schema.ts      # Schéma MongoDB
├── transactions.service.ts     # Logique métier
├── transactions.controller.ts  # Endpoints API
├── transactions.module.ts      # Module NestJS
├── dto/
│   └── create-transaction.dto.ts  # Data Transfer Objects
└── index.ts                    # Exports
```

### Endpoints API

#### 1. Créer une transaction de dépôt
```
POST /transactions/deposit
Content-Type: application/json

{
  "initiatorId": "69989c5cdff25ef7fe0a460f",      // Qui dépose
  "recipientId": "69989c5cdff25ef7fe0a4611",     // Qui reçoit
  "productId": "69989c5cdff25ef7fe0a460f",       // Le produit
  "originSiteId": "69989c5cdff25ef7fe0a4610",    // Site d'origine
  "destinationSiteId": "69989c5cdff25ef7fe0a4612", // Site destination
  "quantity": 500,                                 // Quantité
  "unitPrice": 100                                 // Prix unitaire (optionnel)
}

Response: {
  "transactionNumber": "20240115103000001",
  "type": "DÉPÔT",
  "status": "PENDING",
  "initiatorId": "69989c5cdff25ef7fe0a460f",
  ...
}
```

#### 2. Créer une transaction de retour
```
POST /transactions/return
Content-Type: application/json

{
  "initiatorId": "69989c5cdff25ef7fe0a460f",      // Qui retourne
  "ayantDroitId": "69989c5cdff25ef7fe0a4611",    // Propriétaire
  "productId": "69989c5cdff25ef7fe0a460f",       // Le produit
  "originSiteId": "69989c5cdff25ef7fe0a4610",    // Site d'origine
  "destinationSiteId": "69989c5cdff25ef7fe0a4612", // Site destination
  "quantity": 500,                                 // Quantité
  "unitPrice": 100                                 // Prix unitaire (optionnel)
}
```

#### 3. Initialiser un stock
```
POST /transactions/initialization
Content-Type: application/json

{
  "initiatorId": "69989c5cdff25ef7fe0a460f",  // Qui initialise
  "productId": "69989c5cdff25ef7fe0a460f",    // Le produit
  "siteId": "69989c5cdff25ef7fe0a4610",       // Site d'initialisation
  "quantity": 1000,                            // Quantité initiale
  "unitPrice": 100                             // Prix unitaire (optionnel)
}
```

#### 4. Approuver une transaction
```
PATCH /transactions/:id/approve
Content-Type: application/json

{
  "approverUserId": "69989c5cdff25ef7fe0a460f",
  "notes": "Dépôt conforme"  // Optionnel
}
```

#### 5. Rejeter une transaction
```
PATCH /transactions/:id/reject
Content-Type: application/json

{
  "approverUserId": "69989c5cdff25ef7fe0a460f",
  "rejectionReason": "Produit défectueux"
}
```

#### 6. Récupérer une transaction
```
GET /transactions/:id
Response: Transaction details
```

#### 7. Récupérer les transactions en attente
```
GET /transactions/pending/list?userId=...&page=1&limit=10
```

#### 8. Récupérer les transactions d'un utilisateur
```
GET /transactions/user/:userId?page=1&limit=10&status=PENDING
```

### Statuts des Transactions

- **PENDING**: En attente de validation par le receveur
- **APPROVED**: Approuvée et mouvements appliqués
- **REJECTED**: Rejetée

### Types de Transactions

- **DÉPÔT**: Transfert d'un produit vers un autre utilisateur
- **RETOUR**: Retour d'un produit au propriétaire
- **INITIALISATION**: Création du stock initial

---

## Module Ledger Display (`/ledger`)

### Description

Le module Ledger Display affiche le grand livre des transactions, permettant de visualiser tous les mouvements d'actifs et passifs selon le format spécifié dans la documentation.

### Architecture

```
ledger-display/
├── ledger-display.service.ts      # Logique de formatage
├── ledger-display.controller.ts   # Endpoints API
├── ledger-display.module.ts       # Module NestJS
├── dto/
│   └── ledger.dto.ts              # Data Transfer Objects
└── index.ts                        # Exports
```

### Endpoints API

#### 1. Grand livre utilisateur
```
GET /ledger/user/:userId

Response: {
  "userId": "69989c5cdff25ef7fe0a460f",
  "userName": "RAKOTO",
  "movements": {
    "actifs": [
      {
        "dateTime": "2024-01-15T10:30:00Z",
        "transactionNumber": "20240115103000001",
        "title": "INITIALISATION",
        "product": "RIZ MAKALIOKA",
        "holder": "RAKOTO",
        "site": "HANGAR ANDRANOMENA",
        "quantity": 1000,
        "initialStock": 0,
        "finalStock": 1000,
        "movementType": "ACTIF"
      },
      ...
    ],
    "passifs": [
      ...
    ]
  }
}
```

#### 2. Grand livre global
```
GET /ledger/global?page=1&limit=50

Response: {
  "data": [
    {
      "dateTime": "2024-01-15T10:30:00Z",
      "transactionNumber": "20240115103000001",
      ...
    }
  ],
  "total": 150
}
```

#### 3. Mouvements d'un produit
```
GET /ledger/product/:productId?userId=... (optionnel)

Response: [
  {
    "dateTime": "2024-01-15T10:30:00Z",
    "transactionNumber": "20240115103000001",
    ...
  }
]
```

#### 4. Fiche de stock
```
GET /ledger/stock-card/:userId/:productId

Response: {
  "product": "RIZ MAKALIOKA",
  "currentStock": 12500,
  "movements": [
    {
      "dateTime": "2024-01-15T10:30:00Z",
      ...
    }
  ]
}
```

#### 5. Mouvements d'actifs
```
GET /ledger/actifs/:userId

Response: {
  "userId": "69989c5cdff25ef7fe0a460f",
  "actifs": [...]
}
```

#### 6. Mouvements de passifs
```
GET /ledger/passifs/:userId

Response: {
  "userId": "69989c5cdff25ef7fe0a460f",
  "passifs": [...]
}
```

---

## Structure des Données

### Transaction Schema

```typescript
{
  transactionNumber: string,        // YYYY-MM-DD-HH-MM-SS-XXXX
  type: 'DÉPÔT' | 'RETOUR' | 'INITIALISATION',
  status: 'PENDING' | 'APPROVED' | 'REJECTED',
  initiatorId: ObjectId,            // Qui initie
  recipientId?: ObjectId,           // Qui reçoit
  productId: ObjectId,              // Le produit
  originSiteId: ObjectId,           // Site d'origine
  destinationSiteId?: ObjectId,     // Site destination
  quantity: number,                 // Quantité
  unitPrice?: number,               // Prix unitaire
  detentaire?: ObjectId,            // Qui garde physiquement
  ayant_droit?: ObjectId,           // Propriétaire légal
  approvedAt?: Date,                // Date d'approbation
  rejectionReason?: string,         // Raison du rejet
  metadata: object,                 // Données additionnelles
  isActive: boolean,                // Actif?
  createdAt: Date,                  // Créé à
  updatedAt: Date                   // Mis à jour à
}
```

### Ledger Movement

```typescript
{
  dateTime: Date,
  transactionId: string,
  transactionNumber: string,
  title: string,                    // DÉPÔT, RETOUR, INITIALISATION
  product: string,                  // Nom du produit
  holder: string,                   // Détenteur ou Ayant-droit
  site: string,                     // Site
  quantity: number,                 // Quantité (+ ou -)
  initialStock: number,             // Stock avant
  finalStock: number,               // Stock après
  movementType: 'ACTIF' | 'PASSIF'
}
```

---

## Flux de Travail

### Flux de Dépôt Complet

1. **Initiator crée un dépôt**
   ```
   POST /transactions/deposit
   Status: PENDING
   ```

2. **Recipient reçoit une notification** (implémentation côté frontend)
   ```
   GET /transactions/pending/list?userId=recipientId
   ```

3. **Recipient approuve ou rejette**
   ```
   PATCH /transactions/:id/approve
   OU
   PATCH /transactions/:id/reject
   ```

4. **Mouvements appliqués**
   - Les actifs et passifs sont mis à jour
   - Le grand livre affiche les mouvements

5. **Consultation du grand livre**
   ```
   GET /ledger/user/:userId
   ```

---

## Exemple Complet: Dépôt de RIZ MAKALIOKA

**Données initiales:**
- RAKOTO: 12.500 kg dans HANGAR ANDRANOMENA
- RABE: 2.000 kg dans HANGAR ALASORA

**RAKOTO dépose 5.000 kg à RABE:**

```
POST /transactions/deposit
{
  "initiatorId": "64a1f8c9e4b0a5c2d1e2f3g4",
  "recipientId": "64a1f8c9e4b0a5c2d1e2f3g5",
  "productId": "64a1f8c9e4b0a5c2d1e2f3g6",
  "originSiteId": "64a1f8c9e4b0a5c2d1e2f3g7",
  "destinationSiteId": "64a1f8c9e4b0a5c2d1e2f3g8",
  "quantity": 5000,
  "unitPrice": 50000
}

Response:
{
  "_id": "64a1f8c9e4b0a5c2d1e2f3g9",
  "transactionNumber": "20240115103000001",
  "type": "DÉPÔT",
  "status": "PENDING"
}
```

**RABE approuve:**
```
PATCH /transactions/64a1f8c9e4b0a5c2d1e2f3g9/approve
{
  "approverUserId": "64a1f8c9e4b0a5c2d1e2f3g5"
}

Status change: PENDING -> APPROVED
```

**Grand livre de RAKOTO:**
```
GET /ledger/user/64a1f8c9e4b0a5c2d1e2f3g4

{
  "actifs": [
    {
      "title": "Mametráka",
      "product": "RIZ MAKALIOKA",
      "holder": "RAKOTO",
      "site": "HANGAR ANDRANOMENA",
      "quantity": -5000,
      "initialStock": 12500,
      "finalStock": 7500
    }
  ]
}
```

**Grand livre de RABE:**
```
GET /ledger/user/64a1f8c9e4b0a5c2d1e2f3g5

{
  "actifs": [
    {
      "title": "Mametráka",
      "product": "RIZ MAKALIOKA",
      "holder": "RABE",
      "site": "HANGAR ALASORA",
      "quantity": 5000,
      "initialStock": 2000,
      "finalStock": 7000
    }
  ],
  "passifs": [
    {
      "title": "Mametráka",
      "product": "RIZ MAKALIOKA",
      "holder": "RAKOTO",
      "site": "HANGAR ALASORA",
      "quantity": 5000,
      "initialStock": 0,
      "finalStock": 5000
    }
  ]
}
```

---

## Notes Importantes

1. **Les transactions doivent être approuvées** avant que les mouvements soient visibles dans le grand livre
2. **Les stocks initiaux et finaux** sont calculés en fonction de l'historique des mouvements
3. **Les mouvements de passif** sont créés automatiquement lors d'un dépôt
4. **Les numéros de transaction** sont générés automatiquement et sont uniques
5. **Pagination** est supportée sur tous les endpoints de listes

---

## Intégration avec les Modules Existants

Les nouveaux modules s'intègrent avec:
- **ActifsModule**: Pour mettre à jour les actifs lors de l'approbation
- **DatabaseModule**: Pour la persistance MongoDB
- **AuthModule**: Pour la sécurisation des endpoints

