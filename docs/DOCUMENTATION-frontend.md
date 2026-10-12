# Documentation Complète – commercegestion_front

Guide exhaustif pour les développeurs prenant en charge ce projet frontend.
Ce document couvre tous les aspects du projet du dépôt à la production.

---

## Table des Matières

1. Vue d'Overview du Projet
2. Installation et Setup
3. Architecture Générale
4. Structure du Projet et Fichiers
5. Gestion d'État (Contextes)
6. Routing et Navigation
7. Services API
8. Hooks Personnalisés
9. Composants UI
10. Tableau de Bord et Pages
11. Notifications WebSocket
12. Variables d'Environnement
13. Scripts et Commandes
14. Style et Tailwind CSS
15. Linting et Quality
16. Contribution
17. Déploiement
18. Fonctionnaliter – Fichiers et Modifications Recommandées
19. Prochaines Étapes pour le Nouveau Développeur
20. Liens Rapides

---

## 1. Vue d'Overview du Projet

- **Framework** : React v19 + Vite
- **UI Library** : MUI (Material UI) v7 + Radix UI
- **Styling** : Tailwind CSS v4
- **Routing** : react-router-dom v7
- **Gestion d'État** : React Context (AuthContext, CartContext, NotificationsContext)
- **Client HTTP** : Axios avec intercepteurs de refresh token
- **Temps Réel** : Socket.io-client pour notifications temps réel
- **Graphiques** : Recharts
- **Formulaires** : Composants contrôlés (MUI Input, Select, etc.)
- **Build** : Vite → `dist/` pour déploiement statique

---

## 2. Installation et Setup

### Prérequis

- Node.js ≥ 18 recommandé
- npm (ou pnpm/yarn, adapter les commandes)

### Étapes

```bash
# 1. Cloner le dépôt
git clone <url-du-repo>
cd commercegestion_front

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
# Voir la section "Variables d'environnement" ci-dessous

# 4. Lancer le serveur de développement
npm run dev

# 5. Ouvrir l'application à l'URL affichée (par défaut http://localhost:5173)
```

### Scripts Disponibles (package.json)

| Script | Description |
|--------|-------------|
| `npm run dev` | Démarre Vite en mode développement (HMR) |
| `npm run build` | Génère le build production dans `dist/` |
| `npm run preview` | Prévisualise le build localement |
| `npm run lint` | Exécute ESLint sur le codebase |

---

## 3. Architecture Générale

```
src/
├─ assets/          # Images, logos, fichiers statiques
├─ components/      # Composants UI (primitifs + layouts)
│   ├─ ui/          # Primitives réutilisables (button, input, card, table, etc.)
│   ├─ Layout/      # Header, Sidebar, Footer, Layout principal
│   └─ commons/     # Composants spécifiques au domaine (CartSheet, UserNotValidatedBanner, etc.)
├─ context/         # React Providers (Auth, Cart, Notifications)
├─ hooks/           # Hooks personnalisés (useNotifications, useCart, etc.)
├─ pages/           # Pages de l'application (associated aux routes)
├─ routes/          # Définition des routes publiques/privées + icônes MUI
├─ services/        # Services axios (auth, cart, produit, socket, etc.)
├─ utils/           # Utilitaires divers (formatNumber, useScreenType, notificationTarget, etc.)
├─ constants/       # Enums et constantes (transaction.enums.js)
└─ styles/          # CSS global (index.css)
```

### Points d'Attention

- **Séparation UI / Logique métier** : Les composants `components/ui` sont agnostiques, la logique d'appel API reside dans `services/`.
- **Centralisation API** : Configurer `axios.config.js` et `token.service.js` pour le token handling.
- **Socket.io** : Nécessite une configuration CORS et des headers `upgrade` côté reverse proxy (nginx).

---

## 4. Structure du Projet et Fichiers

### 4.1 Table de référence des fichiers

| Fichier | Fonctionnalité | Modifications possibles |
|---------|---------------|----------------------|
| `src/context/AuthContext.jsx` | Gère l'état utilisateur (login/logout/token persistence via refreshToken cookie). | Ajouter de nouvelles méthodes d'auth si nécessaire, ajuster le décodage JWT. |
| `src/context/CartContext.jsx` | Gère l'état du panier (ajout/suppression/mise à jour quantités). | Étendre les actions panier, modifier le raffraîchissement cart. |
| `src/context/NotificationsContext.jsx` | Gestionnaire de notifications (souscription socket + historique REST). | Configurer la souscription socket selon l'environnement. |
| `src/services/axios.config.js` | Création d'axios instance avec baseURL proxy Vite. Intercepteurs refresh token automatiques. | Ajouter de nouveaux intercepteurs, modifier le comportement 401. |
| `src/services/token.service.js` | Stockage refreshToken en cookie JS Secure, fonctions get/set/clearAccessToken. | Modifier le nom du cookie, ajouter des options de sécurité. |
| `src/services/auth.service.js` | loginUser, refreshToken, logoutUser, getProfile, changePassword, forgotPassword, resetPassword. | Ajouter de nouvelles méthodes d'auth, modifier les endpoints. |
| `src/services/socket.service.js` | initSocket, ensureSocket, getSocket, disconnectSocket, mapUserAccessToSocket, événements notification & admin_event. | Configurer l'URL socket, ajouter de nouveaux événements. |
| `src/services/cart.service.js` | Operations panier : addToCart, removeCartItem, updateCartItem, clearCart, checkoutCart, getCart. | Étendre les opérations panier, modifier les endpoints. |
| `src/services/product.service.js` | CRUD produits : getProducts, createProduct, updateProduct, deleteProduct, toggleProductValidation, toggleProductStocker, getMyProducts, getShopProducts, selectAllProduits. | Ajouter de nouvelles opérations produit, modifier les schémas de données. |
| `src/services/shop-available.service.js` | getShopItems (produits disponibles à la vente avec pagination/filtrage). | Étendre les filtres de recherche, modifier les paramètres pagination. |
| `src/services/site.service.js` | Gestion des sites (getMySites, etc.). | Ajouter de nouvelles méthodes de gestion de sites. |
| `src/services/dash.service.js` | getStatsDashboard (stats globales pour le tableau de bord). | Ajouter de nouvelles statistiques, modifier le shape des données. |
| `src/services/media.service.js` | getFullMediaUrl (construction URL complète depuis chemin relatif). | Modifier la base URL des médias, ajouter des validations. |
| `src/services/notifications.service.js` | getNotifications, markNotificationAsRead, markAllNotificationsAsRead. | Ajouter de nouvelles méthodes de lecture de notifications. |
| `src/hooks/useNotifications.js` | Hook principal pour notifications temps réel. Gère la souscription socket, l'historique REST, le marquage comme lu, le ciblage vers les bonnes pages via notificationTarget. | Configurer les rôles utilisateur, ajuster la logique de redirection. |
| `src/hooks/usePageTitle.jsx` | Met à jour le titre `<title>` de la page. | Étendre pour inclure des métadonnées SEO. |
| `src/hooks/useScreenType.js` | Détecte mobile/desktop via largeur fenêtre. | Modifier les breakpoints (768/1024). |
| `src/utils/formatNumber.js` | formatThousands – formattage nombres avec séparateurs milliers (fr-FR). | Modifier le séparateur par défaut, ajouter des options de formatage. |
| `src/utils/notificationTarget.js` | resolveNotificationTarget, countUnreadByRoute, formatNotifCount – mapping notifications → pages métier. | Ajouter de nouvelles correspondances titre → page, modifier la logique de fallback. |
| `src/utils/useScreenType.jsx` | Détecte mobile/desktop. | Voir useScreenType hook. |
| `src/utils/externalDomMutationGuard.js` | Garde contre les mutations DOM externes. | Ajuster la logique de détection. |
| `src/utils/inputMasks.js` | Masques d'entrée pour téléphones, nombres, etc. | Ajouter de nouveaux masques, modifier les existants. |
| `src/routes/routes.js` | Définit toutes les routes avec icônes MUI, rôles requis (role), et métadonnées. | Ajouter de nouvelles routes, modifier les rôles par défaut. |
| `src/routes/AppRoutes.jsx` | Configure Router, Routes, Route avec PublicRoutes (login/register) et PrivateRoutes (avec ProtectedRoute et gestion de rôles). | Modifier la logique de protection des routes, ajuster le ProtectedRoute. |
| `src/pages/` | 24 pages principales classées par domaine : Home, Login, Register, ForgotPassword, ResetPassword, Dashboard, Boutique, Actifs, Passifs, Depot, Retrait, VirementDroit, AppelOffre, OperationsAValider, Parrainages, MesProduits, MesTransactions, MesSites, MonCompte, Notifications, EchangeActifs, AchatVente, Panier. | Créer de nouvelles pages, modifier l'import de composants selon besoins. |
| `src/components/Layout/Layout.jsx` | Wrapper principal applique Header + Sidebar + Content + Footer selon taille d'écran. | Modifier la structure de layout, ajuster la visibilité selon roles. |
| `src/components/Layout/Header.jsx` | Barre supérieure avec logo, notification bell, panier, menu mobile/desktop, avatar user, bouton déconnexion. | Ajouter des éléments d'interface, modifier la navigation. |
| `src/components/Layout/Sidebar.jsx` | Menu de navigation vertical avec groupes Navigation/Compte/Administration (conditionnel selon rôle). | Ajouter de nouveaux items de navigation, modifier la visibilité par rôle. |
| `src/components/Layout/Footer.jsx` | Pied de page avec copyright. | Mettre à jour l'année, ajouter des liens. |
| `src/components/Layout/Content.jsx` | Composant contenu principal. | Personnaliser la structure du contenu. |
| `src/components/ui/button.jsx` | Boutons MUI personnalisés avec variantes primary, secondary, success, danger, default, outline, ghost, taille sm/md/lg, état loading. | Ajouter de nouvelles variantes, modifier les styles par défaut. |
| `src/components/ui/input.jsx` | Champs input texte/email/number avec masque optionnel. | Ajouter de nouveaux types d'entrée, modifier les masques. |
| `src/components/ui/select.jsx` | Select MUI avec Searchable, disabled, multiples. | Ajouter de nouvelles options, modifier le comportement. |
| `src/components/ui/card.jsx` | Card avec header/content/footer. | Personnaliser le style, ajouter des variantes. |
| `src/components/ui/table.jsx` | Table composante avec Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter, TableCaption. | Ajouter de nouvelles colonnes, modifier le style. |
| `src/components/ui/badge.jsx` | Badges variant/secondary/info/warning/error. | Ajouter de nouvelles variantes, modifier les styles. |
| `src/components/ui/tooltip.jsx` | Tool-tips avec délai et placement. | Ajuster le délai, modifier les placements disponibles. |
| `src/components/ui/dialog.jsx` | Dialog MUI avec header/content/footer et actions. | Ajouter de nouvelles actions, modifier la taille. |
| `src/components/ui/drawer.jsx` | Drawer slide-in pour menus secondaires. | Modifier la direction d'ouverture, ajuster la largeur. |
| `src/components/ui/sonner.jsx` | Intégration du toast sonner (remplacement de react-toastify). | Modifier les options par défaut du toast. |
| `src/components/ui/avatar.jsx` | Avatars utilisateur (image initiale ou initiale). | Ajouter des styles personnalisés, modifier la fallback. |
| `src/components/ui/loader.jsx` | Loader animé avec message optionnel. | Modifier l'animation, ajouter des messages par défaut. |
| `src/components/ui/progress.jsx` | Barre de progression. | Personnaliser le style, ajouter des variantes. |
| `src/components/ui/tabs.jsx` | Onglets de navigation. | Ajouter de nouveaux triggers, modifier le comportement. |
| `src/components/ui/pagination.jsx` | Pagination réutilisable. | Changer le nombre d'éléments par page, modifier le style. |
| `src/components/ui/sidebar.jsx` | Sidebar utilitaire. | Personnaliser le style, ajouter des options. |
| `src/components/ui/toogle-group.jsx` | Groupe de toggles. | Ajouter de nouvelles options, modifier le style. |
| `src/components/ui/toggle.jsx` | Toggle simple. | Personnaliser l'apparence. |
| `src/components/ui/radio-group.jsx` | Groupe de radios. | Ajouter de nouvelles options. |
| `src/components/ui/checkbox.jsx` | Checkbox simple. | Personnaliser l'apparence. |
| `src/components/ui/collapsible.jsx` | Composant collapsible. | Ajuster le comportement d'ouverture/fermeture. |
| `src/components/ui/accordion.jsx` | Accordion. | Personnaliser les styles des items. |
| `src/components/ui/carousel.jsx` | Carousel. | Ajouter de nouvelles slides, modifier le style. |
| `src/components/ui/calendar.jsx` | Calendar. | Ajouter de nouvelles vues, modifier le comportement. |
| `src/components/ui/popover.jsx` | Popover. | Personnaliser le placement, ajuster le style. |
| `src/components/ui/menubar.jsx` | Menubar. | Ajouter des items, modifier le style. |
| `src/components/ui/dropdown-menu.jsx` | Dropdown menu. | Ajouter des items de menu, modifier le style. |
| `src/components/ui/context-menu.jsx` | Context menu. | Ajouter des items de contexte, modifier le style. |
| `src/components/ui/aspect-ratio.jsx` | Aspect ratio. | Modifier le ratio par défaut. |
| `src/components/ui/skeleton.jsx` | Skeleton loading. | Personnaliser l'apparence. |
| `src/components/ui/resizable.jsx` | Résizable. | Ajuster les zones redimensionnables. |
| `src/components/ui/utils.js` | Utilitaire cn pour la composition de classes Tailwind. | Modifier la fonction cn si besoin. |
| `src/components/commons/authLayout.jsx` | Structure wrapper pour pages d'authentification (login/register/forgot/password-reset) sans header/footer. | Personnaliser la structure des pages d'auth. |
| `src/components/commons/CartSheet.jsx` | Feuilleté panier (mobile). | Ajouter de nouvelles options d'affichage. |
| `src/components/commons/ImageWithFallback.jsx` | Image avec fallback par défaut si pas d'image. | Modifier l'image par défaut, ajouter des styles. |
| `src/components/commons/UserNotValidatedBanner.jsx` | Avertissement si userValidated === false. | Modifier le message, ajuster le style. |
| `src/components/commons/PaginationControls.jsx` | Composant pagination réutilisable. | Changer le nombre d'éléments par page, modifier le style. |
| `src/components/commons/UserAutocomplete.jsx` | Sélecteur d'utilisateur avec recherche. | Ajuster la logique de recherche, modifier l'affichage. |
| `src/components/commons/ExportButton.jsx` | Bouton d'export. | Personnaliser le label, modifier le format d'export. |
| `src/components/commons/ExportDialog.jsx` | Fenêtre d'export CSV/Excel. | Ajouter des options de filtrage, modifier le format. |
| `src/components/commons/ActifsTable.jsx` | Tableau d'actifs. | Ajuster les colonnes, modifier le style. |
| `src/pages/Dashboard/Dashboard.jsx` | Tableau de bord avec cartes statistiques, 6 graphiques Recharts empilés. | Ajouter de nouvelles cartes/métriques, modifier les graphiques. |
| `src/pages/Boutique/Boutique.jsx` | Page Boutique avec produits à vendre, filtrage fournisseur, recherche, tri, pagination, panier, checkout. | Ajouter de nouveaux filtres, modifier le flow checkout. |
| `src/pages/VirementDroit/VirementDroit.jsx` | Page Virement de droit. | Voir docs/FRONTEND_VIREMENT_DROIT.md pour les règles métier. |
| `src/pages/Notifications/Notifications.jsx` | Liste des notifications avec marquage comme lu/tout marquer lu, redirection vers la page métier. | Configurer les nouveaux types de notifications. |
| `src/pages/OperationsAValider/OperationsAValider.jsx` | Flow opérations à valider (admin). | Modifier les règles de validation, ajouter de nouveaux statuts. |
| `src/pages/MesProduits/MesProduits.jsx` | Mes produits. | Ajouter de nouvelles actions sur les produits. |
| `src/pages/MesTransactions/MesTransactions.jsx` | Mes transactions. | Modifier l'affichage des tableaux, ajouter de nouveaux filtres. |
| `src/pages/Dashboard/Dashboard.jsx` | Tableau de bord. | Voir section 10.1. |
| `src/pages/MonCompte/MonCompte.jsx` | Page compte utilisateur. | Ajouter de nouvelles sections, modifier le profile. |
| `src/pages/MonCompte/Audit.jsx` | Page audit. | Modifier l'affichage des données audit. |
| `src/pages/Actifs/Actifs.jsx` | Page Actifs. | Modifier le type de tableau, ajouter des filtres. |
| `src/pages/Passifs/Passifs.jsx` | Page Passifs. | Modifier le type de tableau, ajouter des filtres. |
| `src/pages/Depot/Depot.jsx` | Page Depot. | Modifier le type de tableau, ajouter des champs. |
| `src/pages/Retrait/Retrait.jsx` | Page Retrait. | Modifier le type de tableau, ajouter des champs. |
| `src/pages/AchatVente/AchatVente.jsx` | Page Achat/Vente. | Modifier l'affichage, ajouter des filtres. |
| `src/pages/AppelOffre/AppelOffre.jsx` | Page Appel d'offres. | Modifier le type de tableau (table HTML native). |
| `src/pages/Parrainages/Parrainages.jsx` | Page Parrainages. | Modifier l'affichage, ajouter des filtres. |
| `src/pages/EchangeActifs/EchangeActifs.jsx` | Page Échange d'actifs. | Modifier l'affichage CSS (hidden lg:block). |
| `src/pages/Panier/Panier.jsx` | Page Panier. | Modifier le composant CartContext, ajuster l'interface. |
| `src/pages/Administration/AdminUsers.jsx` | Administration - Utilisateurs. | Modifier les champs affichables, ajouter des actions. |
| `src/pages/Administration/AdminProducts.jsx` | Administration - Produits. | Ajouter de nouvelles actions CRUD sur produits. |
| `src/pages/Administration/AdminCpc.jsx` | Administration - CPC. | Modifier l'affichage, ajouter des filtres. |
| `src/pages/Administration/ExportHub.jsx` | Centre d'Export. | Configurer les options d'export, modifier le format. |
| `src/pages/MonCompte/Audit.jsx` | Audit. | Voir above. |
| `src/pages/OperationsAValider/OperationsAValider.jsx` | Opérations à valider. | Voir above. |
| `src/pages/MesSites/MesSites.jsx` | Mes sites. | Modifier l'affichage, ajouter des filtres. |
| `src/pages/Boutique/Boutique.jsx` | Boutique. | Voir above. |

---

## 5. Gestion d'État (Contextes)

### 5.1 AuthContext

- **Provider** : `AuthProvider` – initialise la session via `refreshToken` cookie à mounting.
- **Valeurs** : `user`, `isAuthenticated`, `loading`, `error`, `login(email, password)`, `logout()`, `getProfile`.
- **Décodage JWT** : `decodeJWT(token)` – parse le payload sans vérification de signature.
- **Refresh Token** : Stocké en cookie `refreshToken` (7 jours), rafraîchi automatiquement via intercepteur axios si 401.

**Modifications possibles** :
- Ajouter de nouvelles méthodes d'authentification.
- Modifier le mécanisme de persistance du token.
- Ajuster le décodage selon le format du JWT utilisé par le backend.

### 5.2 CartContext

- **État** : `items` (tableau d'articles), `loading`.
- **Actions** : `addToCart(shopItemId, quantite)`, `removeFromCart(itemId)`, `updateQuantity(itemId, quantity)`, `clearCart()`, `checkout(data)`.
- **Sélectionneurs** : `getTotalItems()`, `getTotalPrice()`.
- **Rafraîchissement** : `refreshCart()` appelée quand l'utilisateur est connecté et `userValidated !== false`.

**Modifications possibles** :
- Étendre les actions disponibles (nouvelle type d'article, etc.).
- Modifier la logique de raffraîchissement du panier.
- Ajouter de nouveaux sélecteurs selon les besoins.

### 5.3 NotificationsContext

- **Source unique** : `useNotifications` hook (socket + historique).
- **Provider** : `NotificationsProvider` – doit être monté dans le `Router` (via `Layout`).
- **Actions** : `markAsRead(id)`, `markAllRead()`, `clear()`, `openNotification(notif)` → navigate vers la page métier.

**Modifications possibles** :
- Configurer la souscription socket selon l'environnement de déploiement.
- Ajuster la logique de marquage comme lu.
- Modifier le mapping vers les pages cibles.

---

## 6. Routing et Navigation

### 6.1 Définition des Routes (`src/routes/routes.js`)

Toutes les routes sont définies ici avec :
- `path` : URL chemin
- `element` : composant de page
- `role` : rôles autorisés (ex: `'Utilisateur,Admin'`, `'Admin'`)
- `userValidated` : `true`/`false`/tableau (nécessite validation email)
- `icon` : icône MUI
- `label` : libellé affichage

### 6.2 Routes Publiques

| Path | Element | Remarques |
|------|---------|-----------|
| `/login` | Login | |
| `/register` | Register | |
| `/forgot-password` | ForgotPassword | |
| `/reset-password` | ResetPassword | |

### 6.3 Routes Privées

Exemple :

```js
{ path: '/dashboard', element: DashboardPage, role: 'Utilisateur,Admin', userValidated: [true, false], icon: Dashboard, label: 'Tableau de bord' }
```

### 6.3 `ProtectedRoute` (AppRoutes.jsx)

- Vérifie `loading` → renvoie `null` pendant chargement
- Vérifie `!user` → redirige vers `/login`
- Vérifie `allowedRoles` → si rôle utilisateur non autorisé → redirige vers `/dashboard`
- Utilise `useAuth` pour accéder à `user.userAccess`

### 6.4 Navigation dans les Composants

- `useNavigate()` de `react-router-dom` pour les redirections.
- `Link` de `react-router-dom` pour les liens de navigation.
- Badge de notification dans Header/Sidebar via `unreadByRoute` computed from `useNotifications`.

**Modifications possibles** :
- Ajouter de nouvelles routes protégées.
- Modifier la logique de redirection selon les rôles.
- Ajouter de nouvelles métadonnées de route.

---

## 7. Services API

### 7.1 Configuration Axios (`src/services/axios.config.js`)

- `baseURL` : `import.meta.env.VITE_API_BASE_URL`
- `withCredentials: true` – cookies envoyés automatiquement
- **Intercepteur Request** : Injecte `Authorization: Bearer <token>` si token présent.
- **Intercepteur Response** :
  - 401 pendant bootstrap → pas de redirection
  - 401 après bootstrap → tentative `refreshToken` automatique via `/auth/refresh`
  - Queue de promesses pour gérer multiples requêtes 401
  - Échec du refresh → redirection `/login`

### 7.2 Pattern d'Appel API

```js
import axiosInstance from './services/axios.config';

// Exemple simple
const res = await axiosInstance.get('/api/v1/products', { params: { page, limit } });

// Exemple avec token explicite (optionnel, la config l'injecte déjà)
await axiosInstance.post('/api/v1/cart/add', { shopItemId, quantite }, {
  headers: { Authorization: `Bearer ${token}` }
});
```

### 7.3 Services Par Catégorie

#### Auth

- `loginUser(email, password)` → stocke `accessToken` + `refreshToken` cookie
- `refreshToken()` → rafraîchit depuis cookie, renvoie nouveau `accessToken`
- `logoutUser()` → appelle backend `/auth/logout`, clear cookies
- `getProfile()` → `GET /api/v1/auth/profile`
- `changePassword(data, accessToken)` → `POST /auth/change-password`
- `forgotPassword(payload)` → `POST /auth/forgot-password`
- `resetPassword(payload)` → `POST /auth/reset-password`

**Modifications possibles** :
- Ajouter de nouvelles méthodes d'auth.
- Modifier les endpoints selon l'API backend.
- Ajouter de nouveaux paramètres de requête.

#### Produit

- `getProducts(params)` / `getMyProducts(params, token)` / `getShopProducts(params)`
- `createProduct(productData, image, token)` → `multipart/form-data`
- `updateProduct(id, productData, image, token)` → `PATCH`
- `deleteProduct(id, token)` → `DELETE`
- `toggleProductValidation(id, token)` / `toggleProductStocker(id, token)`

**Modifications possibles** :
- Ajouter de nouvelles opérations produit.
- Modifier les schémas de données attendus.
- Ajouter de nouveaux champs au formulaire de création/modification.

#### Panier / Commande

- `getCart(token)` → renvoie `{ data: { data: { items: [...] } } }`
- `addToCart(shopItemId, quantite, token)`
- `removeCartItem(id, token)`
- `updateCartItem(id, data, token)`
- `clearCart(token)` / `checkoutCart(data, token)`

**Modifications possibles** :
- Étendre les opérations panier.
- Modifier les schémas de données de checkout.
- Ajouter de nouvelles validations côté frontend.

#### Socket / Notifications

Voir section 11 ci-dessous.

#### Tableau de Bord

- `getStatsDashboard()` → renvoie stats globales (actifs, passifs, charts, etc.)

**Modifications possibles** :
- Ajouter de nouvelles statistiques.
- Modifier le shape des données retournées.
- Ajouter de nouveaux graphiques.

---

## 8. Hooks Personnalisés

| Hook | Dépendances | Description |
|------|-------------|-------------|
| `useNotifications` | `useNavigate`, `useState`, `useEffect`, `useRef`, `useCallback` + services + utils | Hook principal pour notifications temps réel. Gère la souscription socket, l'historique REST, le marquage comme lu, le ciblage vers les bonnes pages via `resolveNotificationTarget`. |
| `useCart` | Contexte `CartContext` | Voir section 5.2. |
| `useAuth` | Contexte `AuthContext` | Voir section 5.1. |
| `usePageTitle` | `useEffect` | Met à jour `document.title` depuis le composant page. |
| `useScreenType` | `useState`, `useEffect`, `window.addEventListener('resize')` | Détecte `mobile`/`desktop` breakpoint (1024px). |
| `useExport` | – | Utilitaire d'exportation de données (à compléter selon besoins). |

**Modifications possibles** :
- `useNotifications` : Configurer les nouveaux événements socket, ajuster la logique de redirection.
- `useScreenType` : Modifier les breakpoints si ils diffèrent des valeurs par défaut (768/1024).
- `useExport` : Implémenter selon les besoins d'export spécifiques au projet.

---

## 9. Composants UI

### 9.1 Primitives (`src/components/ui/`)

| Composant | Utilisation |
|-----------|-------------|
| `button.jsx` | Boutons MUI personnalisés avec variantes primary, secondary, success, danger, default, outline, ghost, taille sm/md/lg, état loading. |
| `input.jsx` | Champs input texte/email/number avec masque optionnel. |
| `select.jsx` | Select MUI avec Searchable, disabled, multiples. |
| `card.jsx` | Card avec header/content/footer. |
| `table.jsx` | Table composante avec Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableFooter, TableCaption. |
| `badge.jsx` | Badges variant/secondary/info/warning/error. |
| `tooltip.jsx` | Tool-tips avec délai et placement. |
| `dialog.jsx` | Dialog MUI avec header/content/footer et actions. |
| `drawer.jsx` | Drawer slide-in pour menus secondaires. |
| `sonner.jsx` | Intégration du toast sonner (remplacement de react-toastify). |
| `avatar.jsx` | Avatars utilisateur (image initiale ou initiale). |
| `loader.jsx` | Loader animé avec message optionnel. |
| `progress.jsx` | Barre de progression. |
| `toggle.jsx` | Toggle simple. |
| `radio-group.jsx` | Groupe de radios. |
| `checkbox.jsx` | Checkbox simple. |
| `collapsible.jsx` | Composant collapsible. |
| `accordion.jsx` | Accordion. |
| `carousel.jsx` | Carousel. |
| `calendar.jsx` | Calendar. |
| `pagination.jsx` | Pagination réutilisable. |
| `separator.jsx` | Séparateur visuel. |
| `sidebar.jsx` | Sidebar utilitaire. |
| `toggle-group.jsx` | Groupe de toggles. |
| `tooltip.jsx` | Outil de tool-tip (redondant avec above, à vérifier). |
| `progress.jsx` | Barre de progression. |
| `resizable.jsx` | Composant résizable. |
| `grid.jsx` | Composant grille. |
| `aspect-ratio.jsx` | Gestion du ratio d'aspect. |
| `skeleton.jsx` | Skeleton loading. |
| `calendar.jsx` | Composant calendar. |
| `menu-bar.jsx` | Menubar. |
| `dropdown-menu.jsx` | Menu déroulant. |
| `context-menu.jsx` | Menu contextuel. |
| `popover.jsx` | Popover. |
| `calendar.jsx` | Calendar (redondant, à vérifier). |
| `use-mobile.js` | Hook utilitaire pour la détection mobile. |
| `utils.js` | Utilitaire `cn` pour la composition de classes Tailwind. |

**Modifications possibles** :
- Ajouter de nouveaux composants selon les besoins d'interface.
- Modifier les styles par défaut des composants existants.
- Étendre les props acceptés par chaque composant.

### 9.2 Composants de Layout (`src/components/Layout/`)

- `Header` : Barre supérieure avec logo, notification bell, panier, menu mobile/desktop, avatar user, bouton déconnexion.
- `Sidebar` : Menu de navigation vertical avec groupes Navigation/Compte/Administration (conditionnel selon rôle).
- `Footer` : Pied de page avec copyright.
- `Layout` : Wrapper principal applique Header + Sidebar + Content + Footer selon taille d'écran.

**Modifications possibles** :
- Modifier la structure de layout globale.
- Ajouter de nouveaux éléments d'interface dans Header/Sidebar.
- Ajuster la visibilité selon les rôles utilisateur.

### 9.3 Composants Communs (`src/components/commons/`)

- `authLayout.jsx` : Structure wrapper pour pages d'authentification (login/register/forgot/password-reset) sans header/footer.
- `CartSheet` : Feuilleté panier (mobile).
- `ImageWithFallback` : Image avec fallback par défaut si pas d'image.
- `UserNotValidatedBanner` : Avertissement si `userValidated === false`.
- `PaginationControls` : Composant pagination réutilisable.
- `UserAutocomplete` : Sélecteur d'utilisateur avec recherche.
- `ExportButton` / `ExportDialog` : Bouton/fenêtre d'export CSV/Excel.

**Modifications possibles** :
- Personnaliser les labels et le comportement de chaque composant.
- Ajouter de nouvelles options de filtrage ou de tri.
- Modifier les styles selon la charte graphique.

### 9.4 Composants de Tableau

- Voir section 4.1 pour le mapping pages ↔ types de tableaux.
- `<Table>` = composant `components/ui/table.jsx`
- `<table>` = balise HTML native (utilisée dans `AppelOffre/AppelOffre.jsx`)

**Modifications possibles** :
- Ajouter de nouvelles colonnes aux tableaux existants.
- Modifier le type de tableau (composant vs HTML natif).
- Ajuster le fallback mobile selon les besoins.

---

## 10. Tableau de Bord et Pages

### 10.1 Tableau de bord (`src/pages/Dashboard/Dashboard.jsx`)

- Affiche des cartes statistiques (actifs, passifs, retraits, dépôts).
- 6 graphiques Recharts empilés :
  - Actifs par Site
  - Passifs par Site
  - Actifs par Produit
  - Passifs par Produit
  - Transactions par Mois (bascule Nombre / Quantité)
  - Transactions par Semaine
- Métriques supplémentaires en dessous (stocks produits, nombre de sites, produits par site, etc.)
- Layout en grille responsive (1 colonne mobile → 4 colonnes desktop pour les stats, 2 colonnes pour les charts).

**Modifications possibles** :
- Ajouter de nouvelles cartes statistiques.
- Modifier les graphiques Recharts existants.
- Ajouter de nouveaux métriques en dessous des charts.
- Adapter le layout selon les nouvelles nécessités.

### 10.2 Pages Clés

- **Boutique** (`Boutique.jsx`) : Produits à vendre avec filtrage fournisseur, recherche, tri, pagination, panier, checkout avec sélection de site de livraison et observations.
- **Virement de droit** (`VirementDroit`) : Voir documentation `docs/FRONTEND_VIREMENT_DROIT.md` pour l'endpoint et règles métier.
- **Notifications** (`Notifications.jsx`) : Liste des notifications avec marquage comme lu/tout marquer lu, redirection vers la page métier concernée.
- **Opérations à valider** (`OperationsAValider.jsx`) : Flow admin de validation des opérations en attente.
- **Panier** : Voir composant `CartContext` + Header/Sidebar cart badge.

**Modifications possibles** :
- Pour chaque page : ajouter de nouveaux composants, modifier le flux utilisateur, adapter les styles.
- Vérifier la cohérence avec les services API correspondants.

---

## 11. Notifications WebSocket

### 11.1 Connexion

```js
import { io } from 'socket.io-client';
const socket = io('https://api.commercegestion.online', {
  query: {
    userId: '69b3ba868559353c9a3967f9', // ObjectId utilisateur
    userAccess: 'USER' // 'USER' | 'ADMIN' | 'SUPERADMIN'
  },
  transports: ['websocket', 'polling']
});
```

### 11.2 Rooms Automatiques

- `user_{userId}` : Room privée pour notifications personnelles.
- `admin_room` : Room partagée pour les admins (alertes système).

### 11.3 Événements du Serveur

| Événement | Description |
|-----------|-------------|
| `notification` | Émis pour créations/approbations/rejets de transactions (USER). |
| `admin_event` | Émis pour alertes système (NEW_USER, ERREUR CRITIQUE, etc.) – admins uniquement. |

### 11.4 Payload `notification`

```typescript
{
  _id: ObjectId,
  userId: string,
  title: string,        // ex: "Nouveau Dépôt"
  message: string,      // détail lisible
  isRead: false,
  createdAt: Date,
  // metadata optionnelle
}
```

### 11.5 Intégration Frontend (Hook `useNotifications`)

Voir le code complet dans `src/hooks/useNotifications.js`. Points clés :

- Souscription avec `ensureSocket(profile)` qui mapppe le rôle frontend vers les rôles backend.
- Écoute `notification` → toast + push dans l'état local.
- Écoute `admin_event` (si admin) → warning toast.
- `resolveNotificationTarget(notif)` → détermine la page de redirection depuis le titre/metadata.
- `openNotification(notif)` → marque comme lu + navigue vers la page cible.
- Historique REST : `GET /api/v1/notifications?page=1&limit=20`.
- Marquage comme lu : `PATCH /api/v1/notifications/:id/read` / `PATCH /api/v1/notifications/read-all`.

**Modifications possibles** :
- Configurer l'URL socket selon l'environnement de déploiement.
- Ajouter de nouveaux événements serveur.
- Modifier la logique de mapping titre → page selon les nouveaux types de notifications.

### 11.6 Déploiement Socket.io

- CORS configuré avec `origin: '*'` (à restreindre en production).
- Fonctionne derrière reverse proxy nginx avec `proxy_http_version 1.1` + headers `upgrade`/`connection`.
- Pas de Redis requis pour une seule instance ; pour scaling horizontal, ajouter `@nestjs/platform-socket.io` avec adapter Redis.

**Modifications possibles** :
- Restreindre le CORS aux domaines autorisés en production.
- Configurer nginx correctement pour le support WebSocket.
- Prévoir un système de persistance avec Redis pour le scaling horizontal.

---

## 12. Variables d'Environnement

Créer un fichier `.env` à la racine (ou `.env.example` existe déjà).

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Base URL de l'API backend (ex: `https://api.commercegestion.online`) | `https://api.example.com` |
| `VITE_SOCKET_URL` | URL du serveur Socket.io (optionnel, par défaut `VITE_API_BASE_URL`) | `https://realtime.example.com` |
| `VITE_GOOGLE_MAPS_KEY` | Clé Google Maps (si utilisée) | `YOUR_KEY_HERE` |
| `VITE_PORT` | Port du serveur Vite (défaut non défini, utilise par défaut 5173) | `5173` |

**Important** : Vite expose uniquement les variables commençant par `VITE_` via `import.meta.env`. Les variables non préfixées ne sont pas accessibles côté client.

### Voir aussi `docs/development.md` pour plus de détails.

---

## 13. Scripts et Commandes

| Commande | Effet |
|----------|-------|
| `npm install` | Installe toutes les dépendances définies dans `package.json`. |
| `npm run dev` | Lance Vite en mode développement avec HMR. L'app est disponible sur `http://localhost:5173` (ou port personnalisé via `VITE_PORT`). |
| `npm run build` | Génère le build production minifié dans `dist/`. |
| `npm run preview` | Lance le serveur de preview du build (`dist/`) pour tester en local avant déploiement. |
| `npm run lint` | Exécute ESLint sur tout le codebase. Recommandé de lancer avant chaque commit/MR. |

### Commandes utiles fréquemment

```bash
# Développement
npm run dev

# Build production
npm run build

# Prévisualisation du build
npm run preview

# Lint seulement
npm run lint
```

---

## 14. Style et Tailwind CSS

- **Framework** : Tailwind CSS v4.
- **Configuration** : `tailwind.config.js` (non lu directement mais présent) + `vite.config.js` inclut `@tailwindcss/vite`.
- **Classnames** : Utilisation de la syntaxe `className="..."` avec des classes Tailwind.
- **Couleurs** : Palette personnalisée avec teintes violette (`violet-50`, `violet-600`, etc.), neutre (`neutral-900`, `neutral-100`), rouge (`red-600`, `red-700`), bleu (`blue-600`), vert (`emerald-600`).
- **Responsive** : Prefixés `sm`/`md`/`lg`/`xl` pour les breakpoints.
- **Composition** : Utilisation de `clsx` et `tailwind-merge` pour la composition conditionnelle de classes (ex: `className={cn("base-class", condition && "override-class")}`).
- **Fichier utilitaire** : `src/components/ui/utils.js` exporte `cn` utilitaire.

### Points de personnalisation fréquents

- Ajouter de nouvelles couleurs dans `tailwind.config.js` si nécessaire.
- Personnaliser les breakpoints si besoin diffèrent de 768/1024/1280.

**Modifications possibles** :
- Étendre la palette de couleurs.
- Modifier les breakpoints selon les besoins de responsive design.
- Ajouter de nouvelles configurations de composants Tailwind.

---

## 15. Linting et Quality

- **ESLint** : Configuré dans `eslint.config.js` (flat config).
- **Plugins** : `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`.
- **Règles notables** :
  - `no-unused-vars` :Ignore les vars commençant par `_` ou des majuscules (pattern `^([A-Z_]|set[A-Z])`).
  - `react-hooks/exhaustive-deps` : Désactivé (`off`) – penser à ajouter les dépendances correctement.
  - `react-refresh/only-export-components` : Désactivé.
  - `react-hooks/set-state-in-effect` / `purity` : Désactivés.

### Bonnes pratiques

- Toujours lancer `npm run lint` avant de soumettre une MR.
- Utiliser les composants `components/ui` plutôt que du HTML directement quand possible.
- Garder les composants UI agnostiques (pas de logique métier dedans).
- Placer la logique d'appel API dans `services/`.
- Utiliser les contexts (`AuthContext`, `CartContext`) pour l'état global partagé.
- Les hooks personnalisés commencent par `use` (convention React).

**Modifications possibles** :
- Ajuster les règles ESLint selon les conventions de l'équipe.
- Ajouter de nouvelles règles de linting selon les besoins du projet.

---

## 16. Contribution

### Workflow Recommandé

1. **Fork** et créer une branche dédiée :
   ```bash
   git checkout -b feat/ma-fonctionnalite
   ```

2. **Respecter les conventions de code** :
   - Utiliser les composants réutilisables de `src/components/ui/`.
   - Rédiger des commits clairs et atomiques.
   - Lancer `npm run lint` avant soumission.

3. **Tests & Revue** :
   - Ajouter des tests unitaires ou d'intégration si applicable.
   - Ouvrir une Merge Request avec description claire et captures d'écran si nécessaire.

4. **Workflow** :
   - Les PRs doivent être revues par au moins un mainteneur.
   - Documenter les changements majeurs dans la MR (breaking changes, migrations).

### Contact

- Ouvrir une issue pour discuter d'une grosse fonctionnalité avant de commencer.
- Voir `docs/contributing.md` pour le guide existant.

**Modifications possibles** :
- Adapter le workflow selon les pratiques de l'équipe.
- Ajouter de nouvelles étapes de revue selon les besoins.

---

## 17. Déploiement

### Build Production

```bash
npm run build
```

Cela génère les fichiers dans `dist/`.

### Hébergement Statique

L'application est prête pour tout hébergeur statique :
- **Vercel** : `vercel deploy` ou connexion repos Git.
- **Netlify** : drag-and-drop du dossier `dist/` ou configuration CI.
- **Cloudflare Pages** : similaire.
- **NGINX** : servir les fichiers de `dist/` avec configuration de rewrite pour le client-side routing (React Router).

**Modifications possibles** :
- Configurer le serveur d'hébergement selon les besoins spécifiques.
- Ajuster la configuration NGINX pour les cas d'usage particuliers.

### Socket.io en Production

- Restreindre CORS `origin` aux domaines autorisés.
- Configurer nginx avec `proxy_http_version 1.1` et les headers :
  ```
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  ```
- Pour scaling horizontal, penser à ajouter un système de gestion de rooms avec Redis (voir section 11.6).

**Modifications possibles** :
- Personnaliser la configuration de déploiement selon l'environnement.
- Prévoir les adaptations nécessaires pour le scaling horizontal.

---

## 18. Fonctionnaliter – Fichiers et Modifications Recommandées

Ce section fournit un récapitulatif des fichiers du projet avec des indications sur les types de modifications fréquemment nécessaires. Les développeurs doivent adapter ces indications en fonction de leurs tâches spécifiques.

| Fichier | Type de modifications courantes |
|---------|--------------------------------|
| `src/context/AuthContext.jsx` | Ajout de méthodes d'auth, modification du token handling, ajustement du décodage JWT |
| `src/context/CartContext.jsx` | Extension des actions panier, modification du raffraîchissement, nouveaux sélecteurs |
| `src/context/NotificationsContext.jsx` | Configuration socket selon environnement, ajustement du mapping vers pages |
| `src/services/axios.config.js` | Nouveaux intercepteurs, modification comportement 401, ajustement de la queue |
| `src/services/token.service.js` | Changement nom cookie, ajout options sécurité, modification fonctions get/set |
| `src/services/auth.service.js` | Nouvelles méthodes d'auth, modification endpoints, nouveaux paramètres |
| `src/services/socket.service.js` | Configuration URL socket, nouveaux événements, mappage rôles mis à jour |
| `src/services/cart.service.js` | Étendre opérations panier, modification endpoints, nouveaux schémas données |
| `src/services/product.service.js` | Nouvelles opérations produit, modification schémas données, nouveaux champs formulaire |
| `src/services/shop-available.service.js` | Étendre filtres recherche, modification paramètres pagination |
| `src/services/site.service.js` | Nouvelles méthodes gestion sites, modification endpoints existants |
| `src/services/dash.service.js` | Nouvelles statistiques, modification shape données, nouveaux graphiques |
| `src/services/media.service.js` | Modification base URL médias, ajout validations, nouveaux formats |
| `src/services/notifications.service.js` | Nouvelles méthodes lecture notifications, modification endpoints existants |
| `src/hooks/useNotifications.js` | Configurer nouveaux événements socket, ajuster logique redirection |
| `src/hooks/usePageTitle.jsx` | Extension pour métadonnées SEO, modification comportement |
| `src/hooks/useScreenType.js` | Modifier breakpoints (768/1024 selon besoins réels) |
| `src/utils/formatNumber.js` | Modifier séparateur par défaut, ajouter options formatage |
| `src/utils/notificationTarget.js` | Ajouter nouvelles correspondances titre→page, modifier logique fallback |
| `src/utils/externalDomMutationGuard.js` | Ajuster logique détection mutations DOM |
| `src/utils/inputMasks.js` | Ajouter nouveaux masques, modifier existants |
| `src/routes/routes.js` | Ajouter nouvelles routes, modifier rôles par défaut, nouveaux métadonnées |
| `src/routes/AppRoutes.jsx` | Modifier logique protection routes, ajuster ProtectedRoute |
| `src/pages/` | Créer nouvelles pages, modifier import composants selon besoins |
| `src/components/Layout/Layout.jsx` | Modifier structure layout, ajuster visibilité selon roles |
| `src/components/Layout/Header.jsx` | Ajouter éléments interface, modifier navigation, nouveaux badges |
| `src/components/Layout/Sidebar.jsx` | Ajouter items navigation, modifier visibilité par rôle |
| `src/components/Layout/Footer.jsx` | Mettre à jour copyright, ajouter liens, modifier style |
| `src/components/Layout/Content.jsx` | Personnaliser structure contenu |
| `src/components/ui/button.jsx` | Nouvelles variantes, modifier styles par défaut, nouvelle props |
| `src/components/ui/input.jsx` | Nouveaux types entrée, modifier masques, nouvelle props |
| `src/components/ui/select.jsx` | Nouvelles options, modifier comportement, nouvelle props |
| `src/components/ui/card.jsx` | Personnaliser style, ajouter variantes, nouvelle props |
| `src/components/ui/table.jsx` | Nouvelles colonnes, modifier style, nouveau type tableau |
| `src/components/ui/badge.jsx` | Nouvelles variantes, modifier styles, nouvelle props |
| `src/components/ui/tooltip.jsx` | Ajuster délai,modifier placements, nouvelle props |
| `src/components/ui/dialog.jsx` | Nouvelles actions, modifier taille, nouvelle props |
| `src/components/ui/drawer.jsx` | Modifier direction ouverture, ajuster largeur, nouvelle props |
| `src/components/ui/sonner.jsx` | Modifier options par défaut du toast |
| `src/components/ui/avatar.jsx` | Styles personnalisés, modifier fallback |
| `src/components/ui/loader.jsx` | Modifier animation, ajouter messages par défaut |
| `src/components/ui/progress.jsx` | Personnaliser style, ajouter variantes |
| `src/components/ui/toggle.jsx` | Personnaliser apparence |
| `src/components/ui/radio-group.jsx` | Ajouter nouvelles options |
| `src/components/ui/checkbox.jsx` | Personnaliser apparence |
| `src/components/ui/collapsible.jsx` | Ajuster comportement ouverture/fermeture |
| `src/components/ui/accordion.jsx` | Personnaliser styles items |
| `src/components/ui/carousel.jsx` | Ajouter nouvelles slides, modifier style |
| `src/components/ui/calendar.jsx` | Ajouter nouvelles vues, modifier comportement |
| `src/components/ui/popover.jsx` | Personnaliser placement, ajuster style |
| `src/components/ui/menubar.jsx` | Ajouter items, modifier style |
| `src/components/ui/dropdown-menu.jsx` | Ajouter items menu, modifier style |
| `src/components/ui/context-menu.jsx` | Ajouter items contexte, modifier style |
| `src/components/ui/aspect-ratio.jsx` | Modifier ratio par défaut |
| `src/components/ui/skeleton.jsx` | Personnaliser apparence |
| `src/components/ui/resizable.jsx` | Ajuster zones redimensionnables |
| `src/components/ui/utils.js` | Modifier fonction cn si besoin |
| `src/components/commons/authLayout.jsx` | Personnaliser structure pages d'auth |
| `src/components/commons/CartSheet.jsx` | Ajouter nouvelles options affichage |
| `src/components/commons/ImageWithFallback.jsx` | Modifier image par défaut, ajouter styles |
| `src/components/commons/UserNotValidatedBanner.jsx` | Modifier message, ajuster style |
| `src/components/commons/PaginationControls.jsx` | Changer nombre éléments/page, modifier style |
| `src/components/commons/UserAutocomplete.jsx` | Ajuster logique recherche, modifier affichage |
| `src/components/commons/ExportButton.jsx` | Personnaliser label, modifier format export |
| `src/components/commons/ExportDialog.jsx` | Ajouter options filtrage, modifier format |
| `src/components/commons/ActifsTable.jsx` | Ajuster colonnes, modifier style |
| `src/pages/Dashboard/Dashboard.jsx` | Ajouter nouvelles cartes/métriques, modifier graphiques, adapter layout |
| `src/pages/Boutique/Boutique.jsx` | Ajouter nouveaux filtres, modifier flow checkout, nouvelles props |
| `src/pages/VirementDroit/VirementDroit.jsx` | Adapter selon règles métier (voir docs/FRONTEND_VIREMENT_DROIT.md) |
| `src/pages/Notifications/Notifications.jsx` | Configurer nouveaux types notifications, modifier redirection |
| `src/pages/OperationsAValider/OperationsAValider.jsx` | Modifier règles validation, ajouter nouveaux statuts |
| `src/pages/MesProduits/MesProduits.jsx` | Nouvelles actions sur produits, modifier affichage |
| `src/pages/MesTransactions/MesTransactions.jsx` | Modifier affichage tableaux, ajouter nouveaux filtres |
| `src/pages/MonCompte/MonCompte.jsx` | Ajouter nouvelles sections, modifier profile |
| `src/pages/MonCompte/Audit.jsx` | Modifier affichage données audit |
| `src/pages/Actifs/Actifs.jsx` | Modifier type tableau, ajouter filtres |
| `src/pages/Passifs/Passifs.jsx` | Modifier type tableau, ajouter filtres |
| `src/pages/Depot/Depot.jsx` | Modifier type tableau, ajouter champs |
| `src/pages/Retrait/Retrait.jsx` | Modifier type tableau, ajouter champs |
| `src/pages/AchatVente/AchatVente.jsx` | Modifier affichage, ajouter filtres |
| `src/pages/AppelOffre/AppelOffre.jsx` | Modifier type tableau (HTML native), ajouter champs |
| `src/pages/Parrainages/Parrainages.jsx` | Modifier affichage, ajouter filtres |
| `src/pages/EchangeActifs/EchangeActifs.jsx` | Modifier affichage CSS (hidden lg:block), ajuster |
| `src/pages/Panier/Panier.jsx` | Modifier composant CartContext, ajuster interface |
| `src/pages/Administration/AdminUsers.jsx` | Modifier champs affichables, ajouter actions |
| `src/pages/Administration/AdminProducts.jsx` | Nouvelles actions CRUD produits |
| `src/pages/Administration/AdminCpc.jsx` | Modifier affichage, ajouter filtres |
| `src/pages/Administration/ExportHub.jsx` | Configurer options export, modifier format |
| `src/pages/Administration/ExportHub.jsx` | Voir above |

---

## 19. Prochaines Étapes pour le Nouveau Développeur

1. **Lire ce document** du début à la fin pour comprendre l'architecture globale.
2. **Cloner le dépôt** et lancer `npm install`.
3. **Configurer les variables d'environnement** dans `.env` en se basant sur `.env.example`.
4. **Lancer `npm run dev`** et explorer l'application localement.
5. **Ouvrir les docs internes** `docs/` pour des détails spécifiques (architecture, websockets, virement de droit, table de pages).
6. **Commencer par les tickets d'entrée** sur le tableau de bord ou les corrections de bugs signalés.
7. **Utiliser `npm run lint`** régulièrement pour maintenir la qualité du code.
8. **Rejoindre les PRs** et discussions sur GitHub pour la revue du code.

---

## 20. Liens Rapides

| Ressource | Chemin |
|-----------|--------|
| Documentation Rapide (README) | `README.md` |
| Architecture | `docs/architecture.md` |
| Développement Local | `docs/development.md` |
| Composants UI | `docs/components.md` |
| Services API | `docs/services.md` (concept couvert, non créé séparément) |
| Routes & Navigation | `docs/routes.md` |
| Scripts | `docs/commands.md` |
| Contribution | `docs/contributing.md` |
| Virement de Droit | `docs/FRONTEND_VIREMENT_DROIT.md` |
| Tableau de Pages | `docs/page_table.md` |
| WebSockets Notifications | `docs/WEBSOCKET_NOTIFICATIONS.md` |

---