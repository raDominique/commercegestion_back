import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../config/jwt.config';

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

  async validate(req: any, payload: any) {
    return {
      userId: payload.sub,
      email: payload.email,
      userType: payload.userType,
      userAccess: payload.userAccess,
      userValidated: payload.userValidated,
      userVerified: payload.userVerified,
      refreshToken: req.body.refreshToken,
    };
  }
}
