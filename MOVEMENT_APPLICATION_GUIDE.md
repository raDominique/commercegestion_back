# Guide: Transaction Movement Application (Mouvements d'Actifs et Passifs)

## 📋 Vue d'ensemble

Lors de l'approbation d'une transaction, le système applique automatiquement les mouvements d'actifs et passifs. Cela met à jour les bilans de stock de chaque utilisateur.

---

## 🔄 Flux: DÉPÔT

### Exemple: RAKOTO dépose 5.000 kg à RABE

**Transaction créée:**
```
Status: PENDING
Type: DÉPÔT
Initiator: RAKOTO
Recipient: RABE
Product: RIZ MAKALIOKA
Quantity: 5000
OriginSite: HANGAR ANDRANOMENA (RAKOTO)
DestinationSite: HANGAR ALASORA (RABE)
```

**RABE approuve la transaction:**
```
PATCH /transactions/{id}/approve
```

**Mouvements appliqués automatiquement:**

#### 1️⃣ Actif de RAKOTO diminue
```typescript
await actifsService.decreaseActif(
  'RAKOTO',                    // userId
  'HANGAR ANDRANOMENA',        // depotId
  'RIZ MAKALIOKA',             // productId
  5000                         // quantite
);
```

**Avant:** RAKOTO a 12.500 kg
**Après:**  RAKOTO a 7.500 kg ✅

---

#### 2️⃣ Actif de RABE augmente
```typescript
await actifsService.addOrIncreaseActif(
  'RABE',                      // userId (propriétaire du bilan)
  'HANGAR ALASORA',            // depotId (site physique)
  'RIZ MAKALIOKA',             // productId
  5000,                        // quantite
  50000,                       // unitPrice
  'RABE',                      // detentaireId (qui garde le produit)
  'RAKOTO'                     // ayantDroitId (propriétaire légal = RAKOTO!)
);
```

**Avant:** RABE a 2.000 kg
**Après:**  RABE a 7.000 kg ✅

**⚠️ Important:** L'`ayant_droit` est **RAKOTO** (pas RABE)
- RABE détient physiquement le produit
- RAKOTO en reste propriétaire légalement

---

#### 3️⃣ Passif créé pour RABE
```typescript
await passifsService.addOrIncreasePassif(
  'RABE',                      // detentaireId (qui doit)
  'HANGAR ALASORA',            // depotId
  'RIZ MAKALIOKA',             // productId
  5000,                        // quantite
  'RAKOTO'                     // creancierId (à qui il le doit)
);
```

**Création:** RABE doit 5.000 kg à RAKOTO ✅

---

## 🔄 Flux: RETOUR

### Exemple: RABE retourne 3.000 kg à RAKOTO

**Transaction créée:**
```
Status: PENDING
Type: RETOUR
Initiator: RABE (qui retourne)
Recipient: RAKOTO (propriétaire)
Product: RIZ MAKALIOKA
Quantity: 3000
OriginSite: HANGAR ALASORA (RABE)
DestinationSite: HANGAR ANDRANOMENA (RAKOTO)
```

**RAKOTO approuve le retour:**

**Mouvements appliqués:**

#### 1️⃣ Actif de RABE diminue
```typescript
await actifsService.decreaseActif(
  'RABE',                      // userId
  'HANGAR ALASORA',            // depotId
  'RIZ MAKALIOKA',             // productId
  3000                         // quantite
);
```

**Avant:** RABE a 7.000 kg
**Après:**  RABE a 4.000 kg ✅

---

#### 2️⃣ Actif de RAKOTO augmente
```typescript
await actifsService.addOrIncreaseActif(
  'RAKOTO',                    // userId
  'HANGAR ANDRANOMENA',        // depotId
  'RIZ MAKALIOKA',             // productId
  3000,                        // quantite
  50000,                       // unitPrice
  'RAKOTO',                    // detentaireId
  'RAKOTO'                     // ayantDroitId (lui-même à nouveau)
);
```

**Avant:** RAKOTO a 7.500 kg
**Après:**  RAKOTO a 10.500 kg ✅

---

#### 3️⃣ Passif de RABE diminue
```typescript
await passifsService.decreasePassifByCreditor(
  'RABE',                      // detentaireId (qui devait)
  'RIZ MAKALIOKA',             // productId
  'RAKOTO',                    // creancierId (à qui il devait)
  3000                         // quantite (diminue la dette)
);
```

**Avant:** RABE doit 5.000 kg à RAKOTO
**Après:**  RABE doit 2.000 kg à RAKOTO ✅

---

## 🔄 Flux: INITIALISATION

### Exemple: RAKOTO initialise 12.500 kg

**Transaction créée:**
```
Status: PENDING
Type: INITIALISATION
Initiator: RAKOTO
Product: RIZ MAKALIOKA
Site: HANGAR ANDRANOMENA
Quantity: 12500
```

**RAKOTO approuve l'initialisation:**

**Mouvements appliqués:**

#### 1️⃣ Actif créé pour RAKOTO
```typescript
await actifsService.addOrIncreaseActif(
  'RAKOTO',                    // userId
  'HANGAR ANDRANOMENA',        // depotId
  'RIZ MAKALIOKA',             // productId
  12500,                       // quantite
  50000,                       // unitPrice
  'RAKOTO',                    // detentaireId
  'RAKOTO'                     // ayantDroitId
);
```

**Résultat:** RAKOTO a maintenant 12.500 kg en stock ✅

**⚠️ Note:** Pas de passif car l'utilisateur ne doit rien à personne

---

## 📊 Tableau Récapitulatif: Évolution des Stocks

### Scenario Complet

| Étape | Événement | RAKOTO Stock | RABE Stock | RABE doit à RAKOTO |
|-------|-----------|--------------|-----------|-------------------|
| 0 | Init RAKOTO | **12.500** | 0 | 0 |
| 1 | Init RABE | 12.500 | **2.000** | 0 |
| 2 | RAKOTO dépose 5.000 | **7.500** | **7.000** | **5.000** |
| 3 | RABE retourne 3.000 | **10.500** | **4.000** | **2.000** |
| 4 | RABE retourne 2.000 | **12.500** | **2.000** | **0** (éteint) |

---

## 🛑 Gestion des Erreurs

### Cas: Stock insuffisant lors d'une diminution

**Exemple:** RABE essaie de retourner 5.000 kg mais n'en a que 4.000

```typescript
// Dans actifsService.decreaseActif()
if (!actif || actif.quantite < quantite) {
  throw new NotFoundException(
    `Stock insuffisant ou actif inexistant. 
    (Demandé: 5000, Dispo: 4000)`
  );
}
```

**Résultat:** La transaction d'approbation échoue ❌

---

### Cas: Passif insuffisant lors d'un retour

**Exemple:** RABE retourne 3.000 kg mais n'en devait que 2.000

```typescript
// Dans passifsService.decreasePassifByCreditor()
if (!passif || passif.quantite < quantite) {
  console.warn(
    `Passif insuffisant ou inexistant...`
  );
  return; // Pas d'erreur, mais log d'avertissement
}
```

**Résultat:** Le passif est complètement supprimé (mise à 0) ⚠️

---

## 🔍 Format des Logs

Lors de chaque mouvement approuvé, les logs affichent:

```
✅ Deposit movements applied for transaction: 20240115103000001

✅ Return movements applied for transaction: 20240115103000002

✅ Initialization movements applied for transaction: 20240115103000003
```

En cas d'erreur:

```
❌ Error applying deposit movements: TypeError: Cannot read property 'quantite'
```

---

## 📝 Code Source

### TransactionsService.applyTransactionMovements()
- Appelée automatiquement lors de l'approbation d'une transaction
- Distribue à la bonne méthode selon le type (DÉPÔT, RETOUR, INITIALISATION)

### Fichiers impactés:
- `src/v1/transactions/transactions.service.ts` - Implémentation des 3 méthodes
- `src/v1/passifs/passifs.service.ts` - Nouvelle méthode `decreasePassifByCreditor()`
- `src/v1/transactions/transactions.module.ts` - Import de PassifsModule

---

## ⚡ Points Clés

✅ **Les mouvements sont appliqués UNIQUEMENT lors de l'approbation**
- Status PENDING → Pas de mouvements
- Status APPROVED → Mouvements appliqués
- Status REJECTED → Pas de mouvements

✅ **Les actifs et passifs reflètent l'état ACTUEL**
- Chaque dépôt crée un passif correspondant
- Chaque retour réduit le passif
- L'initialisation lance un nouvel actif

✅ **La traçabilité est dans les TRANSACTIONS**
- Chaque transaction conserve l'historique complet
- Le grand livre affiche les mouvements formatés

---

## 🔗 Intégration complète

```
User A ──→ POST /transactions/deposit ──→ Status: PENDING
            ↓
        Approuve (PATCH /approve)
            ↓
        applyTransactionMovements()
            ├── decreaseActif(A)
            ├── addOrIncreaseActif(B)
            └── addOrIncreasePassif(B → A)
            ↓
        ActifsModule + PassifsModule MAJ ✅
            ↓
        GET /ledger/user/A ──→ Mouvements visibles ✅
        GET /ledger/user/B ──→ Mouvements & Passifs visibles ✅
```

---

## 📚 Endpoints liés

1. **Créer une transaction**
   ```
   POST /transactions/deposit
   POST /transactions/return
   POST /transactions/initialization
   ```

2. **Approuver/Rejeter**
   ```
   PATCH /transactions/:id/approve
   PATCH /transactions/:id/reject
   ```

3. **Consulter les impacts**
   ```
   GET /ledger/user/:userId            # Mouvements complets
   GET /ledger/actifs/:userId          # Actifs uniquement
   GET /ledger/passifs/:userId         # Passifs uniquement
   GET /ledger/stock-card/:userId/:productId  # Fiche détaillée
   ```

---

## 🎯 Prochains pas recommandés

1. **Tests unitaires** - Valider chaque cas de mouvement
2. **Tests E2E** - Scénarios complets de transactions
3. **Notifications** - Envoyer emails lors des approbations
4. **Audit logging** - Tracer qui a approuvé et quand
5. **Rollback** - Permettre l'annulation avec compensation
