import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedRequest } from '../interfaces/authenticated-user.interface';

@Injectable()
export class TwoFactorGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Partial<AuthenticatedRequest>>();
    const user = request.user;

    if (!user || !user.userId) {
      return true;
    }

    // Skip for 2FA related endpoints
    const route = request.route as { path?: string } | undefined;
    const path = route?.path || request.url || '';
    if (
      path.includes('/auth/2fa') ||
      path.includes('/auth/verify-token') ||
      path.includes('/auth/profile') ||
      path.includes('/auth/logout')
    ) {
      return true;
    }

    try {
      const userResult = await this.usersService.findOne(user.userId);
      const userDoc = userResult.data?.[0];
      if (userDoc && userDoc.twoFactorEnabled === false) {
        throw new ForbiddenException(
          'Authentification à deux facteurs requise. Veuillez activer le 2FA pour accéder à cette ressource.',
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
    }

    return true;
  }
}
