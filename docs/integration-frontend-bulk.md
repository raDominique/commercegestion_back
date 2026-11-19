# Intégration frontend — Endpoints bulk

Ce document décrit les endpoints « bulk » (opérations en masse) ajoutés au backend, et la façon de les intégrer côté frontend (React + Axios, voir `DOCUMENTATION-frontend.md` §7).

Chaque endpoint bulk est la version « en lot » d'un endpoint unitaire existant : **mêmes champs, mêmes règles métier, mêmes emails et notifications**. Seul le format d'enveloppe change.

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
10. [Administration — produits](#10-administration--produits)
11. [Pièges à éviter](#11-pièges-à-éviter)
12. [Récapitulatif des endpoints](#12-récapitulatif-des-endpoints)

---

## 1. Règles communes à tous les endpoints bulk

### 1.1 Format de la requête

Deux formes de body selon le type d'opération :

| Type d'opération | Body | Exemple |
|---|---|---|
| **Créer** plusieurs éléments | `{ "items": [ ... ] }` | dépôts, ventes, sites, annonces… |
| **Agir** sur des éléments existants | `{ "ids": [ ... ] }` (+ champs communs éventuels) | approuver, rejeter, activer, supprimer… |

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

```json
{
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
    }
  ]
}
```

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

Chaque dépôt créé est `PENDING` et réserve la quantité (`quantiteEnAttente`). Plusieurs dépôts du même stock dans un lot se cumulent : si le stock disponible est épuisé en cours de lot, les éléments suivants échouent.

### 3.2 Retraits — `POST /api/v1/transactions/return/bulk`

Mêmes champs que le dépôt (`detentaire`, `ayant_droit`, `productId`, `siteOrigineId`, `siteDestinationId`, `quantite`, `prixUnitaire?`, `observations?`). Le retrayant est l'utilisateur connecté.

### 3.3 Initialisations — `POST /api/v1/transactions/initialization/bulk`

```json
{
  "items": [
    { "productId": "…", "siteOrigineId": "…", "quantite": 1000, "prixUnitaire": 0 }
  ]
}
```

Champs : `productId`, `siteOrigineId`, `quantite` (> 0), `prixUnitaire?`, `observations?`. Créées directement `APPROVED`.

### 3.4 Virements de droit — `POST /api/v1/transactions/virement-droit/bulk`

```json
{
  "items": [
    {
      "beneficiaryId": "69989c5cdff25ef7fe0a4613",
      "detentaireId": "69989c5cdff25ef7fe0a460f",
      "siteId": "69989c5cdff25ef7fe0a4610",
      "productId": "69989c5cdff25ef7fe0a4620",
      "quantite": 10
    }
  ]
}
```

Champs : `beneficiaryId`, `detentaireId`, `siteId`, `productId`, `quantite` (> 0), `observations?`. L'initiateur est l'utilisateur connecté.

### 3.5 Ventes — `POST /api/v1/transactions/vente/bulk`

```json
{
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
}
```

Champs : `vendeurId`, `productId`, `siteOrigineId`, `siteDestinationId?`, `quantite` (> 0), `contrepartieId?` (produit reçu en échange, absent = vente monétaire), `rapportEchange` (prix unitaire ou ratio d'échange, 6 décimales max), `observations?`. L'acheteur est l'utilisateur connecté.

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

```json
{
  "items": [
    {
      "siteOrigineId": "69989c5cdff25ef7fe0a460f",
      "siteDestinationId": "69989c5cdff25ef7fe0a4610",
      "productId": "69989c5cdff25ef7fe0a4620",
      "quantite": 100,
      "prixUnitaire": 1500,
      "detentaire": "69989c5cdff25ef7fe0a4611",
      "ayant_droit": "69989c5cdff25ef7fe0a4612",
      "observations": "Cession de stock"
    }
  ]
}
```

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

`data` contient les **mouvements enregistrés**. L'opérateur est l'utilisateur connecté.

### 5.2 Signalement et revalidation

| Endpoint bulk | Endpoint unitaire équivalent | Body |
|---|---|---|
| `POST /flag-movement/bulk` | `POST /flag-movement/:movementId` | `{ "ids": [...], "reason": "..." }` |
| `POST /validate-movement/bulk` | `POST /validate-movement/:movementId` | `{ "ids": [...] }` |

- `reason` : obligatoire, **1000 caractères max**, le même pour tous les mouvements.
- Un email est envoyé à l'opérateur de chaque mouvement signalé.
- Échec typique dans `errors` : `Mouvement non trouvé`.

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

```json
{
  "items": [
    { "siteName": "Site Analakely", "siteAddress": "Analakely, Antananarivo", "siteLat": -18.8792, "siteLng": 47.5079 },
    { "siteName": "Dépôt Tamatave", "siteAddress": "Port, Toamasina", "siteLat": -18.1443, "siteLng": 49.3958 }
  ]
}
```

Champs : `siteName`, `siteAddress`, `siteLat` (-90 à 90), `siteLng` (-180 à 180), tous requis. Les sites sont créés pour **l'utilisateur connecté**. `data` contient les sites créés.

```js
export const createSitesBulk = (items) => callBulk('post', '/api/v1/sites/bulk-create', { items });
```

Cas d'usage : import d'une liste de sites (CSV/Excel parsé côté front) lors de l'inscription d'un membre ou d'une banque.

---

## 7. Boutique (annonces)

`POST /api/v1/shop/shop-items/bulk` — authentification requise. Équivalent de `POST /api/v1/shop/shop-items`.

```json
{
  "items": [
    { "productId": "…", "siteId": "…", "quantite": 10, "prixUnitaire": 2500, "description": "Riz blanc" },
    { "productId": "…", "siteId": "…", "quantite": 5, "prixUnitaire": 9000 }
  ]
}
```

Champs : `productId`, `siteId`, `quantite` (> 0), `prixUnitaire` (> 0), `actifId?`, `description?`. Le vendeur est l'utilisateur connecté. `data` contient les annonces créées.

> ⚠️ La quantité n'est **pas réservée** à la création d'une annonce. Le serveur vérifie chaque annonce contre l'actif, indépendamment des autres : deux annonces du même actif dans un lot peuvent dépasser le stock. Le front doit vérifier que la somme des quantités par (produit, site) ne dépasse pas l'actif disponible.

```js
export const createShopItemsBulk = (items) => callBulk('post', '/api/v1/shop/shop-items/bulk', { items });
```

---

## 8. Panier

`POST /api/v1/cart/add/bulk` — authentification requise. Équivalent de `POST /api/v1/cart/add`.

```json
{
  "items": [
    { "shopItemId": "65dcf1234567890abcdef123", "quantite": 2 },
    { "shopItemId": "65dcf1234567890abcdef456", "quantite": 1 }
  ]
}
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

- `data` contient uniquement les ids traités : `[{ "id": "…" }, …]`. Recharger la liste des utilisateurs après l'appel.
- **Suppression** : c'est un `POST` (pas un `DELETE`), car le body contient la liste d'ids. Réponse HTTP `200`.
- Si la sélection contient l'admin connecté, **son id est refusé** (`errors` : « Vous ne pouvez pas supprimer votre propre compte admin. ») ; les autres sont supprimés. Mieux : retirer son propre compte de la sélection côté UI.
- La suppression est **définitive** : afficher une confirmation avec le nombre de comptes.

```js
export const activateUsersBulk = (ids) => callBulk('patch', '/api/v1/users/activate/bulk', { ids });
export const deleteUsersBulk = (ids) => callBulk('post', '/api/v1/users/delete/bulk', { ids });
```

---

## 10. Administration — produits

Rôle **ADMIN** requis (sinon `403`).

| Endpoint bulk | Endpoint unitaire équivalent | Body |
|---|---|---|
| `PATCH /api/v1/products/validate/bulk` | `PATCH /products/toggle-validation/:id` | `{ "ids": [...] }` |
| `POST /api/v1/products/delete/bulk` | `DELETE /products/delete/:id` | `{ "ids": [...] }` |

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
| Produits | PATCH | `/api/v1/products/validate/bulk` | `{ ids }` | ADMIN |
| Produits | POST | `/api/v1/products/delete/bulk` | `{ ids }` | ADMIN |

La documentation Swagger (`/swagger`, hors production) décrit aussi chaque endpoint avec ses schémas et exemples.
