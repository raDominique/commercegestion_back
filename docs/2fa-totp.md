# Authentification à deux facteurs (2FA) - TOTP

## Endpoints (à implémenter côté backend)

### 1. Activer la 2FA
- **POST** `/auth/2fa/enable` (authentifié)
- **Réponse** : `{ secret, qrCodeDataUrl }`
- Le frontend affiche le QR code pour scanner avec Google/Microsoft Authenticator.

### 2. Vérifier et activer
- **POST** `/auth/2fa/verify` (authentifié)
- **Body** : `{ token: string }` (code TOTP 6 chiffres)
- **Réponse** : `{ enabled: true, backupCodes: string[] }`

### 3. Désactiver
- **POST** `/auth/2fa/disable` (authentifié)
- **Body** : `{ token: string }`

### 4. Login avec 2FA
- **POST** `/auth/login`
- **Body** : `{ email, password, totpToken? }`
- Si 2FA activée, `totpToken` est requis. Sinon, connexion normale.

## Champs utilisateur (schéma)
- `twoFactorSecret?: string`
- `twoFactorEnabled: boolean` (défaut false)
- `twoFactorBackupCodes?: string[]` (hashés)

## Flux frontend
1. L'utilisateur va dans les paramètres de sécurité.
2. Appelle `/auth/2fa/enable` → affiche le QR code.
3. L'utilisateur scanne avec son authenticator.
4. Saisit le code à 6 chiffres → `/auth/2fa/verify`.
5. Reçoit des codes de secours à stocker.
6. À la connexion, si 2FA activée, le formulaire demande le code TOTP.

## Notes
- Utiliser `otplib` pour la génération/vérification TOTP.
- Utiliser `qrcode` pour générer le QR code en data URL.
- Rate limiting recommandé sur la vérification.
