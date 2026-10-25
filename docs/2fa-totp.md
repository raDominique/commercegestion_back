# Authentification à deux facteurs (2FA) - TOTP (détaillé)

## Vue d'ensemble
La 2FA utilise le protocole TOTP (Time-based One-Time Password), compatible avec Google Authenticator, Microsoft Authenticator, Authy, etc.

## Endpoints backend

### 1. Activer la 2FA
- **POST** `/auth/2fa/enable` (authentifié)
- **Headers** : `Authorization: Bearer <accessToken>`
- **Réponse** :
```json
{
  "secret": "BASE32SECRET...",
  "qrCodeDataUrl": "data:image/png;base64,..."
}
```
- Le frontend affiche le QR code. L'utilisateur scanne avec son authenticator.

### 2. Vérifier et activer
- **POST** `/auth/2fa/verify` (authentifié)
- **Headers** : `Authorization: Bearer <accessToken>`
- **Body** : `{ "token": "123456" }`
- **Réponse** :
```json
{ "enabled": true }
```
- À appeler après que l'utilisateur a saisi le code généré par son authenticator.

### 3. Désactiver
- **POST** `/auth/2fa/disable` (authentifié)
- **Headers** : `Authorization: Bearer <accessToken>`
- **Body** : `{ "token": "123456" }`
- **Réponse** :
```json
{ "enabled": false }
```

### 4. Login avec 2FA
- **POST** `/auth/login`
- **Body** :
```json
{ "userEmail": "user@example.com", "userPassword": "password", "totpToken": "123456" }
```
- Si la 2FA est activée pour l'utilisateur, `totpToken` est requis. Sinon, connexion normale.
- (Note : la vérification TOTP lors du login doit être intégrée côté service selon votre implémentation.)

## Champs utilisateur (schéma MongoDB)
- `twoFactorSecret?: string` (select: false — ne jamais renvoyer au client)
- `twoFactorEnabled: boolean` (défaut `false`)
- `twoFactorBackupCodes?: string[]` (codes de secours hashés)

## Flux frontend détaillé

### Enrôlement
1. L'utilisateur va dans **Paramètres > Sécurité**.
2. Clique sur "Activer la 2FA".
3. Appel `POST /auth/2fa/enable`.
4. Afficher le QR code (`qrCodeDataUrl`) et le secret en texte (pour saisie manuelle).
5. L'utilisateur scanne le QR code avec son authenticator.
6. L'utilisateur saisit le code à 6 chiffres généré.
7. Appel `POST /auth/2fa/verify` avec le code.
8. Afficher les codes de secours (à stocker en lieu sûr).
9. Confirmer l'activation.

### Connexion
1. L'utilisateur saisit email + mot de passe.
2. Si 2FA activée, le backend renvoie une erreur indiquant que le code TOTP est requis.
3. Le frontend affiche un champ pour le code TOTP.
4. L'utilisateur saisit le code → renvoyer la requête avec `totpToken`.
5. Si valide, retour des tokens JWT.

### Désactivation
1. L'utilisateur saisit son code TOTP actuel.
2. Appel `POST /auth/2fa/disable`.
3. Confirmer la désactivation.

## Gestion des erreurs
- `400 Bad Request` : code TOTP invalide ou 2FA non initialisée.
- `401 Unauthorized` : token JWT invalide/expiré.

## Sécurité
- Le secret TOTP est stocké avec `select: false` pour ne jamais être exposé.
- Rate limiting recommandé sur `/auth/2fa/verify` et `/auth/login`.
- Les codes de secours doivent être hashés (comme les mots de passe).
- Utiliser HTTPS en production.

## Dépendances
- `otplib` : génération et vérification TOTP.
- `qrcode` : génération du QR code en data URL.

## Notes d'implémentation backend
- Les méthodes `enable2FA`, `verify2FA`, `disable2FA` sont dans `AuthService`.
- Les endpoints sont dans `AuthController` sous `/auth/2fa/*`.
- La vérification TOTP lors du login (`login` method) doit être adaptée pour exiger le `totpToken` si `twoFactorEnabled === true`.
- Ajouter un champ optionnel `totpToken` au `LoginDto`.
