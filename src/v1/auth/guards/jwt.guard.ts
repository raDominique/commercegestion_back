import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  handleRequest(err, user, info, context) {
    // 1. Vérifier si l'utilisateur est authentifié (Token valide)
    if (err || !user) {
      throw err || new UnauthorizedException('Session expirée ou invalide');
    }

    const request = context.switchToHttp().getRequest();

    // 2. Logique userValidated : Bloquer les écritures (POST, PUT, etc.) si non validé
    // On ignore le GET pour permettre à l'utilisateur de voir son profil/statut
    if (user.userValidated === false && request.method !== 'GET') {
      throw new ForbiddenException(
        "Action interdite : Votre compte n'est pas encore validé.",
      );
    }

    return user;
  }
}
