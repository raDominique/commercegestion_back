import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  handleRequest<TUser = AuthenticatedUser>(
    err: unknown,
    user: unknown,
    _info: unknown,
    context: ExecutionContext,
  ): TUser {
    // 1. Vérifier si l'utilisateur est authentifié (Token valide)
    if (err || !user) {
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Session expirée ou invalide');
    }

    const request = context.switchToHttp().getRequest<Request>();
    const authUser = user as AuthenticatedUser;

    // 2. Logique userValidated : Bloquer les écritures (POST, PUT, etc.) si non validé
    // On ignore le GET pour permettre à l'utilisateur de voir son profil/statut
    if (authUser.userValidated === false && request.method !== 'GET') {
      throw new ForbiddenException(
        "Action interdite : Votre compte n'est pas encore validé.",
      );
    }

    return user as TUser;
  }
}
