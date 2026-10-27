import { UseGuards, applyDecorators } from '@nestjs/common';
import { JwtGuard } from '../guards/jwt.guard';
import { TwoFactorGuard } from '../guards/two-factor.guard';
import { ApiBearerAuth } from '@nestjs/swagger';

export function AuthWith2FA() {
  return applyDecorators(UseGuards(JwtGuard, TwoFactorGuard), ApiBearerAuth());
}
