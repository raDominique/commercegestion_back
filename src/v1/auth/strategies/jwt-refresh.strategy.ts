import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import { JwtConfig } from '../config/jwt.config';
import {
  AuthenticatedUser,
  JwtPayload,
  toAuthenticatedUser,
} from '../interfaces/authenticated-user.interface';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(private readonly jwtConfig: JwtConfig) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.refreshSecret,
      passReqToCallback: true,
    });
  }

  validate(req: Request, payload: JwtPayload): AuthenticatedUser {
    const body = req.body as { refreshToken?: string } | undefined;
    return {
      ...toAuthenticatedUser(payload),
      refreshToken: body?.refreshToken,
    };
  }
}
