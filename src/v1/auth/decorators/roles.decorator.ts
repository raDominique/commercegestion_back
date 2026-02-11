import { SetMetadata } from '@nestjs/common';
import { UserAccess } from '../../users/users.schema';

/**
 * Décorateur pour spécifier les rôles autorisés pour une route
 * Utilisé avec le RoleGuard
 *
 * @example
 * @Get('admin-only')
 * @Auth()
 * @Roles(UserType.ADMIN)
 * getAdminData() { ... }
 *
 * @example
 * @Get('sellers-and-admins')
 * @Auth()
 * @Roles(UserType.SELLER, UserType.ADMIN)
 * getData() { ... }
 */
export const Roles = (...roles: UserAccess[]) => SetMetadata('roles', roles);
