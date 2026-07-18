# 🔄 Différence entre `/stock/depot` vs `/transactions/deposit`

## 🎯 Résumé rapide

| Aspect | **POST /stock/depot** | **POST /transactions/deposit** |
|--------|---|---|
| **Exécution** | ⚡ **IMMÉDIATE** | ⏳ **PENDING → APPROUVÉ** |
| **Approbation** | ❌ Aucune | ✅ Requise |
| **Timing** | Tout de suite | Après approbation |
| **Cas d'usage** | Stock personnel | Stock commercial/tiers |
| **Notifications** | Aucune | ✅ Email au destinataire |
| **Traçabilité** | Mouvement simple | Transaction tracée |
| **Workflow** | Rapide & informel | Formel & auditeable |

---

## 📊 Diagramme du flux

### ⚡ `/stock/depot` - Immédiat
```
┌─────────────────┐
│  POST /stock/   │
│     depot       │
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│ ✅ IMMÉDIAT EXÉCUTÉ:    │
│ • Produit isStocker=T   │
│ • Actif créé            │
│ • Passif créé (si tiers)│
│ • Mouvement enregistré  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 📊 Stock disponible     │
│    maintenant           │
└─────────────────────────┘
```

### ⏳ `/transactions/deposit` - Formel
```
┌──────────────────────────┐
│ POST /transactions/      │
│     deposit              │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────────┐
│ 1️⃣ TRANSACTION CRÉÉE:        │
│ Status = PENDING             │
│ • Pas d'actif encore         │
│ • Pas de passif encore       │
│ • Email envoyé au destinataire
└───────────┬──────────────────┘
            │
    ┌───────┴───────┐
    │               │
    ▼               ▼
┌─────────┐   ┌─────────────┐
│ REJECTED│   │  APPROUVER  │
└─────────┘   └──────┬──────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │ 2️⃣ APPROUVÉ:             │
          │ Status = APPROVED        │
          │ • Mouvements appliqués   │
          │ • Actif initiateur: -Q   │
          │ • Actif receveur: +Q     │
          │ • Passif créé (si tiers) │
          │ • Email de confirmation  │
          └──────────┬───────────────┘
                     │
                     ▼
          ┌──────────────────────────┐
          │ 📊 Stock maintenant      │
          │    disponible pour       │
          │    receveur              │
          └──────────────────────────┘
```

---

## 🔴 `/stock/depot` - Quand l'utiliser?

### ✅ Cas d'usage

**Utilisez `/stock/depot` quand:**

1. ✅ **Vous stockez votre propre produit**
   ```
   Vous achetez du riz et le mettez dans VOTRE hangar
   → Utilisez /stock/depot
   ```

2. ✅ **Vous êtes actuellement le propriétaire**
   ```
   Vous aviez du riz, vous le mettez en stock maintenant
   → Utilisez /stock/depot
   ```

3. ✅ **Vous êtes pressé (pas d'approbation requise)**
   ```
   Vous devez initialiser le stock rapidement
   → Utilisez /stock/depot
   ```

4. ✅ **Mouvement interne/personnel**
   ```
   Réorganisation de votre propre stock
   → Utilisez /stock/depot
   ```

### ❌ Ne l'utilisez PAS pour

- ❌ Stock chez un tiers qui doit approuver
- ❌ Transactions commerciales formelles
- ❌ Quand vous avez besoin de traçabilité audit

---

## 🟢 `/transactions/deposit` - Quand l'utiliser?

### ✅ Cas d'usage

**Utilisez `/transactions/deposit` quand:**

1. ✅ **Transaction commerciale entre deux personnes**
   ```
   RAKOTO envoie du riz à RABE
   RABE doit approuver la réception
   → Utilisez /transactions/deposit
   ```

2. ✅ **Stock qui nécessite approbation**
   ```
   Quelqu'un d'autre doit valider la réception
   → Utilisez /transactions/deposit
   ```

3. ✅ **Vous avez besoin d'une trace audit complète**
   ```
   Pour conformité légale/comptable
   → Utilisez /transactions/deposit
   ```

4. ✅ **Flux formel avec notifications**
   ```
   Notifier quelqu'un d'une transaction
   → Utilisez /transactions/deposit
   ```

5. ✅ **Besoin de retracer qui a approuvé quoi**
   ```
   Qui a rejeté? Quand? Pourquoi?
   → Utilisez /transactions/deposit
   ```

### ❌ Ne l'utilisez PAS pour

- ❌ Stock personnel immédiat
- ❌ Quand vous n'avez pas besoin d'approbation
- ❌ Opérations urgentes (trop lent)

---

## 📈 Exemple pratique: Scénario RAKOTO & RABE

### Scénario 1: RAKOTO met du riz en stock chez lui
```
RAKOTO: "J'ai acheté 1000 kg, je le mets dans mon hangar"

Utilisez: POST /stock/depot
├─ productId: RIZ
├─ quantite: 1000
├─ siteDestinationId: HANGAR_RAKOTO
└─ Résultat: IMMÉDIAT ✅

Après 1 seconde:
├─ Produit marqué EN STOCK
├─ Actif RAKOTO: +1000 kg
├─ Passif: Aucun (c'est à lui)
└─ Stock disponible pour opérations
```

### Scénario 2: RAKOTO envoie du riz à RABE
```
RAKOTO: "Je veux envoyer 500 kg à RABE, il doit approuver"

Utilisez: POST /transactions/deposit
├─ initiatorId: RAKOTO
├─ recipientId: RABE
├─ productId: RIZ
├─ quantite: 500
└─ Résultat: PENDING ⏳

Timeline:
└─ T+0s: Transaction créée, email envoyé à RABE
└─ T+10min: RABE approuve
└─ T+10min: Mouvements appliqués
   ├─ Actif RAKOTO: -500 kg
   ├─ Actif RABE: +500 kg
   ├─ Passif RABE (doit 500 kg à RAKOTO)
   └─ Email de confirmation
```

---

## 🔑 Points clés importants

### État du stock

**`/stock/depot` (immédiat):**
- Stock disponible **immédiatement** après requête
- Visible dans `/ledger/actifs` tout de suite

**`/transactions/deposit` (attendu):**
- Stock **STILL PENDING** jusqu'à approbation
- Non visible dans actifs jusqu'à `APPROVED`
- Après approbation: stock disponible

### Notifications

**`/stock/depot`:**
- ✅ Mouvement enregistré
- ❌ Aucun email envoyé
- ❌ Destinataire ne reçoit pas notification

**`/transactions/deposit`:**
- ✅ Email reçu immédiatement par destinataire
- ✅ Email de confirmation après approbation
- ✅ Audit trail complet enregistré

### Traçabilité

**`/stock/depot`:**
- Mouvement simple
- Qui a fait quoi
- Pas d'approbation à tracer

**`/transactions/deposit`:**
```
Traçabilité complète:
├─ Initiateur: RAKOTO
├─ Destinataire: RABE
├─ Créé à: 2026-04-10 10:00:00
├─ Approbateur: MANAGER_ADMIN
├─ Approuvé à: 2026-04-10 14:30:00
├─ Statut finał: APPROVED
└─ Lié à mouvement StockMovement: ID_xxx
```

---

## 💾 Impact sur les données

### `/stock/depot` crée:
```javascript
✅ Mouvement StockMovement { type: DEPOT, ... }
✅ Actif { userId, productId, quantite, ... }
✅ Passif { detentaire, creancierId, ... } (si tiers)
❌ Transaction (aucune)
```

### `/transactions/deposit` crée:
```javascript
✅ Transaction { 
    status: PENDING,
    initiatorId, recipientId, 
    productId, quantite, ...
}

Puis après approbation (APPROVED):
✅ Mouvement StockMovement { type: DEPOT, ... }
✅ Actif initiateur: -quantité
✅ Actif destinataire: +quantité
✅ Passif (si tiers)
✅ Transaction.linkedStockMovementId = movement._id
```

---

## ⚖️ Comparaison détaillée

| Critère | `/stock/depot` | `/transactions/deposit` |
|---------|---|---|
| **Rapidité** | ⚡ 1 sec | ⏳ Dépend approbation |
| **API simplement** | ✅ Simple (POST) | 🔄 POST + PATCH approve |
| **Emails** | ❌ NON | ✅ OUI (2x) |
| **Audit** | ✅ Mouvement | ✅✅ Transaction + Mouvement |
| **Approbation** | ❌ NON | ✅ REQUIRED |
| **Statut** | ✅ Direct | ⏳→✅ Changement d'état |
| **Révocation** | ❌ Non (seulement retrait) | ✅ Peut rejeter PENDING |
| **Compliance** | ✅ Basique | ✅✅ Renforcée |
| **Coût réseau** | 1 requête | 2 requêtes min |

---

## 🎓 Règle de décision rapide

```
┌─ C'est pour MOI (propriétaire) ?
│  └─ Immédiatement ? → /stock/depot
│  └─ Quelqu'un doit approuver ? → /transactions/deposit
│
├─ C'est pour QUELQU'UN D'AUTRE ?
│  └─ TOUJOURS → /transactions/deposit
│
└─ C'est une transaction COMMERCIALE ?
   └─ TOUJOURS → /transactions/deposit
```

---

## 🧪 Exemple API côte à côte

### Request 1: Stock personnel
```bash
# IMMÉDIAT - Pas d'approbation
POST /api/v1/stock/depot
{
  "productId": "RIZ_ID",
  "quantite": 1000,
  "prixUnitaire": 500,
  "siteDestinationId": "HANGAR_RAKOTO"
}

Response (201):
{
  "_id": "609f...",
  "type": "DEPOT",
  "quantite": 1000,
  "createdAt": "2026-04-10T12:00:00Z"
}

Résultat: ✅ Stock disponible MAINTENANT
```

### Request 2: Transaction commerciale
```bash
# PENDING - Requiert approbation
POST /api/v1/transactions/deposit
{
  "siteOrigineId": "HANGAR_RAKOTO",
  "siteDestinationId": "HANGAR_RABE",
  "productId": "RIZ_ID",
  "quantite": 500,
  "detentaire": "RABE_ID",
  "ayant_droit": "RAKOTO_ID"
}

Response (201):
{
  "_id": "609f...",
  "transactionNumber": "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  "type": "DÉPÔT",
  "status": "PENDING",
  "createdAt": "2026-04-10T12:00:00Z"
}

Ensuite, approbation:
PATCH /api/v1/transactions/609f.../approve
{
  "approverComment": "Approuvé"
}

Response (200):
{
  "status": "APPROVED",
  "approvedAt": "2026-04-10T12:05:00Z",
  "linkedStockMovementId": "507f..."
}

Résultat: ✅ Stock disponible APRÈS approbation
```

---

## 🎯 Conclusion

### Utilisez `/stock/depot`
- ✅ Rapidité prioritaire
- ✅ Stock personnel
- ✅ Pas d'approbation requise
- ✅ Opérations internes

### Utilisez `/transactions/deposit`
- ✅ Transactions commerciales
- ✅ Besoin d'approbation
- ✅ Traçabilité audit
- ✅ Notifications requises

---

## 📚 Documentation complète

- [STOCK_ENDPOINTS_GUIDE.md](./STOCK_ENDPOINTS_GUIDE.md) - Tous les endpoints stock
- [MOVEMENT_APPLICATION_GUIDE.md](./MOVEMENT_APPLICATION_GUIDE.md) - Mouvements comptables
- [TRANSACTIONS_LEDGER_GUIDE.md](./TRANSACTIONS_LEDGER_GUIDE.md) - Transactions détaillées

---

**Version:** 1.0  
**Dernière mise à jour:** 2026-04-10  
**Statut:** ✅ Complet
