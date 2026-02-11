import { UseGuards, applyDecorators } from '@nestjs/common';
import { JwtGuard } from '../guards/jwt.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

/**
 * Décorateur composé pour protéger une route avec JWT
 * Combine @UseGuards(JwtGuard) et @ApiBearerAuth() pour Swagger
 *
 * Usage:
 * @Auth()
 * @Get('profile')
 * getProfile(@Req() req) { ... }
 */
export function Auth() {
  return applyDecorators(UseGuards(JwtGuard), ApiBearerAuth());
}
