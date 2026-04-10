# 🚀 Démarrage rapide - Endpoints Stock

**Vous voulez juste savoir comment faire? Allez-y!**

---

## ⚡ 5 secondes pour comprendre

Le système a **4 endpoints stock** selon ce que vous faites:

- **DEPOT** = Première mise en stock → `/stock/depot`
- **TRANSFERT** = Déplacer entre deux sites → `/stock/transfert`
- **RETRAIT** = Vendre/enlever du stock → `/stock/retrait`
- **VIREMENT** = Changer propriétaire → `/stock/virement`

---

## 🎯 Cas d'usage pratiques

### 1️⃣ "Je mets du riz en stock pour la première fois"
```bash
# Utilisez: DEPOT
curl -X POST http://localhost:5000/api/v1/stock/depot \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "ID_DU_RIZ",
    "quantite": 1000,
    "prixUnitaire": 500,
    "siteDestinationId": "ID_DU_HANGAR"
  }'
```
**Impact:** ✅ Riz en stock, produit marqué "EN STOCK", Actif créé

---

### 2️⃣ "Je déplace du stock d'un hangar à un autre"
```bash
# Utilisez: TRANSFERT
curl -X POST http://localhost:5000/api/v1/stock/transfert \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "ID_DU_RIZ",
    "quantite": 500,
    "prixUnitaire": 500,
    "siteOrigineId": "ID_HANGAR_A",
    "siteDestinationId": "ID_HANGAR_B"
  }'
```
**Impact:** ✅ Stock bougé: HANGAR_A -500, HANGAR_B +500

---

### 3️⃣ "Je vends du riz à un client"
```bash
# Utilisez: RETRAIT
curl -X POST http://localhost:5000/api/v1/stock/retrait \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "ID_DU_RIZ",
    "quantite": 200,
    "prixUnitaire": 500,
    "siteOrigineId": "ID_DU_HANGAR",
    "siteDestinationId": "ID_DU_HANGAR"
  }'
```
**Impact:** ✅ Stock diminue: -200 kg, Mouvement enregistré

---

### 4️⃣ "Je vends tout mon riz à RABE (changement propriétaire)"
```bash
# Utilisez: VIREMENT
curl -X POST http://localhost:5000/api/v1/stock/virement \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "ID_DU_RIZ",
    "quantite": 1000,
    "prixUnitaire": 600,
    "siteDestinationId": "ID_DU_HANGAR",
    "ayant_droit": "ID_DE_RABE"
  }'
```
**Impact:** ✅ RAKOTO perd: -1000, RABE gagne: +1000

---

## 🧪 Tester rapidement

### Via Swagger UI
```
1. Ouvrir: http://localhost:5000/swagger
2. Chercher: "Stocks & Mouvements"
3. Choisir l'endpoint souhaité
4. Cliquer: "Try it out"
5. Remplir les infos
6. Cliquer: "Execute"
```

### Via VS Code REST Client
Créez un file `.http` ou `.rest`:

```http
### DEPOT
POST http://localhost:5000/api/v1/stock/depot
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "productId": "ID",
  "quantite": 1000,
  "prixUnitaire": 500,
  "siteDestinationId": "ID"
}

### TRANSFERT
POST http://localhost:5000/api/v1/stock/transfert
Authorization: Bearer YOUR_TOKEN
Content-Type: application/json

{
  "productId": "ID",
  "quantite": 500,
  "prixUnitaire": 500,
  "siteOrigineId": "ID_A",
  "siteDestinationId": "ID_B"
}
```

---

## 📊 Voir le résultat

### Voir vos Actifs (ce que vous possédez)
```bash
GET http://localhost:5000/api/v1/ledger/actifs/YOUR_USER_ID?page=1&limit=10
```

### Voir vos Passifs (ce que vous devez)
```bash
GET http://localhost:5000/api/v1/ledger/passifs/YOUR_USER_ID?page=1&limit=10
```

### Voir l'historique des mouvements
```bash
GET http://localhost:5000/api/v1/stock/history?page=1&limit=10&type=DEPOT
```

---

## ❓ Confus? Voici le choix facile

**Je fais quoi?** → **Quel endpoint?**

- Première mise en stock → **DEPOT**
- Déplacer stock d'A vers B → **TRANSFERT**  
- Vendre à client → **RETRAIT**
- Vendre à autre commerçant → **VIREMENT**

---

## 🔑 Paramètres essentiels

Tous les endpoints stock acceptent ces champs:

| Paramètre | Toujours requis? | Description |
|-----------|---|---|
| `productId` | ✅ OUI | ID du produit |
| `quantite` | ✅ OUI | Quantité (>0) |
| `prixUnitaire` | ✅ OUI | Prix unitaire |
| `siteDestinationId` | ✅ OUI | Site destination |
| `siteOrigineId` | ⭕ NON (DEPOT seulement) | Site d'origine |
| `ayant_droit` | ⭕ NON | Nouveau propriétaire (VIREMENT) |
| `detentaire` | ⭕ NON | Qui garde le stock |
| `observations` | ⭕ NON | Notes |

---

## 🎨 Avec authentification

L'en-tête `Authorization: Bearer` est **obligatoire** pour tous les endpoints:

```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Où trouver votre token?**
1. Connectez-vous: `POST /api/v1/auth/login`
2. Récupérez le `accessToken` de la réponse
3. Utilisez-le dans `Authorization: Bearer TOKEN`

---

## ✅ Succès = Code 201

Une requête réussie retourne:

```json
{
  "_id": "507f1f77bcf86cd799439099",
  "type": "DEPOT",
  "productId": "ID",
  "quantite": 1000,
  "createdAt": "2026-04-10T12:30:00Z",
  "depotDestination": "HANGAR ANDRANOMENA"
}
```

---

## ❌ Erreur = Code 400/404

Erreurs courantes:

| Erreur | Cause | Solution |
|--------|-------|----------|
| 400 Bad Request | Quantité invalide | Vérifier quantite > 0 |
| 401 Unauthorized | Token manquant | Ajouter Authorization header |
| 404 Not Found | Produit/Site inexistant | Vérifier les IDs |
| 422 Unprocessable | Paramètres manquants | Vérifier les champs requis |

---

## 📖 Besoin de plus de détails?

👉 Consultez: [STOCK_ENDPOINTS_GUIDE.md](./STOCK_ENDPOINTS_GUIDE.md)

---

## 💡 Tips

✅ **Testez d'abord dans Swagger** (interface graphique facile)
✅ **Notez les IDs** des produits et sites pour les requêtes suivantes  
✅ **Consultez /ledger/actifs** après chaque mouvement pour vérifier
✅ **Les mouvements sont traçables** dans /stock/history

---

Vous êtes prêt! 🚀
