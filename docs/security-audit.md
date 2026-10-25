# Audit de sécurité — Backend commercegestion_back

## 1. Dépendances
- `npm audit` signale de nombreuses vulnérabilités (dont @nestjs/core injection via path-to-regexp, ajv ReDoS, @babel/core file read, faker code exec). 
- Recommandation : exécuter `npm audit fix` (sans --force d'abord), puis valider les tests.

## 2. Authentification & Autorisation
- Vérifier que toutes les routes sensibles sont protégées par `@Auth()` et les guards JWT.
- Vérifier la rotation/expiration des tokens de rafraîchissement.
- S'assurer que les rôles sont vérifiés côté serveur (role guard).

## 3. Validation des entrées
- Vérifier que les DTO utilisent `class-validator` et que le ValidationPipe global a `whitelist: true`, `forbidNonWhitelisted: true`.
- Risque : mass assignment si non activé.

## 4. Injection
- Requêtes MongoDB : vérifier qu'aucune entrée utilisateur n'est interpolée directement dans les filtres sans cast ObjectId.
- Vérifier l'absence d'`eval`, `exec`, `spawn` avec input utilisateur.

## 5. Secrets & Configuration
- `.env` ne doit pas être commité (vérifier .gitignore).
- JWT secrets doivent être forts et non par défaut.

## 6. CORS & Headers
- Configurer CORS restrictif (origins autorisées).
- Ajouter helmet (CSP, HSTS, etc.).

## 7. Upload de fichiers
- Valider type et taille ; stocker hors du web root ; éviter l'exécution.

## 8. Gestion des erreurs
- Éviter de renvoyer les stack traces en production.

## Priorités
1. Critique : dépendances @nestjs/core, injection.
2. Élevé : validation DTO, CORS.
3. Moyen : rate limiting, helmet.
4. Faible : audit logging.
