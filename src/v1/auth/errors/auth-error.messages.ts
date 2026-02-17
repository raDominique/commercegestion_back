/**
 * Messages d'erreur d'authentification
 * Enum pour les différents cas d'exception lors du login
 */

export enum AuthErrorMessage {
  // Cas 1: Utilisateur inexistant ou mot de passe incorrect
  INVALID_CREDENTIALS = 'Identifiants invalides. Veuillez vérifier votre e-mail et votre mot de passe puis réessayer.',

  // Cas 2: Utilisateur non vérifié ET inactif
  ACCOUNT_NOT_VERIFIED = "Votre compte n'est pas vérifié. Veuillez vérifier votre e-mail pour activer votre compte.",

  // Cas 3: Utilisateur vérifié mais inactif
  ACCOUNT_INACTIVE = 'Compte inactif. Veuillez contacter le support pour activer votre compte.',

  // Cas 4: Erreurs de token
  INVALID_REFRESH_TOKEN = 'Jeton de rafraîchissement invalide ou expiré',
  INVALID_TOKEN = 'Jeton invalide',

  // Autres
  USER_NOT_FOUND = 'Utilisateur non trouvé',
}
