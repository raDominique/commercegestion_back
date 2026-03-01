import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserAccess } from 'src/v1/users/users.schema';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }

    // --- LOGIQUE DE VALIDATION DU COMPTE ---
    // Si l'utilisateur n'est pas validé, on bloque tout sauf les requêtes de lecture (GET)
    if (user.userValidated === false && request.method !== 'GET') {
      throw new ForbiddenException(
        "Votre compte n'est pas encore validé. Vous ne pouvez pas effectuer d'opérations d'écriture.",
      );
    }

    // --- LOGIQUE DES RÔLES ---
    const roles = this.reflector.get<UserAccess[]>(
      'roles',
      context.getHandler(),
    );

    // Si aucun rôle n'est spécifié via @Roles(), on laisse passer
    // (mais la restriction de validation ci-dessus s'applique toujours)
    if (!roles || roles.length === 0) {
      return true;
    }

    const hasRole = roles.includes(user.userAccess);

    if (!hasRole) {
      throw new ForbiddenException(
        `Accès refusé : rôle requis [${roles.join(', ')}]. Votre rôle : ${user.userAccess}`,
      );
    }

    return true;
  }
}
