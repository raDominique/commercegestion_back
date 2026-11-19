import type { Request } from 'express';
import type { UserAccess, UserType } from '../../users/users.schema';

/** Contenu signé dans les JWT (access, refresh et challenge 2FA). */
export interface JwtPayload {
  sub: string;
  userEmail?: string;
  /** Ancien nom du champ email, conservé pour les jetons déjà émis. */
  email?: string;
  userType?: UserType;
  userAccess?: UserAccess;
  userValidated?: boolean;
  userVerified?: boolean;
  userIdPartager?: string;
  /** Présent sur le challenge de connexion 2FA. */
  purpose?: string;
  rememberMe?: boolean;
  iat?: number;
  exp?: number;
}

/** Utilisateur attaché à `req.user` par les stratégies JWT. */
export interface AuthenticatedUser {
  userId: string;
  email?: string;
  userType?: UserType;
  userAccess?: UserAccess;
  userValidated?: boolean;
  userVerified?: boolean;
  userIdPartager?: string;
  /** Uniquement avec la stratégie `jwt-refresh`. */
  refreshToken?: string;
}

/** Requête Express après passage d'un guard JWT. */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/** Construit `req.user` à partir d'un payload JWT vérifié. */
export function toAuthenticatedUser(payload: JwtPayload): AuthenticatedUser {
  return {
    userId: payload.sub,
    email: payload.userEmail ?? payload.email,
    userType: payload.userType,
    userAccess: payload.userAccess,
    userValidated: payload.userValidated,
    userVerified: payload.userVerified,
    userIdPartager: payload.userIdPartager,
  };
}
