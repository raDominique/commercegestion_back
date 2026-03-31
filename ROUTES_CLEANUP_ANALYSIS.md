# Analyse des Routes Doublons

## Situation Actuelle

Il existe une **duplication de routes** entre:
1. **StockModule** (ancien système de mouvements)
2. **TransactionsModule** (nouveau système)
3. **LedgerDisplayModule** (affichage)

---

## Routes Doublons Identifiées

### 1️⃣ CRÉER UN DÉPÔT
| Route | Module | Rôle | Status |
|-------|--------|------|--------|
| `POST /deposit` | Stock | Ancien système | ❌ À supprimer |
| `POST /transactions/deposit` | Transactions | Nouveau système | ✅ Garder |

**Raison:** Le nouveau système Transactions est plus complet avec validation et approbation.

---

### 2️⃣ RETIRER/RETOURNER
| Route | Module | Rôle | Status |
|-------|--------|------|--------|
| `POST /withdraw` | Stock | Ancien système | ❌ À supprimer |
| `POST /transactions/return` | Transactions | Nouveau système | ✅ Garder |

**Raison:** Return gère les retours avec gestion des passifs.

---

### 3️⃣ MES ACTIFS
| Route | Module | Rôle | Status |
|-------|--------|------|--------|
| `GET /my-actifs` | Stock | Liste de mes actifs | ❌ À supprimer |
| `GET /ledger/user/:userId` | LedgerDisplay | Grand livre complet | ✅ Garder |
| `GET /ledger/actifs/:userId` | LedgerDisplay | Actifs uniquement | ✅ Garder |

**Raison:** LedgerDisplay offre une meilleure vue d'ensemble et formatage.

---

### 4️⃣ MES PASSIFS
| Route | Module | Rôle | Status |
|-------|--------|------|--------|
| `GET /my-passifs` | Stock | Liste de mes passifs | ❌ À supprimer |
| `GET /ledger/user/:userId` | LedgerDisplay | Grand livre avec passifs | ✅ Garder |
| `GET /ledger/passifs/:userId` | LedgerDisplay | Passifs uniquement | ✅ Garder |

**Raison:** LedgerDisplay offre une vue formatée avec historique des mouvements.

---

### 5️⃣ HISTORIQUE DES MOUVEMENTS
| Route | Module | Rôle | Status |
|-------|--------|------|--------|
| `GET /history` | Stock | Historique des mouvements | ❌ À supprimer |
| `GET /ledger/global` | LedgerDisplay | Tous les mouvements | ✅ Garder |
| `GET /transactions/user/:userId` | Transactions | Transactions utilisateur | ✅ Garder |

**Raison:** LedgerDisplay affiche un grand livre formaté et lisible.

---

### 6️⃣ DÉTAILS D'UN ACTIF
| Route | Module | Rôle | Status |
|-------|--------|------|--------|
| `GET /actif/:id` | Stock | Détails ancien système | ❌ À supprimer |
| `GET /ledger/stock-card/:userId/:productId` | LedgerDisplay | Fiche de stock | ✅ Garder |
| `GET /actifs/get-by-id/:id` | Actifs | Détails simple | ✅ Garder |

**Raison:** `stock-card` est plus complet et affiche les mouvements historiques.

---

## Routes à GARDER

### Stock Controller (Nettoyé)
✅ Routes spécifiques au stock qui ne doublonnent pas:

| Route | Utilité |
|-------|---------|
| `POST /transfer` | Transférer physiquement (changer détenteur) |
| `POST /virement` | Virement de propriété (changer ayant-droit) |
| `GET /site-actifs/:siteId` | Actifs d'un site spécifique |
| `GET /site-passifs/:siteId` | Passifs d'un site spécifique |
| `GET /deposits` | Liste des dépôts effectués |
| `GET /withdrawals` | Liste des retraits effectués |
| `POST /flag-movement/:movementId` | Signaler un mouvement invalide |
| `POST /validate-movement/:movementId` | Valider un mouvement |

---

### Transactions Controller
✅ Routes complètes et fonctionnelles:

| Route | Utilité |
|-------|---------|
| `POST /transactions/deposit` | Créer un dépôt |
| `POST /transactions/return` | Créer un retour |
| `POST /transactions/initialization` | Initialiser un stock |
| `PATCH /transactions/:id/approve` | Approuver une transaction |
| `PATCH /transactions/:id/reject` | Rejeter une transaction |
| `GET /transactions/:id` | Détails d'une transaction |
| `GET /transactions/pending/list` | Transactions en attente |
| `GET /transactions/user/:userId` | Transactions d'un utilisateur |

---

### Ledger Display Controller
✅ Routes pour l'affichage du grand livre:

| Route | Utilité |
|-------|---------|
| `GET /ledger/user/:userId` | Grand livre complet utilisateur |
| `GET /ledger/global` | Grand livre global système |
| `GET /ledger/product/:productId` | Mouvements d'un produit |
| `GET /ledger/stock-card/:userId/:productId` | Fiche de stock détaillée |
| `GET /ledger/actifs/:userId` | Mouvements d'actifs |
| `GET /ledger/passifs/:userId` | Mouvements de passifs |

---

## Routes à SUPPRIMER du StockController

```
POST /deposit                    ❌
POST /withdraw                   ❌
GET /my-actifs                   ❌
GET /my-passifs                  ❌
GET /history                     ❌
GET /actif/:id                   ❌
GET /passif/:id                  ❌
```

---

## Résumé du Nettoyage

| Action | Avant | Après |
|--------|-------|-------|
| Routes doublons | 7 routes | 0 routes |
| Routes stocks résiduelles | 14 routes | 8 routes |
| Routes transactions | 8 endpoints | 8 endpoints |
| Routes ledger | 6 endpoints | 6 endpoints |
| **Total API** | **28 routes** | **22 routes** |

---

## Plan de Suppression

### Étape 1: Supprimer les routesdoublons du StockController
- Supprimer: `POST /deposit`
- Supprimer: `POST /withdraw`
- Supprimer: `GET /my-actifs`
- Supprimer: `GET /my-passifs`
- Supprimer: `GET /history`
- Supprimer: `GET /actif/:id`
- Supprimer: `GET /passif/:id`

### Étape 2: Mettre à jour la documentation
- Documenter les routes conservées
- Ajouter des notes de migration pour le frontend

### Étape 3: Validation
- Vérifier qu'aucune route ne demande les méthodes supprimées
- Tester les endpoints restants

---

## Migration pour le Frontend

Si le frontend utilise les anciennes routes, il doit migrer vers:

```
OLD                          → NEW
POST /deposit               → POST /transactions/deposit
POST /withdraw              → POST /transactions/return
GET /my-actifs              → GET /ledger/user/:userId (field: actifs)
GET /my-passifs             → GET /ledger/user/:userId (field: passifs)
GET /history                → GET /transactions/user/:userId
GET /actif/:id              → GET /ledger/stock-card/:userId/:productId
```

