# Vérification affichage Actifs / Passifs (MGA)

## Contexte
Un écart est constaté entre le total des **actifs** et la somme des **passifs** pour le produit MGA :
- Actifs affichés : `885 000`
- Passifs affichés : `1 080 000`
- Écart : `195 000`

## Cause côté API
Le endpoint passifs (`/api/v1/ledger/passifs/:userId`) renvoie désormais **deux types de lignes** :
1. Les passifs où l'utilisateur est **débiteur / détenteur** (champ `userId`).
2. Les passifs où l'utilisateur est **créancier / ayant droit** (champ `ayantDroitId`).

Le endpoint actifs (`/api/v1/ledger/actifs/:userId`) ne renvoie que les actifs dont l'utilisateur est propriétaire (`userId`).

## Conséquence
Si le frontend **additionne toutes les lignes** de passifs, il additionne des dettes et des créances de bilans différents → total supérieur aux actifs.

## Ce que le frontend doit vérifier
1. Les totaux affichés additionnent-ils **toutes** les lignes du tableau passifs ?
2. Le tableau passifs distingue-t-il les lignes où l'utilisateur est **détenteur** (`userId`) de celles où il est **ayant droit** (`ayantDroitId`) ?
3. Chaque ligne contient bien `detentaireId`, `ayantDroitId` et `userId` pour permettre le filtrage.

## Comportement attendu
- **Option A (recommandée)** : afficher deux sections distinctes :
  - « Passifs dont je suis débiteur » → somme comparable aux actifs.
  - « Créances dont je suis bénéficiaire » → ne pas additionner au total actifs.
- **Option B** : n'afficher que les passifs où l'utilisateur est détenteur (`userId`) pour le total.

## Exemple de logique frontend
```ts
const mesPassifs = passifs.filter(p => p.userId === currentUserId);
const mesCreances = passifs.filter(p => p.ayantDroitId === currentUserId);

const totalPassifs = mesPassifs.reduce((sum, p) => sum + p.quantite, 0);
// Ne pas ajouter mesCreances au total actifs
```

## Critères d'acceptation
- [ ] Total actifs >= total passifs (section débiteur uniquement).
- [ ] Les créances sont affichées séparément et ne faussent pas le total.
- [ ] L'écart MGA disparaît après clarification de l'affichage.
