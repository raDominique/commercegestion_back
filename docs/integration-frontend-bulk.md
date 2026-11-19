# Intégration frontend — Endpoints bulk

Ce document décrit les endpoints « bulk » (opérations en masse) ajoutés au backend, et la façon de les intégrer côté frontend (React + Axios, voir `DOCUMENTATION-frontend.md` §7). Chaque endpoint est accompagné d'un exemple **curl**.

Chaque endpoint bulk est la version « en lot » d'un endpoint unitaire existant : **mêmes champs, mêmes règles métier, mêmes emails et notifications**. Seul le format d'enveloppe change.

> Le **retrait intégral** (`return/withdrawable`, `return/all`) et l'**auto-retrait** sont documentés à part : [integration-frontend-retrait.md](integration-frontend-retrait.md).

---

## Table des matières

1. [Règles communes à tous les endpoints bulk](#1-règles-communes-à-tous-les-endpoints-bulk)
2. [Code frontend réutilisable](#2-code-frontend-réutilisable)
3. [Transactions — créations](#3-transactions--créations)
4. [Transactions — approbation et rejet](#4-transactions--approbation-et-rejet)
5. [Stocks & Mouvements](#5-stocks--mouvements)
6. [Sites](#6-sites)
7. [Boutique (annonces)](#7-boutique-annonces)
8. [Panier](#8-panier)
9. [Administration — utilisateurs](#9-administration--utilisateurs)
10. [Produits — création avec photos et administration](#10-produits--création-avec-photos-et-administration)
11. [Pièges à éviter](#11-pièges-à-éviter)
12. [Récapitulatif des endpoints](#12-récapitulatif-des-endpoints)

---

## 1. Règles communes à tous les endpoints bulk

### 1.1 Format de la requête

Trois formes de body selon le type d'opération :

| Type d'opération | Body | Exemple |
|---|---|---|
| **Créer** plusieurs éléments | `{ "items": [ ... ] }` | dépôts, ventes, sites, annonces… |
| **Agir** sur des éléments existants | `{ "ids": [ ... ] }` (+ champs communs éventuels) | approuver, rejeter, activer, supprimer… |
| **Créer avec fichiers** | `multipart/form-data` : `items` (JSON en texte) + fichiers | produits avec photos (§10.1) |

- **Taille** : 1 à **100** éléments par requête. Au-delà, découper en plusieurs requêtes (voir `chunk` §2.3).
- **`items`** : chaque élément a **exactement le même format** que le body de l'endpoint unitaire.
- **`ids`** : identifiants MongoDB (24 caractères hexadécimaux), **sans doublon**.
- Authentification : `Authorization: Bearer <accessToken>` comme pour tous les endpoints (déjà injecté par `axiosInstance`).

### 1.2 Traitement côté serveur

- Les éléments sont traités **dans l'ordre du tableau, un par un**. L'ordre compte : par exemple, deux transferts successifs du même stock — le second voit le stock laissé par le premier.
- **Succès partiel** : un élément en échec **n'annule pas** les autres. Il n'y a **pas** de « tout ou rien ».
- Conséquence UI : après un appel, certains éléments peuvent être créés et d'autres non. Il faut afficher les deux.

### 1.3 Format de la réponse (succès HTTP 200 / 201)

```json
{
  "status": "partial_success",
  "message": "2 réussite(s), 1 échec(s) sur 3",
  "data": [ { "...": "élément 0 créé" }, { "...": "élément 2 créé" } ],
  "total": 2,
  "errors": [
    { "index": 1, "reason": "Quantité insuffisante. Disponible: 4" }
  ]
}
```

| Champ | Description |
|---|---|
| `status` | `success` (tout a réussi), `partial_success` (au moins un échec), `error` (aucune réussite) |
| `message` | Résumé lisible, affichable tel quel |
| `data` | Éléments traités avec succès, **dans l'ordre**. ⚠️ `data[i]` ne correspond **pas** forcément à `items[i]` quand il y a des échecs |
| `total` | Nombre de réussites (`data.length`) |
| `errors[].index` | Position de l'élément en échec **dans le tableau envoyé** (`items` ou `ids`) |
| `errors[].id` | Présent pour les opérations sur `ids` : l'id en échec |
| `errors[].reason` | Message d'erreur métier (le même que celui de l'endpoint unitaire) |

> ⚠️ **Un lot où tout a échoué renvoie quand même un code HTTP 2xx** avec `status: "error"`. Toujours tester `status`, jamais seulement le code HTTP.

### 1.4 Erreur de validation (HTTP 400)

Si **un seul** élément est mal formé (champ manquant, mauvais type, liste vide, plus de 100 éléments, id invalide, doublon), **toute la requête est refusée** avant traitement : rien n'est créé.

```json
{
  "status": "error",
  "message": "items.1.quantite must be a positive number, items.3.productId must be a mongodb id",
  "data": null
}
```

Le préfixe `items.<index>.<champ>` indique l'élément et le champ fautifs. Il est conseillé de valider côté formulaire avant l'envoi pour éviter ce cas.

### 1.5 Codes HTTP

| Code | Signification |
|---|---|
| `201` | Lot traité (endpoints `POST`) — vérifier `status` |
| `200` | Lot traité (endpoints `PATCH`, et `POST /users/delete/bulk`) — vérifier `status` |
| `400` | Body invalide, rien n'a été traité |
| `401` | Non authentifié / token expiré (refresh automatique par l'intercepteur) |
| `403` | Rôle insuffisant (endpoints ADMIN) |

### 1.6 Préparer les exemples curl

Les exemples sont écrits pour **bash** (Linux, macOS, Git Bash ou WSL sous Windows).

```bash
# URL de l'API (port 5000 par défaut, voir .env)
API=http://localhost:5000/api/v1

# Se connecter pour obtenir un accessToken
curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "userEmail": "membre@example.com", "userPassword": "motdepasse" }'
# → { "accessToken": "eyJ...", "refreshToken": "..." }
#   (si le compte a la 2FA : { "require2FA": true, "loginChallenge": "..." }, terminer avec /auth/2fa/complete)

TOKEN=eyJ...            # jeton d'un membre
ADMIN_TOKEN=eyJ...      # jeton d'un administrateur (§9 et §10.2)
```

Astuce : ajouter `| jq` en fin de commande pour une réponse lisible, ou `-w '\nHTTP %{http_code}\n'` pour voir le code HTTP.

---

## 2. Code frontend réutilisable

### 2.1 Types (TypeScript / JSDoc)

```ts
// src/services/bulk.types.ts
export type BulkStatus = 'success' | 'partial_success' | 'error';

export interface BulkError {
  index: number;   // position dans items / ids envoyés
  id?: string;     // présent pour les opérations sur ids
  reason: string;
}

export interface BulkResult<T> {
  status: BulkStatus;
  message: string;
  data: T[];
  total: number;
  errors: BulkError[];
}
```

### 2.2 Service générique

```js
// src/services/bulk.service.js
import axiosInstance from './axios.config';

export const BULK_MAX_ITEMS = 100;

/**
 * Appelle un endpoint bulk et renvoie le BulkResult.
 * @param {'post'|'patch'} method
 * @param {string} url      ex: '/api/v1/transactions/deposit/bulk'
 * @param {object} body     ex: { items: [...] } ou { ids: [...] }
 */
export async function callBulk(method, url, body) {
  const res = await axiosInstance[method](url, body);
  return res.data; // { status, message, data, total, errors }
}
```

### 2.3 Lots de plus de 100 éléments

```js
export function chunk(array, size = BULK_MAX_ITEMS) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * Envoie `items` par paquets de 100, l'un après l'autre (garder l'ordre),
 * et fusionne les résultats en recalant les index sur le tableau complet.
 */
export async function callBulkChunked(method, url, items, key = 'items', extra = {}) {
  const merged = { data: [], errors: [], total: 0 };
  let offset = 0;
  for (const part of chunk(items)) {
    const result = await callBulk(method, url, { ...extra, [key]: part });
    merged.data.push(...result.data);
    merged.errors.push(
      ...result.errors.map((e) => ({ ...e, index: e.index + offset })),
    );
    merged.total += result.total;
    offset += part.length;
  }
  merged.status = !merged.errors.length
    ? 'success'
    : merged.total
      ? 'partial_success'
      : 'error';
  merged.message = `${merged.total} réussite(s), ${merged.errors.length} échec(s) sur ${items.length}`;
  return merged;
}
```

> Envoyer les paquets **séquentiellement** (`await` dans la boucle), pas en `Promise.all` : l'ordre de traitement compte.

### 2.4 Afficher le résultat

```js
function showBulkResult(result, items, labelOf) {
  if (result.status === 'success') {
    toast.success(result.message);
  } else if (result.status === 'partial_success') {
    toast.warning(result.message);
  } else {
    toast.error(result.message);
  }

  // Détail des échecs, rattachés à la ligne du formulaire / tableau
  return result.errors.map((e) => ({
    ligne: e.index + 1,
    element: labelOf(items[e.index]), // ex: nom du produit
    raison: e.reason,
  }));
}
```

Recommandations UI :

- Marquer en erreur les lignes `errors[].index` dans le tableau de saisie, avec `reason` en info-bulle.
- Proposer un bouton **« Réessayer les échecs »** qui renvoie uniquement `errors.map(e => items[e.index])`.
- Après succès (même partiel), **recharger** les listes concernées (transactions, actifs, panier…).
- Désactiver le bouton d'envoi pendant l'appel : un double clic enverrait deux fois le lot.

---

## 3. Transactions — créations

Base : `/api/v1/transactions` — authentification requise.

| Endpoint bulk | Endpoint unitaire équivalent | Format d'un élément |
|---|---|---|
| `POST /deposit/bulk` | `POST /deposit` | `CreateDepositDto` |
| `POST /return/bulk` | `POST /return` | `CreateReturnDto` |
| `POST /initialization/bulk` | `POST /initialization` | `CreateInitializationDto` |
| `POST /virement-droit/bulk` | `POST /virement-droit` | `CreateVirementDroitDto` |
| `POST /vente/bulk` | `POST /vente` | `CreateVenteDto` |

`data` contient les **transactions créées** (même objet que `data[0]` de l'endpoint unitaire : `_id`, `transactionNumber`, `type`, `status`…).

### 3.1 Dépôts — `POST /api/v1/transactions/deposit/bulk`

| Champ | Requis | Type |
|---|---|---|
| `detentaire` | oui | id du membre qui gardera physiquement |
| `ayant_droit` | oui | id du propriétaire légal (l'utilisateur connecté) |
| `productId` | oui | id produit |
| `siteOrigineId` | oui | id site de départ |
| `siteDestinationId` | oui | id site d'arrivée |
| `quantite` | oui | nombre > 0 |
| `prixUnitaire` | non | nombre ≥ 0 |
| `observations` | non | texte |

```bash
curl -s -X POST "$API/transactions/deposit/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "detentaire": "69989c5cdff25ef7fe0a460f",
        "ayant_droit": "69989c5cdff25ef7fe0a4611",
        "productId": "69989c5cdff25ef7fe0a4620",
        "siteOrigineId": "69989c5cdff25ef7fe0a4610",
        "siteDestinationId": "69989c5cdff25ef7fe0a4612",
        "quantite": 100,
        "prixUnitaire": 1500,
        "observations": "Lot riz n°1"
      },
      {
        "detentaire": "69989c5cdff25ef7fe0a460f",
        "ayant_droit": "69989c5cdff25ef7fe0a4611",
        "productId": "69989c5cdff25ef7fe0a4621",
        "siteOrigineId": "69989c5cdff25ef7fe0a4610",
        "siteDestinationId": "69989c5cdff25ef7fe0a4612",
        "quantite": 40
      }
    ]
  }'
```

Chaque dépôt créé est `PENDING` et réserve la quantité (`quantiteEnAttente`). Plusieurs dépôts du même stock dans un lot se cumulent : si le stock disponible est épuisé en cours de lot, les éléments suivants échouent.

### 3.2 Retraits — `POST /api/v1/transactions/return/bulk`

Mêmes champs que le dépôt (`detentaire`, `ayant_droit`, `productId`, `siteOrigineId`, `siteDestinationId`, `quantite`, `prixUnitaire?`, `observations?`). Le retrayant est l'utilisateur connecté (`ayant_droit` = son id). Chez un autre détenteur, `siteDestinationId` doit être différent de `siteOrigineId` (sinon l'élément échoue) ; en auto-retrait, le même site est accepté.

```bash
curl -s -X POST "$API/transactions/return/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "detentaire": "69989c5cdff25ef7fe0a460f",
        "ayant_droit": "69989c5cdff25ef7fe0a4611",
        "productId": "69989c5cdff25ef7fe0a4620",
        "siteOrigineId": "69989c5cdff25ef7fe0a4612",
        "siteDestinationId": "69989c5cdff25ef7fe0a4613",
        "quantite": 30
      }
    ]
  }'
```

> Pour **tout** retirer chez un détenteur sans lister les produits, ou pour l'**auto-retrait** : voir [integration-frontend-retrait.md](integration-frontend-retrait.md). Le comportement des quantités pendant l'attente d'un retrait y est aussi décrit (§5).

### 3.3 Initialisations — `POST /api/v1/transactions/initialization/bulk`

Champs : `productId`, `siteOrigineId`, `quantite` (> 0), `prixUnitaire?`, `observations?`. Créées directement `APPROVED`.

```bash
curl -s -X POST "$API/transactions/initialization/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "productId": "69989c5cdff25ef7fe0a4620", "siteOrigineId": "69989c5cdff25ef7fe0a4610", "quantite": 1000, "prixUnitaire": 0 },
      { "productId": "69989c5cdff25ef7fe0a4621", "siteOrigineId": "69989c5cdff25ef7fe0a4610", "quantite": 250 }
    ]
  }'
```

### 3.4 Virements de droit — `POST /api/v1/transactions/virement-droit/bulk`

Champs : `beneficiaryId`, `detentaireId`, `siteId`, `productId`, `quantite` (> 0), `observations?`. L'initiateur est l'utilisateur connecté.

```bash
curl -s -X POST "$API/transactions/virement-droit/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "beneficiaryId": "69989c5cdff25ef7fe0a4613",
        "detentaireId": "69989c5cdff25ef7fe0a460f",
        "siteId": "69989c5cdff25ef7fe0a4610",
        "productId": "69989c5cdff25ef7fe0a4620",
        "quantite": 10
      }
    ]
  }'
```

### 3.5 Ventes — `POST /api/v1/transactions/vente/bulk`

Champs : `vendeurId`, `productId`, `siteOrigineId`, `siteDestinationId?`, `quantite` (> 0), `contrepartieId?` (produit reçu en échange, absent = vente monétaire), `rapportEchange` (prix unitaire ou ratio d'échange, 6 décimales max), `observations?`. L'acheteur est l'utilisateur connecté.

```bash
curl -s -X POST "$API/transactions/vente/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "vendeurId": "69989c5cdff25ef7fe0a460f",
        "productId": "69989c5cdff25ef7fe0a4620",
        "siteOrigineId": "69989c5cdff25ef7fe0a4610",
        "siteDestinationId": "69989c5cdff25ef7fe0a4612",
        "quantite": 100,
        "rapportEchange": 500
      }
    ]
  }'
```

> Pour un achat depuis le panier, utiliser `POST /cart/checkout` (inchangé), pas cet endpoint.

### 3.6 Exemple de service

```js
// src/services/transactions.bulk.js
import { callBulk } from './bulk.service';

const base = '/api/v1/transactions';

export const createDepositsBulk = (items) => callBulk('post', `${base}/deposit/bulk`, { items });
export const createReturnsBulk = (items) => callBulk('post', `${base}/return/bulk`, { items });
export const createInitializationsBulk = (items) => callBulk('post', `${base}/initialization/bulk`, { items });
export const createVirementsDroitBulk = (items) => callBulk('post', `${base}/virement-droit/bulk`, { items });
export const createVentesBulk = (items) => callBulk('post', `${base}/vente/bulk`, { items });
```

---

## 4. Transactions — approbation et rejet

| Endpoint bulk | Endpoint unitaire équivalent | Body |
|---|---|---|
| `PATCH /api/v1/transactions/approve/bulk` | `PATCH /:id/approve` | `{ "ids": [...], "observations"?: "..." }` |
| `PATCH /api/v1/transactions/reject/bulk` | `PATCH /:id/reject` | `{ "ids": [...], "motifRejet": "..." }` |

**Différence importante avec l'unitaire** : il n'y a **pas** de champ `approuveurId`. L'approbateur / rejeteur est **l'utilisateur connecté** (lu dans le token). Ne pas l'envoyer : il serait ignoré.

```bash
# Approuver plusieurs transactions
curl -s -X PATCH "$API/transactions/approve/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["6a02a1b2c3d4e5f607182930", "6a02a1b2c3d4e5f607182931"],
    "observations": "Contrôle physique OK"
  }'

# Rejeter plusieurs transactions avec le même motif
curl -s -X PATCH "$API/transactions/reject/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["6a02a1b2c3d4e5f607182932"],
    "motifRejet": "Stock insuffisant"
  }'
```

```js
export const approveTransactionsBulk = (ids, observations) =>
  callBulk('patch', '/api/v1/transactions/approve/bulk', { ids, observations });

export const rejectTransactionsBulk = (ids, motifRejet) =>
  callBulk('patch', '/api/v1/transactions/reject/bulk', { ids, motifRejet });
```

- `observations` : optionnel, appliqué à toutes les transactions approuvées.
- `motifRejet` : **obligatoire**, le même pour toutes.
- Échecs typiques dans `errors` : `Transaction <id> not found`, `Cannot approve transaction with status: APPROVED`, `Couverture insuffisante: …`.
- `errors[].id` contient l'id de la transaction en échec : pratique pour la marquer dans la liste.

Cas d'usage : écran « Transactions en attente » (`GET /api/v1/transactions/pending/list`) avec cases à cocher + boutons « Approuver la sélection » / « Rejeter la sélection » (le rejet ouvre une boîte de dialogue pour saisir le motif).

---

## 5. Stocks & Mouvements

Base : `/api/v1/stocks` — authentification requise.

### 5.1 Créations de mouvements

| Endpoint bulk | Endpoint unitaire équivalent |
|---|---|
| `POST /depot/bulk` | `POST /depot` |
| `POST /transfer/bulk` | `POST /transfer` |
| `POST /virement/bulk` | `POST /virement` |

Les trois prennent le même body ; seul le type de mouvement change.

| Champ | Requis | Remarque |
|---|---|---|
| `siteOrigineId` | non pour `depot`, oui sinon | doit être différent de `siteDestinationId` (sauf dépôt) |
| `siteDestinationId` | oui | |
| `productId` | oui | |
| `quantite` | oui | ≥ 1 |
| `prixUnitaire` | oui | ≥ 0 |
| `detentaire` | non | gardien physique |
| `ayant_droit` | non | nouveau propriétaire (virement) |
| `observations` | non | |

```bash
# Dépôts en stock
curl -s -X POST "$API/stocks/depot/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "siteDestinationId": "69989c5cdff25ef7fe0a4610", "productId": "69989c5cdff25ef7fe0a4620", "quantite": 100, "prixUnitaire": 1500 },
      { "siteDestinationId": "69989c5cdff25ef7fe0a4610", "productId": "69989c5cdff25ef7fe0a4621", "quantite": 50, "prixUnitaire": 900 }
    ]
  }'

# Transferts (même body, autre URL) — idem pour /stocks/virement/bulk
curl -s -X POST "$API/stocks/transfer/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "siteOrigineId": "69989c5cdff25ef7fe0a460f",
        "siteDestinationId": "69989c5cdff25ef7fe0a4610",
        "productId": "69989c5cdff25ef7fe0a4620",
        "quantite": 100,
        "prixUnitaire": 1500,
        "detentaire": "69989c5cdff25ef7fe0a4611"
      }
    ]
  }'
```

`data` contient les **mouvements enregistrés**. L'opérateur est l'utilisateur connecté.

### 5.2 Signalement et revalidation

| Endpoint bulk | Endpoint unitaire équivalent | Body |
|---|---|---|
| `POST /flag-movement/bulk` | `POST /flag-movement/:movementId` | `{ "ids": [...], "reason": "..." }` |
| `POST /validate-movement/bulk` | `POST /validate-movement/:movementId` | `{ "ids": [...] }` |

- `reason` : obligatoire, **1000 caractères max**, le même pour tous les mouvements.
- Un email est envoyé à l'opérateur de chaque mouvement signalé.
- Échec typique dans `errors` : `Mouvement non trouvé`.

```bash
curl -s -X POST "$API/stocks/flag-movement/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["6a03b1c2d3e4f50617283940", "6a03b1c2d3e4f50617283941"],
    "reason": "Quantité reçue inférieure à la quantité déclarée"
  }'

curl -s -X POST "$API/stocks/validate-movement/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "ids": ["6a03b1c2d3e4f50617283940"] }'
```

```js
const base = '/api/v1/stocks';
export const createStockMovementsBulk = (type, items) =>
  // type: 'depot' | 'transfer' | 'virement'
  callBulk('post', `${base}/${type}/bulk`, { items });
export const flagMovementsBulk = (ids, reason) =>
  callBulk('post', `${base}/flag-movement/bulk`, { ids, reason });
export const validateMovementsBulk = (ids) =>
  callBulk('post', `${base}/validate-movement/bulk`, { ids });
```

---

## 6. Sites

`POST /api/v1/sites/bulk-create` — authentification requise. Équivalent de `POST /api/v1/sites`.

Champs : `siteName`, `siteAddress`, `siteLat` (-90 à 90), `siteLng` (-180 à 180), tous requis. Les sites sont créés pour **l'utilisateur connecté**. `data` contient les sites créés.

```bash
curl -s -X POST "$API/sites/bulk-create" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "siteName": "Site Analakely", "siteAddress": "Analakely, Antananarivo", "siteLat": -18.8792, "siteLng": 47.5079 },
      { "siteName": "Dépôt Tamatave", "siteAddress": "Port, Toamasina", "siteLat": -18.1443, "siteLng": 49.3958 }
    ]
  }'
```

```js
export const createSitesBulk = (items) => callBulk('post', '/api/v1/sites/bulk-create', { items });
```

Cas d'usage : import d'une liste de sites (CSV/Excel parsé côté front) lors de l'inscription d'un membre ou d'une banque.

---

## 7. Boutique (annonces)

`POST /api/v1/shop/shop-items/bulk` — authentification requise. Équivalent de `POST /api/v1/shop/shop-items`.

Champs : `productId`, `siteId`, `quantite` (> 0), `prixUnitaire` (> 0), `actifId?`, `description?`. Le vendeur est l'utilisateur connecté. `data` contient les annonces créées.

```bash
curl -s -X POST "$API/shop/shop-items/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "productId": "69989c5cdff25ef7fe0a4620", "siteId": "69989c5cdff25ef7fe0a4610", "quantite": 10, "prixUnitaire": 2500, "description": "Riz blanc" },
      { "productId": "69989c5cdff25ef7fe0a4621", "siteId": "69989c5cdff25ef7fe0a4610", "quantite": 5, "prixUnitaire": 9000 }
    ]
  }'
```

> ⚠️ La quantité n'est **pas réservée** à la création d'une annonce. Le serveur vérifie chaque annonce contre l'actif, indépendamment des autres : deux annonces du même actif dans un lot peuvent dépasser le stock. Le front doit vérifier que la somme des quantités par (produit, site) ne dépasse pas l'actif disponible.

```js
export const createShopItemsBulk = (items) => callBulk('post', '/api/v1/shop/shop-items/bulk', { items });
```

---

## 8. Panier

`POST /api/v1/cart/add/bulk` — authentification requise. Équivalent de `POST /api/v1/cart/add`.

```bash
curl -s -X POST "$API/cart/add/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "shopItemId": "65dcf1234567890abcdef123", "quantite": 2 },
      { "shopItemId": "65dcf1234567890abcdef456", "quantite": 1 }
    ]
  }'
```

Réponse : le format bulk habituel **plus** un champ `cart` contenant le **panier final** (même format que `GET /api/v1/cart`).

```json
{
  "status": "partial_success",
  "message": "1 réussite(s), 1 échec(s) sur 2",
  "data": [ { "shopItemId": "65dcf1234567890abcdef123", "quantite": 2 } ],
  "total": 1,
  "errors": [ { "index": 1, "id": "65dcf1234567890abcdef456", "reason": "Cette annonce n'est plus active." } ],
  "cart": { "...": "panier complet à jour" }
}
```

- `data` liste les articles ajoutés (`shopItemId`, `quantite` ajoutée).
- `errors[].id` = `shopItemId` en échec.
- Utiliser directement `cart` pour mettre à jour `CartContext` (pas besoin de rappeler `GET /cart`).
- Un article déjà présent voit sa quantité augmentée ; échec si le total dépasse le disponible.

```js
export const addToCartBulk = async (items) => {
  const result = await callBulk('post', '/api/v1/cart/add/bulk', { items });
  // setCart(result.cart) dans CartContext
  return result;
};
```

Cas d'usage : « Ajouter la sélection au panier », « Recommander » (re-remplir le panier depuis une commande passée).

---

## 9. Administration — utilisateurs

Rôle **ADMIN** requis (sinon `403`).

| Endpoint bulk | Endpoint unitaire équivalent | Body |
|---|---|---|
| `PATCH /api/v1/users/activate/bulk` | `PATCH /users/activate/:id` | `{ "ids": [...] }` |
| `POST /api/v1/users/delete/bulk` | `DELETE /users/delete/:id` | `{ "ids": [...] }` |

```bash
# Activer plusieurs comptes
curl -s -X PATCH "$API/users/activate/bulk" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "ids": ["69989c5cdff25ef7fe0a4611", "69989c5cdff25ef7fe0a4613"] }'

# Supprimer plusieurs comptes (POST, pas DELETE)
curl -s -X POST "$API/users/delete/bulk" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "ids": ["69989c5cdff25ef7fe0a4614"] }'
```

- `data` contient uniquement les ids traités : `[{ "id": "…" }, …]`. Recharger la liste des utilisateurs après l'appel.
- **Suppression** : c'est un `POST` (pas un `DELETE`), car le body contient la liste d'ids. Réponse HTTP `200`.
- Si la sélection contient l'admin connecté, **son id est refusé** (`errors` : « Vous ne pouvez pas supprimer votre propre compte admin. ») ; les autres sont supprimés. Mieux : retirer son propre compte de la sélection côté UI.
- La suppression est **définitive** : afficher une confirmation avec le nombre de comptes.

```js
export const activateUsersBulk = (ids) => callBulk('patch', '/api/v1/users/activate/bulk', { ids });
export const deleteUsersBulk = (ids) => callBulk('post', '/api/v1/users/delete/bulk', { ids });
```

---

## 10. Produits — création avec photos et administration

### 10.1 Créer plusieurs produits avec leurs photos (multipart)

`POST /api/v1/products/bulk` — authentification requise. Équivalent en lot de `POST /api/v1/products` (qui est lui aussi en multipart).

**Format `multipart/form-data`** :

| Champ | Type | Contenu |
|---|---|---|
| `items` | texte | Tableau des produits **sérialisé en JSON** (`JSON.stringify`) — 1 à 100 produits |
| `image_<index>` | fichier | Photo du produit `items[index]` (ex: `image_0`, `image_2`). **Optionnelle**, une par produit |

Champs d'un produit dans `items` :

| Champ | Requis | Remarque |
|---|---|---|
| `codeCPC` | oui | Doit exister ; la catégorie (`categoryId`) est déduite automatiquement |
| `productName` | oui | |
| `productCategory` | non | Libellé ; par défaut le nom du CPC |
| `productDescription`, `productVolume`, `productHauteur`, `productLargeur`, `productLongueur`, `productPoids` | non | Texte |

```bash
# 3 produits : photo pour le 1er (index 0) et le 3e (index 2), pas pour le 2e
curl -s -X POST "$API/products/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  --form-string 'items=[
    {"codeCPC":"01111","productName":"Blé dur","productPoids":"50 kg"},
    {"codeCPC":"01121","productName":"Maïs jaune"},
    {"codeCPC":"01111","productName":"Blé tendre","productDescription":"Récolte 2026"}
  ]' \
  -F "image_0=@./photos/ble-dur.jpg;type=image/jpeg" \
  -F "image_2=@./photos/ble-tendre.png;type=image/png"
```

- Utiliser `--form-string` pour `items` (le texte est envoyé tel quel), et `-F "image_<index>=@chemin"` pour les fichiers.
- Ne pas ajouter `-H "Content-Type: …"` : curl génère lui-même l'en-tête multipart avec son *boundary*.

Règles :

- L'association photo ↔ produit se fait **par le nom du champ** : `image_3` est la photo de `items[3]`. Un produit sans photo n'a simplement pas de champ `image_<index>`.
- Images uniquement (`image/*`), **5 Mo max** par fichier. Sinon `400` et rien n'est créé.
- `400` aussi si `items` n'est pas un JSON valide, si un produit est mal formé (ex: `items.0.codeCPC should not be empty`), si un `image_<index>` ne correspond à aucun produit ou s'il y a deux fichiers pour le même index.
- Chaque produit suit les règles de la création unitaire : **doublon refusé** (même nom + même CPC pour l'utilisateur, y compris deux fois dans le même lot), audit, notification aux admins, email au créateur. Les produits créés sont en attente de validation.
- Réponse au format bulk (§1.3) : `data` = produits créés, `errors[].index` = position dans `items` (ex: `Code CPC "99999" introuvable`).

```js
// src/services/products.bulk.js
import axiosInstance from './axios.config';

/**
 * @param {Array<{ product: object, image?: File }>} rows  lignes du formulaire
 */
export async function createProductsBulk(rows) {
  const formData = new FormData();
  formData.append('items', JSON.stringify(rows.map((r) => r.product)));
  rows.forEach((row, index) => {
    if (row.image) formData.append(`image_${index}`, row.image);
  });

  // Ne pas fixer Content-Type : le navigateur ajoute le boundary multipart.
  const res = await axiosInstance.post('/api/v1/products/bulk', formData);
  return res.data; // { status, message, data, total, errors }
}
```

> Pour plus de 100 produits, découper `rows` en paquets de 100 et **renuméroter** les `image_<index>` dans chaque paquet (l'index est relatif au paquet envoyé). Recaler ensuite `errors[].index` avec le décalage du paquet (voir `callBulkChunked` §2.3).

> L'ancien `POST /api/v1/products/bulk-create` (JSON, images par **URL**) existe toujours pour le remplissage de données ; il ignore doublons, audit et notifications. Pour les vrais utilisateurs, utiliser `POST /products/bulk`.

### 10.2 Administration des produits

Rôle **ADMIN** requis (sinon `403`).

| Endpoint bulk | Endpoint unitaire équivalent | Body |
|---|---|---|
| `PATCH /api/v1/products/validate/bulk` | `PATCH /products/toggle-validation/:id` | `{ "ids": [...] }` |
| `POST /api/v1/products/delete/bulk` | `DELETE /products/delete/:id` | `{ "ids": [...] }` |

```bash
# Valider plusieurs produits
curl -s -X PATCH "$API/products/validate/bulk" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "ids": ["69989c5cdff25ef7fe0a4620", "69989c5cdff25ef7fe0a4621"] }'

# Supprimer plusieurs produits (POST, pas DELETE)
curl -s -X POST "$API/products/delete/bulk" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "ids": ["69989c5cdff25ef7fe0a4622"] }'
```

- **Validation** : valide les produits sélectionnés. Un produit **déjà validé** est rapporté en échec (« Ce produit a été validé et ne peut plus être désactivé. »), comme avec l'endpoint unitaire. `data` contient les produits validés. Chaque propriétaire est notifié.
  - Pour valider **tous** les produits en attente, `PATCH /api/v1/products/validate-all` existe toujours.
- **Suppression** : `POST` avec la liste d'ids, `data` = `[{ "id": "…" }, …]`. Chaque **propriétaire** reçoit une notification et un email.

```js
export const validateProductsBulk = (ids) => callBulk('patch', '/api/v1/products/validate/bulk', { ids });
export const deleteProductsBulk = (ids) => callBulk('post', '/api/v1/products/delete/bulk', { ids });
```

---

## 11. Pièges à éviter

1. **Tester `status`, pas le code HTTP.** Un lot entièrement en échec renvoie `201`/`200` avec `status: "error"`.
2. **Ne pas associer `data[i]` à `items[i]`.** En cas d'échec, `data` est décalé. Utiliser `errors[].index` pour retrouver les éléments en échec ; les autres sont réussis.
3. **Pas de `Promise.all` sur plusieurs lots.** Envoyer les paquets l'un après l'autre (`callBulkChunked`).
4. **Pas plus de 100 éléments** par requête (sinon `400`, rien n'est traité).
5. **Pas de doublon dans `ids`** (sinon `400`).
6. **Pas d'`approuveurId`** dans approve/reject bulk : l'approbateur est l'utilisateur connecté.
7. **Suppressions en `POST`** : `POST /users/delete/bulk`, `POST /products/delete/bulk`.
8. **Pas de retour arrière automatique** : ce qui a réussi reste créé même si d'autres éléments échouent. Pour « annuler », utiliser les endpoints métier (rejet de transaction, suppression…).
9. **Désactiver le bouton pendant l'envoi** pour éviter de créer deux fois le même lot.
10. **Multipart** (`/products/bulk`) : ne pas fixer `Content-Type` à la main, ni dans Axios ni dans curl.

---

## 12. Récapitulatif des endpoints

| Module | Méthode | Endpoint | Body | Accès |
|---|---|---|---|---|
| Transactions | POST | `/api/v1/transactions/deposit/bulk` | `{ items }` | connecté |
| Transactions | POST | `/api/v1/transactions/return/bulk` | `{ items }` | connecté |
| Transactions | POST | `/api/v1/transactions/initialization/bulk` | `{ items }` | connecté |
| Transactions | POST | `/api/v1/transactions/virement-droit/bulk` | `{ items }` | connecté |
| Transactions | POST | `/api/v1/transactions/vente/bulk` | `{ items }` | connecté |
| Transactions | PATCH | `/api/v1/transactions/approve/bulk` | `{ ids, observations? }` | connecté |
| Transactions | PATCH | `/api/v1/transactions/reject/bulk` | `{ ids, motifRejet }` | connecté |
| Stocks | POST | `/api/v1/stocks/depot/bulk` | `{ items }` | connecté |
| Stocks | POST | `/api/v1/stocks/transfer/bulk` | `{ items }` | connecté |
| Stocks | POST | `/api/v1/stocks/virement/bulk` | `{ items }` | connecté |
| Stocks | POST | `/api/v1/stocks/flag-movement/bulk` | `{ ids, reason }` | connecté |
| Stocks | POST | `/api/v1/stocks/validate-movement/bulk` | `{ ids }` | connecté |
| Sites | POST | `/api/v1/sites/bulk-create` | `{ items }` | connecté |
| Boutique | POST | `/api/v1/shop/shop-items/bulk` | `{ items }` | connecté |
| Panier | POST | `/api/v1/cart/add/bulk` | `{ items }` | connecté |
| Utilisateurs | PATCH | `/api/v1/users/activate/bulk` | `{ ids }` | ADMIN |
| Utilisateurs | POST | `/api/v1/users/delete/bulk` | `{ ids }` | ADMIN |
| Produits | POST | `/api/v1/products/bulk` | multipart : `items` (JSON) + `image_<index>` | connecté |
| Produits | PATCH | `/api/v1/products/validate/bulk` | `{ ids }` | ADMIN |
| Produits | POST | `/api/v1/products/delete/bulk` | `{ ids }` | ADMIN |

Retrait intégral et auto-retrait : voir [integration-frontend-retrait.md](integration-frontend-retrait.md).

La documentation Swagger (`/swagger`, hors production) décrit aussi chaque endpoint avec ses schémas et exemples.
