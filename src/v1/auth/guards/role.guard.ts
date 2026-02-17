import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserAccess } from '../../users/users.schema';

/**
 * Guard pour vérifier les rôles d'accès
 * À utiliser avec le décorateur @Roles()
 *
 * Ce guard doit être utilisé APRÈS le JwtGuard pour vérifier les rôles
 *
 * @example
 * @Get('admin-only')
 * @Auth()
 * @Roles(UserAccess.ADMIN)
 * @UseGuards(RoleGuard)
 * getAdminData() { ... }
 */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Récupérer les rôles spécifiés par le décorateur @Roles()
    const roles = this.reflector.get<UserAccess[]>('roles', context.getHandler());

    // Si aucun rôle n'est spécifié, laisser passer (la route n'a pas de restriction)
    if (!roles || roles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // Vérifier si le rôle de l'utilisateur est dans la liste des rôles autorisés
    const hasRole = roles.includes(user.userAccess);

    if (!hasRole) {
      throw new ForbiddenException(
        `Forbidden: This resource requires one of the following roles: ${roles.join(', ')}. Your current role is: ${user.userAccess}`,
      );
    }

    return true;
  }
}
