# Tâche — Corriger toutes les erreurs ESLint

**Statut** : en cours, mis en pause le 2026-11-19.
**Objectif** : atteindre **0 erreur ESLint** en typant proprement le code (décision : pas de désactivation des règles `no-unsafe-*`).

Mesurer l'état actuel :

```bash
npx eslint "{src,apps,libs,test}/**/*.ts"            # liste complète
npx eslint "{src,apps,libs,test}/**/*.ts" -f json -o eslint.json   # pour un comptage par règle / fichier
```

État de départ : **1 813 erreurs** (91 % de règles `no-unsafe-*`, dues à des valeurs `any`) et 321 avertissements, dans 64 fichiers.

---

## 1. Déjà fait

### Lot 0 — corrections automatiques
- `eslint --fix` sur tout le projet (formatage Prettier) : −87 erreurs.

### Configuration
- `eslint.config.mjs` : `@typescript-eslint/no-unused-vars` accepte le préfixe `_` pour les paramètres et variables volontairement inutilisés (`argsIgnorePattern: '^_'`, `varsIgnorePattern: '^_'`).

### Types partagés (nouveau fichier)
- [src/v1/auth/interfaces/authenticated-user.interface.ts](../src/v1/auth/interfaces/authenticated-user.interface.ts) :
  - `JwtPayload` (contenu des JWT) ;
  - `AuthenticatedUser` (contenu de `req.user`) ;
  - `AuthenticatedRequest` (requête Express après un guard JWT) ;
  - `toAuthenticatedUser(payload)`.
- À utiliser partout à la place de `@Req() req: any`, avec `import type { AuthenticatedRequest } from '…'` (un import de valeur casse la compilation à cause de `emitDecoratorMetadata`).

### Fichiers corrigés (0 erreur)
- Auth : `strategies/jwt.strategy.ts`, `strategies/jwt-refresh.strategy.ts`, `guards/jwt.guard.ts`, `guards/role.guard.ts`, `guards/two-factor.guard.ts`, `auth.module.ts`, `utils/two-factor-encryption.ts`.
- Commun : `common/filters/http-exception.filter.ts` (réutilise `getErrorReason` de `shared/bulk`), `common/interceptors/transform.interceptor.ts`, `config/swagger.config.ts`, `database/database.module.ts`.
- Divers : `shared/helpers/notify.helper.ts`, `shared/notifications/notifications.gateway.ts`, `v1/sites/sites.schema.ts`, `v1/audit/audit.service.ts`, `v1/app.controller.ts`.
- **13 contrôleurs** : `@Req() req: any` → `@Req() req: AuthenticatedRequest` (notifications, actifs, audit, auth, cart, cpc, passifs, products, shop-available, sites, stock, tenders, users). Il reste quelques erreurs dans certains d'entre eux, voir §2.

### Bugs révélés par le typage et corrigés
| Fichier | Bug | Correction |
|---|---|---|
| `jwt.strategy.ts` | Le payload signe `userEmail`, mais la stratégie lisait `payload.email` → `req.user.email` toujours `undefined` | Lecture de `userEmail` (repli sur `email` pour les anciens jetons) |
| `cpc.controller.ts` | `req.user.id` / `req.user.usersId` n'existent pas → l'audit enregistrait toujours `'system'` | Utilise `req.user.userId` |
| `users.controller.ts` (liste des filleuls) | Sans `userIdPartager` dans le jeton, la requête filtrait sur `parrain1ID: undefined` (risque de renvoyer des membres sans parrain) | `400` explicite si le code de parrainage est absent |

### Vérifications faites
- `npx tsc -p tsconfig.build.json --noEmit` : **OK** après le dernier changement.
- **Tests non relancés** depuis les changements auth/filtre/contrôleurs → à faire en reprenant (voir §3).

---

## 2. Reste à faire

### 2.1 Erreurs simples (hors `no-unsafe-*`)
- **`no-useless-escape`** (27) : `\'` et `\"` inutiles dans des template literals Swagger de `v1/actifs/actifs.controller.ts` et `v1/passifs/passifs.controller.ts`. Supprimer l'antislash **à la colonne exacte signalée par ESLint** (ne pas faire de remplacement global : les `\'` dans des chaînes entre apostrophes sont nécessaires).
- **`no-unused-vars`** restants : imports inutilisés (`audit.controller.ts` `ApiParam`, `products.service.ts` `Inject`/`forwardRef`/`Readable`, `tender.service.ts` `ProductService`, `transactions.module.ts` `forwardRef`, `users.module.ts` `NotificationsService`, `create-passif.dto.ts`, `create-product.dto.ts`, `create-user.dto.ts`, `v2/movements/movements.service.ts`) → supprimer. Paramètres `userId` inutilisés des méthodes `exportAll` (actifs, cpc, passifs, products, sites, stock, tenders, users, notifications) → renommer `_userId`. Variables locales (`exchange.service.ts` `qtyB`/`label`, `ledger-display.service.ts` `siteObj`/`detentaireId`, `auth.service.ts` `rememberMe` et `catch (e)` → `catch {}`, `export.service.ts` `i`, specs).
- **`require-await`** (7) : retirer `async` (méthode sans `await`) dans `export.service.ts`, `notifications.service.ts` (`notifyAllAdmins`), `auth.service.ts` (`verifyToken`), `transactions.service.spec.ts` — vérifier que les appelants n'attendent pas de `Promise` sinon garder `Promise.resolve(...)`.
- **`no-require-imports`** (3) : `export.service.ts:18`, `users.service.ts:748/757` → `import` en tête de fichier.
- **`no-unsafe-enum-comparison`** : `cart.service.ts:59/134` (statut d'annonce comparé à une chaîne → utiliser `ShopAvailableStatus.ACTIVE`).
- **`restrict-template-expressions`** : `stock.service.ts:62`, `transactions.service.ts` (`ObjectId` dans un template → `.toString()` / `String()`).
- **`prefer-promise-reject-errors`** : `export.service.ts:69` → rejeter avec une `Error`.

### 2.2 Contrôleurs restants
- `users.controller.ts:249` : `@Req() req` sans type → `AuthenticatedRequest`.
- `tender.controller.ts:275`, `sites.controller.ts:214`, `stock.controller.ts:559/604` : renvoient des valeurs `any` venant des services → corriger le type de retour **dans le service** (`Promise<any>` → type précis).
- `ledger-display.controller.ts` : dépend des types de `ledger-display.service.ts` (à traiter avec le service).

### 2.3 Services et specs (`no-unsafe-*`), du plus petit au plus gros
Nombre d'erreurs au départ (avant ce travail) :

| Fichier | Erreurs |
|---|---|
| `shared/notifications/notifications.service.ts` | 6 |
| `v1/shop-available/shop-available.service.ts` | 6 |
| `v2/users/users.service.ts` | 6 |
| `v1/cart/cart.service.ts` | 8 |
| `v1/sites/sites.service.ts` | 10 |
| `shared/export/export.service.ts` | 14 |
| `shared/mail/mail-queue.service.spec.ts` | 24 |
| `v1/exchange/exchange.service.ts` | 27 |
| `v1/passifs/passifs.service.ts` | 31 |
| `v1/dashboard/dashboard.service.ts` | 36 |
| `v1/tenders/tender.service.ts` | 44 |
| `v1/cpc/cpc.service.ts` | 48 |
| `v1/users/users.service.ts` | 49 |
| `v1/passifs/passifs.service.spec.ts` | 64 |
| `v1/products/products.service.ts` | 67 |
| `v1/stock/stock.service.ts` | 69 |
| `v1/actifs/actifs.service.ts` | 88 |
| `v1/transactions/transactions.service.ts` | 119 |
| `v1/auth/auth.service.ts` | 120 |
| `v1/ledger-display/ledger-display.service.ts` (+ contrôleur) | ~600 |

Petites specs aussi : `transactions.service.spec.ts` (13), `ledger-display.service.spec.ts` (3), `actifs.service.spec.ts` (3), `mail.service.spec.ts` (2), `auth.service.spec.ts` (1), `dashboard.controller.spec.ts` (1).

**Causes principales et façon de les corriger** :
- Documents peuplés (`.populate()`) lus comme `any` → typer le résultat (`populate<{ productId: ProductDocument }>(…)` ou un type `Populated…` local), comme fait dans `transactions.service.ts > computeWithdrawable`.
- `.lean()` sans type → `.lean<MonType[]>()`.
- `catch (error)` puis `error.message` → `error instanceof Error ? error.message : String(error)` (ou `getErrorReason` de `shared/bulk`).
- Paramètres `any` (`query: any`, `filter: any`) → DTO ou type précis.
- `ledger-display.service.ts` : définir d'abord les types des lignes du grand livre (mouvement, ligne d'actif, ligne de passif) puis les appliquer ; ce fichier n'a presque pas de tests, avancer par petites étapes et comparer les réponses avant/après.

---

## 3. Méthode de travail (pour reprendre)

1. Un lot = quelques fichiers. Après chaque lot :
   - `npx tsc -p tsconfig.build.json --noEmit` ;
   - `npx eslint <fichiers du lot>` ;
   - `npx jest` et comparer à la référence ci-dessous.
2. **Référence des tests** (avant ce travail) : 13 suites en échec **déjà existantes** (import ESM de `@faker-js/faker` sous Jest, plus 1 test d'`app.controller`), 81 tests OK. Toute autre suite en échec est une régression.
3. Ne pas changer de comportement en typant ; si le typage révèle un bug (comme en §1), le corriger à part et le noter dans ce fichier.
4. Ne pas désactiver de règle ni ajouter de `eslint-disable` (décision du projet), sauf accord explicite.
