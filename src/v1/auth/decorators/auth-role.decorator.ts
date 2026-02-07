import { UseGuards, applyDecorators } from '@nestjs/common';
import { JwtGuard } from '../guards/jwt.guard';
import { RoleGuard } from '../guards/role.guard';
import { ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UserAccess } from '../../users/users.schema';
import { Roles } from './roles.decorator';

/**
 * Décorateur composé pour protéger une route avec JWT + vérification de rôle
 * Combine @UseGuards(JwtGuard, RoleGuard), @Roles(), et @ApiBearerAuth() pour Swagger
 * 
 * @example
 * @Get('admin-only')
 * @AuthRole(UserType.ADMIN)
 * getAdminData(@Req() req) { ... }
 * 
 * @example
 * @Get('sellers-and-admins')
 * @AuthRole(UserType.SELLER, UserType.ADMIN)
 * getData(@Req() req) { ... }
 */
export function AuthRole(...roles: UserAccess[]) {
  return applyDecorators(
    Roles(...roles),
    UseGuards(JwtGuard, RoleGuard),
    ApiBearerAuth(),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Insufficient role permissions',
      schema: {
        example: {
          statusCode: 403,
          message: 'Forbidden: This resource requires one of the following roles: ADMIN. Your current role is: BUYER',
          error: 'Forbidden',
        },
      },
    }),
  );
}
