# Intégration frontend — Retrait intégral et auto-retrait

Ce document décrit :

1. le **retrait intégral** chez un détenteur (tout retirer sans choisir produit par produit) ;
2. l'**auto-retrait** (retirer son propre stock) ;
3. le **nouveau comportement de tous les retraits** sur les quantités (à prendre en compte dans les écrans actifs / stocks).

Pour les autres opérations en masse (dépôts, ventes, approbation en lot…), voir [integration-frontend-bulk.md](integration-frontend-bulk.md).

---

## Table des matières

1. [Préparer les exemples curl](#1-préparer-les-exemples-curl)
2. [Vocabulaire](#2-vocabulaire)
3. [Retrait intégral chez un détenteur](#3-retrait-intégral-chez-un-détenteur)
4. [Auto-retrait](#4-auto-retrait)
5. [Comportement de tous les retraits (changement)](#5-comportement-de-tous-les-retraits-changement)
6. [Approuver ou rejeter les retraits créés](#6-approuver-ou-rejeter-les-retraits-créés)
7. [Erreurs possibles](#7-erreurs-possibles)
8. [Récapitulatif](#8-récapitulatif)

---

## 1. Préparer les exemples curl

Les exemples sont écrits pour **bash** (Linux, macOS, Git Bash ou WSL sous Windows).

```bash
# URL de l'API (port 5000 par défaut, voir .env)
API=http://localhost:5000/api/v1

# 1. Se connecter pour obtenir un accessToken
curl -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{ "userEmail": "membre@example.com", "userPassword": "motdepasse" }'
# → { "accessToken": "eyJ...", "refreshToken": "..." }
#   (si le compte a la 2FA : { "require2FA": true, "loginChallenge": "..." }, terminer avec /auth/2fa/complete)

# 2. Garder le jeton pour les appels suivants
TOKEN=eyJ...
```

Tous les appels ci-dessous envoient `Authorization: Bearer $TOKEN`. Côté front, `axiosInstance` l'ajoute déjà (voir `DOCUMENTATION-frontend.md` §7).

---

## 2. Vocabulaire

| Terme | Sens |
|---|---|
| **Ayant droit** | Propriétaire légal du produit (ici : l'utilisateur connecté, qui retire) |
| **Détenteur** (`detentaire`) | Membre qui garde physiquement le produit |
| **Retrait chez un tiers** | Le détenteur est un autre membre : je récupère ce que j'ai déposé chez lui |
| **Auto-retrait** | Le détenteur, c'est moi : je retire mon propre stock (détenteur = ayant droit = moi) |
| **Disponible** | `quantite - quantiteEnAttente` d'un actif (ce qui n'est pas déjà réservé par un retrait en attente) |

---

## 3. Retrait intégral chez un détenteur

Retire **tout ce que l'utilisateur peut retirer chez un détenteur**, en une action. Le détenteur peut être un autre membre, ou l'utilisateur lui-même (auto-retrait intégral, `detentaireId` = son propre id).

Deux étapes : **aperçu** (pour confirmation), puis **exécution**.

### 3.1 Étape 1 — Aperçu

`GET /api/v1/transactions/return/withdrawable`

| Paramètre (query) | Requis | Description |
|---|---|---|
| `detentaireId` | oui | Détenteur chez qui tout retirer (son propre id pour l'auto-retrait) |
| `siteId` | non | Limiter à un site d'origine |
| `productId` | non | Limiter à un produit |

```bash
curl -s "$API/transactions/return/withdrawable?detentaireId=69989c5cdff25ef7fe0a460f" \
  -H "Authorization: Bearer $TOKEN"

# Limité à un site et un produit
curl -s "$API/transactions/return/withdrawable?detentaireId=69989c5cdff25ef7fe0a460f&siteId=69989c5cdff25ef7fe0a4610&productId=69989c5cdff25ef7fe0a4620" \
  -H "Authorization: Bearer $TOKEN"
```

Réponse :

```json
{
  "status": "success",
  "message": "2 position(s) retirable(s), 1 exclue(s)",
  "data": [
    {
      "actifId": "6a01f2c3d4e5f60718293a4b",
      "productId": "69989c5cdff25ef7fe0a4620",
      "productName": "Riz",
      "siteOrigineId": "69989c5cdff25ef7fe0a4610",
      "siteName": "Hangar Y",
      "detentaireId": "69989c5cdff25ef7fe0a460f",
      "disponible": 40,
      "soldeDepose": 30,
      "quantiteRetirable": 30,
      "prixUnitaire": 1500
    }
  ],
  "total": 2,
  "exclues": [
    {
      "productName": "Café",
      "quantiteRetirable": 0,
      "motif": "Aucun dépôt approuvé de votre part vers ce détenteur sur ce site (actif reçu par virement ou vente) : retrait non autorisé."
    }
  ]
}
```

| Champ | Description |
|---|---|
| `data` | Positions **retirables** (une par produit et par site d'origine) |
| `disponible` | `quantite - quantiteEnAttente` de l'actif (les retraits déjà en attente sont déduits) |
| `soldeDepose` | Quantité déposée chez ce détenteur moins celle déjà retirée. `null` en auto-retrait |
| `quantiteRetirable` | Quantité qui sera retirée : `disponible`, plafonnée à `soldeDepose` chez un tiers |
| `exclues` | Positions détenues **mais non retirables**, avec `motif` |

Pourquoi une position peut être exclue (retrait chez un tiers uniquement) :

- elle a été **reçue par virement de droit ou par vente** : on ne peut retirer chez un membre que ce qu'on y a soi-même déposé ;
- le solde déposé a **déjà été entièrement retiré**.

**UI recommandée** : afficher `data` dans une boîte de confirmation (« Vous allez retirer : 30 Riz depuis Hangar Y, … ») avec le **choix du site de destination**, et `exclues` en information grisée avec leur motif.

### 3.2 Étape 2 — Exécution

`POST /api/v1/transactions/return/all`

| Champ (body JSON) | Requis | Description |
|---|---|---|
| `detentaireId` | oui | Même valeur que pour l'aperçu |
| `siteDestinationId` | oui | Site où la marchandise sera détenue après le retrait |
| `siteId` | non | Limiter à un site d'origine (mêmes filtres que l'aperçu) |
| `productId` | non | Limiter à un produit |
| `observations` | non | Texte appliqué à chaque retrait créé |

```bash
curl -s -X POST "$API/transactions/return/all" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "detentaireId": "69989c5cdff25ef7fe0a460f",
    "siteDestinationId": "69989c5cdff25ef7fe0a4612",
    "observations": "Retrait intégral fin de saison"
  }'
```

Réponse (format bulk, voir [integration-frontend-bulk.md §1.3](integration-frontend-bulk.md#13-format-de-la-réponse-succès-http-200--201)) **plus** `exclues` :

```json
{
  "status": "partial_success",
  "message": "1 réussite(s), 1 échec(s) sur 2",
  "data": [
    {
      "_id": "6a02a1b2c3d4e5f607182930",
      "transactionNumber": "01JD3K6Y8Q2W4E6R8T0Y2U4I6O",
      "type": "RETRAIT",
      "status": "PENDING",
      "quantite": 30
    }
  ],
  "total": 1,
  "errors": [
    {
      "index": 1,
      "id": "6a01f2c3d4e5f60718293a4c",
      "reason": "Retrait impossible: chez un autre détenteur, le site de destination doit être différent du site d'origine."
    }
  ],
  "exclues": []
}
```

- Un **retrait PENDING est créé par position** de l'aperçu, pour toute la `quantiteRetirable`.
- `errors[].id` = `actifId` de la position en échec (pour la retrouver dans l'aperçu).
- Chez un **autre détenteur**, une position déjà située sur `siteDestinationId` échoue ; en **auto-retrait**, elle est acceptée (voir §4.2).
- **400** si aucune position n'est retirable avec ces filtres (rien n'est créé).
- ⚠️ Comme pour tous les bulk : tester `status`, pas seulement le code HTTP.

### 3.3 Code front

```js
// src/services/retrait.service.js
import axiosInstance from './axios.config';

export const getWithdrawable = (detentaireId, filters = {}) =>
  axiosInstance
    .get('/api/v1/transactions/return/withdrawable', {
      params: { detentaireId, ...filters },
    })
    .then((res) => res.data); // { data, total, exclues }

export const withdrawAll = (body) =>
  axiosInstance
    .post('/api/v1/transactions/return/all', body)
    .then((res) => res.data); // { status, data, errors, exclues }
```

Exemple d'enchaînement :

```js
const preview = await getWithdrawable(holderId);
if (!preview.data.length) {
  toast.info('Rien à retirer chez ce détenteur.');
  return;
}
const confirmed = await openConfirmDialog(preview); // l'utilisateur choisit le site de destination
if (!confirmed) return;

const result = await withdrawAll({
  detentaireId: holderId,
  siteDestinationId: confirmed.siteDestinationId,
});
if (result.status !== 'success') showErrors(result.errors);
reloadActifs(); // et la liste des transactions en attente
```

---

## 4. Auto-retrait

**Auto-retrait** = retrait où `detentaire` = `ayant_droit` = utilisateur connecté.

### 4.1 Ce qui est possible

- Sur **tout son stock disponible**, quelle que soit son origine : initialisation, achat, retrait précédent… (il n'est plus nécessaire d'avoir fait un dépôt vers soi-même).
- Vers un **autre** de ses sites : la marchandise passe du site d'origine au site de destination **à l'approbation**.
- Vers le **même** site : accepté (voir §4.2).
- Le retrait reste **PENDING** jusqu'à approbation. Il apparaît **une seule fois** dans `GET /transactions/pending/list`.
- **Une seule** notification et **un seul** email à chaque étape (création, approbation, rejet). Avant la correction, l'utilisateur les recevait en double (comme détenteur et comme ayant droit).

### 4.2 Même site d'origine et de destination

| Moment | Ligne d'actif du site |
|---|---|
| Création (PENDING) | Disponible − `q` (réservation), une seule fois |
| Approbation | `q` retiré puis remis sur le même site : **solde final inchangé** |
| Rejet | Réservation libérée |

Le mouvement reste visible dans l'historique des transactions.

### 4.3 Créer un auto-retrait (un produit)

Endpoint habituel du retrait, avec `detentaire` = `ayant_droit` = son propre id :

```bash
ME=69989c5cdff25ef7fe0a4611   # id de l'utilisateur connecté

curl -s -X POST "$API/transactions/return" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"detentaire\": \"$ME\",
    \"ayant_droit\": \"$ME\",
    \"productId\": \"69989c5cdff25ef7fe0a4620\",
    \"siteOrigineId\": \"69989c5cdff25ef7fe0a4610\",
    \"siteDestinationId\": \"69989c5cdff25ef7fe0a4612\",
    \"quantite\": 30
  }"
```

### 4.4 Auto-retrait intégral

Retrait intégral (§3) avec `detentaireId` = son propre id :

```bash
# Aperçu de tout mon propre stock retirable sur un site
curl -s "$API/transactions/return/withdrawable?detentaireId=$ME&siteId=69989c5cdff25ef7fe0a4610" \
  -H "Authorization: Bearer $TOKEN"

# Tout déplacer de ce site vers un autre de mes sites
curl -s -X POST "$API/transactions/return/all" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"detentaireId\": \"$ME\",
    \"siteId\": \"69989c5cdff25ef7fe0a4610\",
    \"siteDestinationId\": \"69989c5cdff25ef7fe0a4612\"
  }"
```

En auto-retrait, `soldeDepose` vaut `null` et `quantiteRetirable` = `disponible`.

---

## 5. Comportement de tous les retraits (changement)

Concerne **tous** les retraits (auto-retrait ou chez un tiers) créés après la mise à jour.

| Moment | Site d'origine | Site de destination |
|---|---|---|
| Création (PENDING) | `quantite` inchangée, `quantiteEnAttente += q` (disponible − q) | **rien** |
| Approbation | `quantite − q`, `quantiteEnAttente − q` | `quantite + q` |
| Rejet | `quantiteEnAttente − q` (disponible restauré) | rien |

**Avant**, la quantité apparaissait au site de destination dès la création : pendant l'attente, la marchandise était comptée sur les deux sites (total doublé).

À faire côté front :

- Calculer les **totaux** avec `quantite`, et le **disponible** avec `quantite - quantiteEnAttente`.
- Pour afficher « **à recevoir** », utiliser les retraits PENDING (`GET /transactions/pending/list` ou l'historique), pas les actifs du site de destination.
- Les retraits créés **avant** la mise à jour gardent l'ancien comportement jusqu'à leur approbation ou rejet.

---

## 6. Approuver ou rejeter les retraits créés

Les retraits créés (un par un ou par le retrait intégral) sont `PENDING`.

```bash
# Un retrait
curl -s -X PATCH "$API/transactions/6a02a1b2c3d4e5f607182930/approve" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "approuveurId": "69989c5cdff25ef7fe0a4611" }'

# Plusieurs retraits d'un coup (l'approbateur est l'utilisateur connecté)
curl -s -X PATCH "$API/transactions/approve/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "ids": ["6a02a1b2c3d4e5f607182930", "6a02a1b2c3d4e5f607182931"] }'

# Rejeter plusieurs retraits avec le même motif
curl -s -X PATCH "$API/transactions/reject/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "ids": ["6a02a1b2c3d4e5f607182930"], "motifRejet": "Site de destination incorrect" }'
```

Détails de l'approbation et du rejet en masse : [integration-frontend-bulk.md §4](integration-frontend-bulk.md#4-transactions--approbation-et-rejet).

---

## 7. Erreurs possibles

| Code | Message (extrait) | Cause |
|---|---|---|
| 400 | `detentaireId must be a mongodb id` | `detentaireId` manquant ou invalide |
| 400 | `Aucune position retirable chez ce détenteur avec ces filtres.` | `return/all` : rien à retirer |
| 400 | `chez un autre détenteur, le site de destination doit être différent du site d'origine` | Retrait chez un tiers vers le même site |
| 400 | `aucun dépôt approuvé de ce produit vers le membre …` | Retrait chez un tiers d'un produit reçu par virement / vente |
| 400 | `Quantité à retirer (…) supérieure au solde déposé et non encore retiré (…)` | Chez un tiers : plus que ce qui a été déposé |
| 400 | `Quantité insuffisante dans vos actifs auprès de ce membre. Disponible: …` | Disponible insuffisant (retraits en attente déduits) |
| 400 | `la quantité à retirer doit être disponible dans les actifs de la personne qui effectue le retrait` | `ayant_droit` différent de l'utilisateur connecté |
| 401 | — | Jeton absent ou expiré |

Format d'erreur : `{ "status": "error", "message": "...", "data": null }`.

---

## 8. Récapitulatif

| Méthode | Endpoint | Body / query | Usage |
|---|---|---|---|
| GET | `/api/v1/transactions/return/withdrawable` | `?detentaireId=&siteId=&productId=` | Aperçu du retrait intégral |
| POST | `/api/v1/transactions/return/all` | `{ detentaireId, siteDestinationId, siteId?, productId?, observations? }` | Retrait intégral |
| POST | `/api/v1/transactions/return` | `{ detentaire, ayant_droit, productId, siteOrigineId, siteDestinationId, quantite }` | Retrait d'un produit (auto-retrait : `detentaire` = `ayant_droit` = moi) |
| POST | `/api/v1/transactions/return/bulk` | `{ items: [...] }` | Plusieurs retraits choisis ([bulk §3.2](integration-frontend-bulk.md#32-retraits--post-apiv1transactionsreturnbulk)) |
| PATCH | `/api/v1/transactions/:id/approve` · `/approve/bulk` | — | Approuver |
| PATCH | `/api/v1/transactions/:id/reject` · `/reject/bulk` | — | Rejeter |

La documentation Swagger (`/swagger`, hors production) décrit aussi chaque endpoint.
