# 📦 Guide complet des Endpoints Stock - Quand les utiliser?

## 🎯 Table des matières
- [Vue d'ensemble](#vue-densemble)
- [Les 4 types de mouvements](#les-4-types-de-mouvements)
- [1️⃣ DEPOT - Premier stockage](#1-depot---premier-stockage)
- [2️⃣ TRANSFERT - Déplacer entre deux sites](#2-transfert---déplacer-entre-deux-sites)
- [3️⃣ RETRAIT - Enlever du stock](#3-retrait---enlever-du-stock)
- [4️⃣ VIREMENT - Changer la propriété](#4-virement---changer-la-propriété)
- [Relation Actifs/Passifs](#relation-actifspassifs)
- [Exemples métier](#exemples-métier)
- [Tableau récapitulatif](#tableau-récapitulatif)

---

## 🎯 Vue d'ensemble

Le système de gestion de stock utilise **4 types de mouvements** pour tracer tout ce qui se passe:

| Type | Description | Création d'Actif | Création de Passif |
|------|-------------|------------------|-------------------|
| **DEPOT** | Premier stockage d'un produit | ✅ OUI | ✅ Si tiers |
| **TRANSFERT** | Déplacement entre deux sites | ✅ OUI | ✅ Si tiers |
| **RETRAIT** | Sortie de stock (vente, don, etc.) | ❌ NON | ❌ NON |
| **VIREMENT** | Changement de propriétaire | ✅ OUI | ✅ Si tiers |

---

## Les 4 types de mouvements

### 🔴 DEPOT
```
Moment: Première mise en stock d'un produit
Quand l'utiliser: 
  ✓ Vous faites votre premier dépôt de produit
  ✓ Vous importez des marchandises nouvelles
  ✓ Vous démarrez votre inventaire

Ne PAS l'utiliser si:
  ✗ Vous déplacez du stock existant → TRANSFERT
  ✗ Vous vendez/retirez du stock → RETRAIT  
  ✗ Vous changez le propriétaire → VIREMENT
```

### 🟡 TRANSFERT
```
Moment: Déplacement de produit entre deux sites/hangars
Quand l'utiliser:
  ✓ Vous bougez du stock de HANGAR A vers HANGAR B
  ✓ Vous transportez de la marchandise d'un entrepôt à un autre
  ✓ Vous changez de site pour le même propriétaire/détenteur

Ne PAS l'utiliser si:
  ✗ C'est la première mise en stock → DEPOT
  ✗ Vous vendez/retirez → RETRAIT
  ✗ Vous changez le propriétaire → VIREMENT
```

### 🟢 RETRAIT
```
Moment: Sortie définitive du stock
Quand l'utiliser:
  ✓ Vous vendez des produits
  ✓ Vous donnez/offrez du stock
  ✓ Vous retirez du stock pour utilisation personnelle
  ✓ Stock détérioré/à jeter

Ne PAS l'utiliser si:
  ✗ C'est un déplacement entre sites → TRANSFERT
  ✗ C'est la première mise en stock → DEPOT
  ✗ Vous changez juste le propriétaire → VIREMENT
```

### 🔵 VIREMENT
```
Moment: Changement de propriétaire (vente interne, transfert)
Quand l'utiliser:
  ✓ Vous vendez à un autre commerçant (changement de propriété)
  ✓ Vous transférez la propriété à quelqu'un d'autre
  ✓ Quelqu'un d'autre devient propriétaire du stock

Ne PAS l'utiliser si:
  ✗ C'est un déplacement simple → TRANSFERT
  ✗ C'est une première mise en stock → DEPOT
  ✗ C'est une vente finale (sortie) → RETRAIT
```

---

## 1️⃣ DEPOT - Premier stockage

### Quand l'utiliser?
- **Premier dépôt** d'un produit en stock
- **Initialisation** de l'inventaire
- **Mise en stock** initiale de marchandises

### Exemple scénario
```
Vous êtes RAKOTO.
Vous venez de recevoir 1000 kg de riz.
C'est la première fois que vous le stockez.
Vous le mettez au HANGAR ANDRANOMENA (votre hangar).
```

### Request POST /stock/depot
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "quantite": 1000,
  "prixUnitaire": 500,
  "siteDestinationId": "507f1f77bcf86cd799439012",
  "observations": "Riz de récolte septembre 2026"
}
```

### Paramètres
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `productId` | UUID | ✅ OUI | ID du produit |
| `quantite` | number | ✅ OUI | Quantité à stocker (>0) |
| `prixUnitaire` | number | ✅ OUI | Prix par unité |
| `siteDestinationId` | UUID | ✅ OUI | Site de destination (hangar) |
| `detentaire` | UUID | ⭕ NON | Qui garde physiquement (défaut: proprio site) |
| `ayant_droit` | UUID | ⭕ NON | Qui possède légalement (défaut: vous) |
| `observations` | string | ⭕ NON | Notes supplémentaires |

### Impact système
```javascript
// 1. Produit marqué comme EN STOCK
product.isStocker = true ✅

// 2. Actif créé pour vous
Actif {
  userId: "RAKOTO",
  productId: "RIZ",
  quantite: 1000,
  detentaire: "RAKOTO",      // Ou celui spécifié
  ayant_droit: "RAKOTO"       // Ou celui spécifié
}

// 3. Passif créé SI détentaire ≠ ayant_droit
// (Exemple: quelqu'un d'autre garde votre riz)

// 4. Mouvement enregistré
StockMovement {
  type: "DEPOT",
  operatorId: "RAKOTO",
  quantite: 1000,
  timestamp: NOW
}
```

### Response (Success 201)
```json
{
  "_id": "507f1f77bcf86cd799439099",
  "operatorId": "RAKOTO_ID",
  "type": "DEPOT",
  "productId": "507f1f77bcf86cd799439011",
  "quantite": 1000,
  "prixUnitaire": 500,
  "siteDestinationId": "507f1f77bcf86cd799439012",
  "depotDestination": "HANGAR ANDRANOMENA",
  "detentaire": null,
  "ayant_droit": null,
  "createdAt": "2026-04-10T12:30:00Z"
}
```

### Erreurs possibles
```json
{
  "statusCode": 400,
  "message": "Quantité doit être > 0",
  "error": "Bad Request"
}

{
  "statusCode": 404,
  "message": "Produit non trouvé",
  "error": "Not Found"
}
```

---

## 2️⃣ TRANSFERT - Déplacer entre deux sites

### Quand l'utiliser?
- Déplacement de stock d'un site à un autre
- Transport entre deux hangars
- Transfert de marchandise d'un entrepôt à un autre

### Exemple scénario
```
Vous êtes RAKOTO.
Vous avez 1000 kg de riz à HANGAR ANDRANOMENA.
Vous l'envoyez à HANGAR ALASORA (même propriétaire).
```

### Request POST /stock/transfert
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "quantite": 500,
  "prixUnitaire": 500,
  "siteOrigineId": "507f1f77bcf86cd799439012",
  "siteDestinationId": "507f1f77bcf86cd799439013",
  "observations": "Transport inter-hangars"
}
```

### Paramètres
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `productId` | UUID | ✅ OUI | ID du produit |
| `quantite` | number | ✅ OUI | Quantité à transférer |
| `prixUnitaire` | number | ✅ OUI | Prix par unité |
| `siteOrigineId` | UUID | ✅ OUI | Site source (obligatoire) |
| `siteDestinationId` | UUID | ✅ OUI | Site de destination |
| `detentaire` | UUID | ⭕ NON | Qui détient au site destination |
| `ayant_droit` | UUID | ⭕ NON | Propriétaire (vous par défaut) |
| `observations` | string | ⭕ NON | Notes |

### Impact système
```javascript
// 1. Actif diminue au site origine
Actif (site origine) {
  quantite: 1000 - 500 = 500 ✅
}

// 2. Actif augmente au site destination
Actif (site destination) {
  quantite: 500 ✅
}

// 3. Passif au site origine diminue (si applicable)

// 4. Passif au site destination créé (si détentaire ≠ propriétaire)

// 5. Mouvement enregistré
StockMovement {
  type: "TRANSFERT",
  siteOrigineId: "HANGAR ANDRANOMENA",
  siteDestinationId: "HANGAR ALASORA"
}
```

---

## 3️⃣ RETRAIT - Enlever du stock

### Quand l'utiliser?
- Vente de produits
- Don ou cadeau
- Destruction de stock hors service
- Utilisation personnelle du stock

### Exemple scénario
```
Vous êtes RAKOTO.
Vous vendez 200 kg de riz à un client.
Ce riz sort définitivement du stock.
```

### Request POST /stock/retrait
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "quantite": 200,
  "prixUnitaire": 500,
  "siteOrigineId": "507f1f77bcf86cd799439012",
  "siteDestinationId": "507f1f77bcf86cd799439012",
  "observations": "Vente client"
}
```

### Paramètres
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `productId` | UUID | ✅ OUI | ID du produit |
| `quantite` | number | ✅ OUI | Quantité à retirer |
| `prixUnitaire` | number | ✅ OUI | Prix par unité |
| `siteOrigineId` | UUID | ✅ OUI | Site source |
| `siteDestinationId` | UUID | ✅ OUI | Site destination (souvent même) |

### Impact système
```javascript
// 1. Actif diminue
Actif {
  quantite: 1000 - 200 = 800 ✅
}

// 2. Aucune création de nouvel Actif
// (C'est une sortie définitive)

// 3. Passif diminue si existant

// 4. Mouvement enregistré
StockMovement {
  type: "RETRAIT",
  quantite: 200
}
```

---

## 4️⃣ VIREMENT - Changer la propriété

### Quand l'utiliser?
- Vente à un autre commerçant
- Transfert de propriété
- Changement du propriétaire légal

### Exemple scénario
```
Vous êtes RAKOTO et possédez 1000 kg de riz.
Vous le vendez à RABE.
RABE devient maintenant propriétaire.
```

### Request POST /stock/virement
```json
{
  "productId": "507f1f77bcf86cd799439011",
  "quantite": 1000,
  "prixUnitaire": 600,
  "siteDestinationId": "507f1f77bcf86cd799439012",
  "ayant_droit": "507f1f77bcf86cd799439888",
  "detentaire": "507f1f77bcf86cd799439012",
  "observations": "Vente à RABE"
}
```

### Paramètres
| Paramètre | Type | Requis | Description |
|-----------|------|--------|-------------|
| `productId` | UUID | ✅ OUI | ID du produit |
| `quantite` | number | ✅ OUI | Quantité |
| `prixUnitaire` | number | ✅ OUI | Prix par unité |
| `siteDestinationId` | UUID | ✅ OUI | Site de destination |
| `ayant_droit` | UUID | ✅ OUI | **Nouveau propriétaire** |
| `detentaire` | UUID | ⭕ NON | Qui garde (défaut: proprio site) |
| `observations` | string | ⭕ NON | Notes |

### Impact système
```javascript
// 1. Votre Actif diminue
ActifRAKOTO {
  quantite: 1000 - 1000 = 0 ✅
}

// 2. Actif de RABE augmente
ActifRABE {
  quantite: 1000 ✅
}

// 3. Votre Passif envers le détenteur diminue (si existe)

// 4. Passif de RABE créé (si nouveau propriétaire ≠ détenteur)

// 5. Mouvement enregistré
StockMovement {
  type: "VIREMENT",
  ayant_droit: "RABE",
  operatorId: "RAKOTO"
}
```

---

## Relation Actifs/Passifs

### Concept clé: Détentaire vs Ayant-droit

```
┌─────────────────────────────────────────┐
│ Le riz est au HANGAR (détentaire)       │
│ Mais appartient à RAKOTO (ayant-droit)  │
└─────────────────────────────────────────┘

🎯 Si détentaire = ayant-droit → PAS de PASSIF (c'est le tien)
🚨 Si détentaire ≠ ayant-droit → PASSIF créé (tu dois le riz)
```

### Exemple: Dépôt chez un tiers
```json
POST /stock/depot
{
  "productId": "RIZ_ID",
  "quantite": 1000,
  "siteDestinationId": "HANGAR_RABE",
  "detentaire": "RABE",        // RABE le garde
  "ayant_droit": "RAKOTO"      // RAKOTO est propriétaire
}
```

**Impact comptable:**
```
✅ ACTIF RAKOTO = +1000 kg (ce qu'il possède)
🚨 PASSIF de RABE = +1000 kg (il doit 1000 kg de riz à RAKOTO)
```

---

## Exemples métier

### Scénario 1: Achat en vrac - Vous entreposez chez un tiers
```
Situation: Vous achetez 5000 kg de riz mais le stockez chez RABE
Utilisez: DEPOT avec detentaire=RABE, ayant_droit=VOUS

POST /stock/depot {
  "productId": "RIZ",
  "quantite": 5000,
  "siteDestinationId": "HANGAR_RABE",
  "detentaire": "RABE_ID",
  "ayant_droit": "RAKOTO_ID"
}

Résultat:
- RAKOTO a un ACTIF = 5000 kg (son stock)
- RABE a un PASSIF = 5000 kg (il doit 5000 kg à RAKOTO)
```

### Scénario 2: Réorganisation interne
```
Situation: Vous bougez 2000 kg entre deux sites
Utilisez: TRANSFERT

POST /stock/transfert {
  "productId": "RIZ",
  "quantite": 2000,
  "siteOrigineId": "HANGAR_A",
  "siteDestinationId": "HANGAR_B"
}

Résultat:
- HANGAR A: -2000 kg
- HANGAR B: +2000 kg
```

### Scénario 3: Vente client
```
Situation: Vous vendez 500 kg à un client externe
Utilisez: RETRAIT

POST /stock/retrait {
  "productId": "RIZ",
  "quantite": 500,
  "siteOrigineId": "HANGAR_RAKOTO",
  "siteDestinationId": "HANGAR_RAKOTO"
}

Résultat:
- Votre stock diminue = -500 kg
- Mouvement enregistré pour traçabilité
```

### Scénario 4: Vente en gros - Changement de propriétaire
```
Situation: Vous vendez tout votre riz (1000 kg) à RABE
Utilisez: VIREMENT

POST /stock/virement {
  "productId": "RIZ",
  "quantite": 1000,
  "siteDestinationId": "HANGAR_RABE",
  "ayant_droit": "RABE_ID"
}

Résultat:
- Vous perdez la propriété = ACTIF -1000 kg
- RABE devient propriétaire = ACTIF +1000 kg
```

---

## Tableau récapitulatif

| Endpoint | Type | Création Actif | Impact Stock | Détentaire? | Quand? |
|----------|------|---|---|---|---|
| **POST /depot** | DEPOT | ✅ OUI | Nouveau stock | ✅ Optional | 1ère mise en stock |
| **POST /transfert** | TRANSFERT | ✅ OUI (déplacé) | Déplacement | ✅ Optional | Déplacement entre sites |
| **POST /retrait** | RETRAIT | ❌ NON | Sortie stock | ❌ NON | Vente/destruction |
| **POST /virement** | VIREMENT | ✅ OUI (nouveau proprio) | Changement proprio | ✅ Optional | Changement propriétaire |

---

## 🔗 Endpoints supplémentaires

### 📊 Voir l'historique des mouvements
```
GET /stock/history?page=1&limit=10&type=DEPOT
```

### 📋 Voir les actifs
```
GET /ledger/actifs/:userId?page=1&limit=10
```

### 💳 Voir les passifs
```
GET /ledger/passifs/:userId?page=1&limit=10
```

---

## ⚠️ Validations importantes

Tous les endpoints appliquent ces validations:

```
✅ Quantité > 0
✅ Produit existe
✅ Utilisateur authentifié
✅ Permissions vérifiées
✅ Sites existent
✅ Stock suffisant (pour RETRAIT/TRANSFERT)
```

---

## 🧪 Test rapide avec Swagger

1. Allez sur `http://localhost:5000/swagger`
2. Section **Stocks & Mouvements**
3. Choisissez le endpoint souhaité
4. Cliquez **Try it out**
5. Remplissez les paramètres
6. Cliquez **Execute**

---

## 📞 Support

**Questions courantes:**
- Q: Quel endpoint utiliser pour réorganiser mon stock?
  R: TRANSFERT

- Q: Comment vendre ma marchandise?
  R: RETRAIT ou VIREMENT (si changement propriétaire)

- Q: Le riz est chez RABE mais c'est le mien?
  R: DEPOT avec detentaire=RABE, ayant_droit=VOUS
