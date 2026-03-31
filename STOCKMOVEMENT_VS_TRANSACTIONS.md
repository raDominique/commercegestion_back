# Stock Movements vs Transactions: Clarification des Rôles

## 🎯 Vue d'ensemble

Votre projet a **DEUX SYSTÈMES** pour gérer les stocks:

1. **Transactions Module** (NOUVEAU) - Pour les mouvements commerciaux
2. **Stock Module** / StockMovement (ANCIEN) - Pour les mouvements physiques

Ils coexistent et jouent des rôles **différents**!

---

## 📊 Comparaison

| Aspect | **Transactions** | **StockMovement** |
|--------|-----------------|------------------|
| **Créé par** | Frontend dépose/retour formulaire | Frontend crée mouvement physique |
| **Types** | DÉPÔT, RETOUR, INITIALISATION | DEPOT, RETRAIT, TRANSFERT, VIREMENT |
| **Status** | PENDING → APPROVED → Déploie mouvements | isValide: true/false |
| **Workflow** | ✅ Besoin approbation | ❌ Pas d'approbation (validation directe) |
| **Rôle** | **Commerciale** (qui doit à qui) | **Logistique** (où est le produit) |
| **Cible** | Dépôts entre membres | Mouvements d'entrepôt |
| **API** | `/transactions/deposit`, `/transactions/:id/approve` | `/stock/deposit`, `/stock/withdraw`, `/stock/transfer` |

---

## 🔍 Rôles Détaillés

### 📋 **Transactions Module** - Flux Commerciale

**Objectif:** Gérer les dépôts d'actifs entre DEUX MEMBRES différents

**Cas d'usage:**
```
RAKOTO → veut déposer 5.000 kg RIZ chez RABE
│
├→ Crée transaction (PENDING)
├→ RABE reçoit notification
├→ RABE approuve (ou rejette)
├→ Si approuvé:
│   ├→ RAKOTO perd quantité (Actif)
│   ├→ RABE gagne quantité (Actif)
│   └→ RABE doit à RAKOTO (Passif créé)
└→ Visible dans /ledger/user/RAKOTO et /ledger/user/RABE
```

**Endpoints:**
```
POST   /transactions/deposit           # RAKOTO crée le dépôt
POST   /transactions/return            # RABE retourne des produits
POST   /transactions/initialization    # Initialiser mon stock
PATCH  /transactions/:id/approve       # RABE approuve
PATCH  /transactions/:id/reject        # RABE rejette
GET    /transactions/pending/list      # RABE voit les dépôts à valider
```

---

### 🏭 **StockMovement Module** - Flux Logistique

**Objectif:** Tracer les mouvements PHYSIQUES de stock (déplacements de hangar)

**Cas d'usage:**
```
RAKOTO → doit déplacer 500 kg de RIZ du HANGAR 1 au HANGAR 2
│
├→ Crée mouvement (isValide: false)
├→ Système enregistre le mouvement
├→ Logistique valide le mouvement
└→ Visible dans l'historique complet
```

**Endpoints:**
```
POST /stock/deposit                 # Dépôt initial d'un produit
POST /stock/withdraw                # Retrait de stock
POST /stock/transfer                # Transfert physique entre hangars
POST /stock/virement                # Virement de propriété
GET  /stock/my-actifs               # Mes actifs actuels
GET  /stock/history                 # Historique des mouvements
```

---

## 🔗 Intégration

### **Les deux systèmes impactent les MÊMES données:**

```
CompteARakoto {
  Actifs: [
    { produit: RIZ, quantité: 12500, site: HANGAR1 },
    { produit: RIZ, quantité: 5000, site: HANGAR2, détenteur: RABE }
  ],
  Passifs: [
    { doit à RABE 3000 kg RIZ }
  ]
}
```

**Deux chemins mènent aux mêmes données:**

```
Path 1: Transactions
  Transaction DÉPÔT (PENDING)
    ↓
  Approuve (PATCH /approve)
    ↓
  applyDepositMovements()
    ├→ actifsService.decreaseActif(RAKOTO)
    └→ passifsService.addOrIncreasePassif(...)
    ↓
  Actifs/Passifs UPDATÉS ✅

Path 2: StockMovement
  createMovement(DEPOT)
    ↓
  processMovementByType()
    ├→ actifsService.addOrIncreaseActif()
    └→ passifsService.addOrIncreasePassif()
    ↓
  Actifs/Passifs UPDATÉS ✅
```

---

## 💡 Quand Utiliser Quoi?

### ✅ **Utiliser TRANSACTIONS quand:**
- ✓ Un membre dépose chez un autre membre
- ✓ Un membre retourne au propriétaire
- ✓ Initialisation du stock
- ✓ Besoin d'une **approbation** du receveur
- ✓ Créer des **dettes** (passifs)

**Exemple Frontend:**
```javascript
// Formulaire "Dépôt d'Actif"
function depotProductModal() {
  const [form] = Form.useForm();
  
  const onSubmit = async (values) => {
    const response = await api.post('/transactions/deposit', {
      initiatorId: currentUser.id,
      recipientId: values.memberTo.id,
      productId: values.product.id,
      originSiteId: values.originSite.id,
      destinationSiteId: values.destinationSite.id,
      quantity: values.quantity
    });
    
    message.success('Dépôt en attente d\'approbation');
    // Afficher: Status: PENDING
  };
}
```

---

### ✅ **Utiliser STOCK MOVEMENTS quand:**
- ✓ Déplacer un produit entre DEUX SITES du MÊME utilisateur
- ✓ Retrait de stock (vente, destruction)
- ✓ Transfert de propriété SANS mouvement physique
- ✓ Mouvements **internes** de hangar
- ✓ N'a PAS besoin d'approbation (validation directe)

**Exemple Frontend:**
```javascript
// Formulaire "Déplacer Stock"
function transferStockModal() {
  const [form] = Form.useForm();
  
  const onSubmit = async (values) => {
    const response = await api.post('/stock/transfer', {
      productId: values.product.id,
      quantite: values.quantity,
      siteOrigineId: values.fromSite.id,      // HANGAR 1
      siteDestinationId: values.toSite.id,    // HANGAR 2
      // Même utilisateur!
    });
    
    message.success('Stock transféré');
    // Mouvement enregistré directement
  };
}
```

---

## 📱 Rôles du Frontend

### **Dashboard Utilisateur**

```
┌─────────────────────────────────────────┐
│         MON TABLEAU DE BORD              │
├─────────────────────────────────────────┤
│                                         │
│  📊 MES STOCKS (Actifs/Passifs)         │
│  ├─ RIZ MAKALIOKA: 12.500 kg            │
│  ├─ Dont détenu par RABE: 5.000 kg      │
│  └─ Je dois à RABE: 3.000 kg            │
│                                         │
│  📝 MES TRANSACTIONS (Commerciales)     │
│  ├─ EN ATTENTE                          │
│  │  └─ Dépôt à RABE (5.000 kg) -PENDING │
│  └─ APPROUVÉES                          │
│     └─ Retour de RABE (3.000 kg) -OK   │
│                                         │
│  📋 MES MOUVEMENTS (Logistiques)        │
│  ├─ Transfer HANGAR1→HANGAR2 (500 kg)  │
│  ├─ Retrait (Vente) 1.000 kg            │
│  └─ Historique: ...                     │
│                                         │
│  🎯 ACTIONS                             │
│  ├─ [Nouveau Dépôt] → Transactions API  │
│  ├─ [Déplacer Stock] → StockMovement API│
│  └─ [Consulter Ledger] → LedgerDisplay  │
└─────────────────────────────────────────┘
```

---

## 🔄 Flux Complet: Exemple Réaliste

### **Scénario: RAKOTO - Gestion Complète**

**Jour 1: Initialisation**
```
1️⃣ POST /transactions/initialization
   - Initialise 12.500 kg RIZ au HANGAR ANDRANOMENA
   - Status: APPROVED directement (pas besoin d'approbation)
   - Actifs RAKOTO: 12.500 kg ✅
```

**Jour 2: Dépôt commercial**
```
2️⃣ POST /transactions/deposit
   - Dépôt de 5.000 kg à RABE
   - Status: PENDING (attente approbation)
   - Notification à RABE
   
3️⃣ RABE consulte /transactions/pending/list
   - Voit: "RAKOTO veut dépôter 5.000 kg"
   
4️⃣ RABE PATCH /transactions/{id}/approve
   - applyDepositMovements() appliquée
   - Actifs RAKOTO: 7.500 kg (diminué)
   - Actifs RABE: +5.000 kg (augmenté)
   - Passif RABE: Doit 5.000 kg à RAKOTO
```

**Jour 3: Déplacement interne**
```
5️⃣ POST /stock/transfer
   - RABE déplace 2.000 kg du HANGAR ALASORA 1 au HANGAR ALASORA 2
   - Détenteur: RABE (inchangé)
   - Propriétaire: Toujours RAKOTO
   - isValide: false (en cours)
   
6️⃣ POST /stock/transfer (validation)
   - isValide: true
   - Mouvement enregistré dans historique
```

**Jour 4: Retour partiel**
```
7️⃣ POST /transactions/return
   - RABE retourne 3.000 kg à RAKOTO
   - Status: PENDING
   
8️⃣ RAKOTO approuve PATCH /transactions/{id}/approve
   - applyReturnMovements() appliquée
   - Actifs RABE: 2.000 kg (diminué de 3.000)
   - Actifs RAKOTO: 10.500 kg (augmenté)
   - Passif RABE: 2.000 kg seulement (diminué)
```

**Jour 5: Consultation**
```
9️⃣ GET /ledger/user/RAKOTO
   - Affiche: Tous les mouvements depuis le jour 1
   - Mouvements d'Actifs: -5.000, +3.000 = Bilan
   - Mouvements de Passifs: 0 (dans mon cas)
   
🔟 GET /stock/my-actifs
   - Affiche: Stock actuel (12.500 - 2.000 = 10.500 kg)
   - Historique des mouvements physiques
```

---

## 📊 Tableau Récapitulatif

| Jour | Action | Module | API | Status | Actifs RAKOTO | Passifs RABE |
|------|--------|--------|-----|--------|---------------|----------------|
| 1 | Init | Transactions | POST /transactions/initialization | APPROVED | **12.500** | 0 |
| 2 | Dépôt | Transactions | POST /transactions/deposit | PENDING | 12.500 | - |
| 2b | Approbation | Transactions | PATCH /approve | APPROVED | **7.500** | **5.000** |
| 3 | Transfer | StockMovement | POST /stock/transfer | isValide | 7.500 | 5.000 |
| 4 | Retour | Transactions | POST /transactions/return | PENDING | 7.500 | 5.000 |
| 4b | Approbation | Transactions | PATCH /approve | APPROVED | **10.500** | **2.000** |

---

## 🎯 Rôles du StockMovements MAINTENANT

Après l'implémentation des Transactions:

### ✅ **StockMovement conserve ses rôles:**

1. **Mouvements Internes** - Déplacer stock entre DEUX SITES du MÊME utilisateur
2. **Historique Détaillé** - Trace chaque petit mouvement
3. **Logistique** - Validation isValide: true/false
4. **Flexibilité** - API simple pour créer des mouvements sans workflow

### ⚠️ **StockMovement NE remplace PAS Transactions pour:**

- ❌ Dépôts entre DIFFÉRENTS membres
- ❌ Créer des dettes (passifs commerciaux)
- ❌ Besoin d'approbation avant prise d'effet
- ❌ Traçabilité commerciale

---

## 📱 Dashboard Frontend Recommandé

```
┌─────────────────────────────────────────────────┐
│    STOCK & TRANSACTIONS - DASHBOARD PRINCIPAL   │
├─────────────────────────────────┬───────────────┤
│  ACTIFS ACTUELS                 │  ACTIONS      │
│  ├─ RIZ: 12.500 kg              │  ┌─────────────┤
│  ├─ MAÏS: 8.000 kg              │  │ [+ Dépôt]   │
│  └─ BLÉ: 5.500 kg               │  │ [+ Retour]  │
│  PASSIFS (Je dois)              │  │ [+ Init.]   │
│  ├─ À RABE: 3.000 kg RIZ        │  │ [+ Déplacer]│
│  └─ À PIERRE: 2.000 kg MAÏS     │  │ [+ Vendre]  │
│                                 │  └─────────────┤
├─────────────────────────────────┤───────────────┤
│  TRANSACTIONS EN ATTENTE        │ STOCK MOVES   │
│  ├─ [PENDING] Dépôt à RABE      │ ├─ Transfer   │
│  │  5000 kg (📋 Approuver)      │ ├─ Withdraw   │
│  └─ [PENDING] Retour de PIERRE  │ └─ History    │
│  3000 kg (📋 Approuver)         │               │
├─────────────────────────────────┤───────────────┤
│  GRAND LIVRE (LEDGER)           │ FICHE STOCK   │
│  │ Voir tous les mouvements      │ │ Par produit │
│  │ Mouvements d'actifs           │ │ Par site    │
│  │ Mouvements de passifs         │ │ Historique  │
│  └────────────────────────────────────────────────┘
```

---

## 🚀 Prochaines Étapes

1. **Frontend doit différencier:**
   - Onglet "Transactions Commerciales" (Dépôts/Retours)
   - Onglet "Mouvements Logistiques" (Transfer/Withdraw)
   - Onglet "Grand Livre" (Vue complète)

2. **Notifications:**
   - Email quand transaction PENDING
   - Notif quand approuvée/rejetée

3. **Validation:**
   - Vérifier les stocks avant création
   - Bloquer les mouvements invalides

4. **Rapports:**
   - Ledger pour audit comptable
   - Historique pour traçabilité

---

## 📝 Résumé

| Besoin | Module | API |
|--------|--------|-----|
| Déposer à un autre membre | Transactions | POST /transactions/deposit |
| Approuver dépôt | Transactions | PATCH /transactions/:id/approve |
| Retourner produit | Transactions | POST /transactions/return |
| Déplacer entre hangars | StockMovement | POST /stock/transfer |
| Vendre/Retirer | StockMovement | POST /stock/withdraw |
| Voir stocks actuels | Actifs/Passifs | GET /ledger/user/:userId |
| Voir mouvements complets | LedgerDisplay | GET /ledger/user/:userId |
| Audit complet | Transactions + StockMovement | GET /transactions/... + GET /stock/history |

✅ **Les deux systèmes coexistent harmonieusement!**
