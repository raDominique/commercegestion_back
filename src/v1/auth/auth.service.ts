import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtConfig } from './config/jwt.config';
import { AuditAction, EntityType } from '../audit/audit-log.schema';
import { AuthErrorMessage } from './errors/auth-error.messages';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfig,
  ) {}

  /** Login utilisateur */
  async login(userEmail: string, userPassword: string, req: Request) {
    // Récupérer l'utilisateur avec son mot de passe pour vérification
    const user = await this.usersService.findByEmailWithPassword(userEmail);

    // Cas 1: Utilisateur n'existe pas
    if (!user) {
      await this.logAudit('0', AuditAction.LOGIN, req);
      throw new UnauthorizedException(AuthErrorMessage.INVALID_CREDENTIALS);
    }

    // Cas 2: Utilisateur n'est pas vérifié ET n'est pas actif
    if (!user.userEmailVerified && !user.userValidated) {
      await this.logAudit(user._id.toString(), AuditAction.LOGIN, req);
      throw new UnauthorizedException(AuthErrorMessage.ACCOUNT_NOT_VERIFIED);
    }

    // Cas 3: Utilisateur est vérifié mais n'est pas actif
    if (user.userEmailVerified && !user.userValidated) {
      await this.logAudit(user._id.toString(), AuditAction.LOGIN, req);
      throw new UnauthorizedException(AuthErrorMessage.ACCOUNT_INACTIVE);
    }

    // Cas 4: Mot de passe incorrect
    const match = await bcrypt.compare(userPassword, user.userPassword);
    if (!match) {
      await this.logAudit(user._id.toString(), AuditAction.LOGIN, req);
      throw new UnauthorizedException(AuthErrorMessage.INVALID_CREDENTIALS);
    }

    // Succès: Générer les tokens
    const payload = {
      sub: user._id.toString(),
      userEmail: user.userEmail,
      userType: user.userType,
      userAccess: user.userAccess,
      userValidated: user.userValidated,
      userVerified: user.userEmailVerified,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtConfig.secret,
      expiresIn: this.jwtConfig.expiresIn as any,
    });

    const refreshExpiresInSeconds = this.parseDuration(
      this.jwtConfig.refreshExpiresIn,
    );
    const refreshTokenDoc = await this.refreshTokenService.create(
      user._id.toString(),
      refreshExpiresInSeconds,
      req.ip,
      req.headers['user-agent'] as string,
    );

    await this.logAudit(user._id.toString(), AuditAction.LOGIN, req);

    return { accessToken, refreshToken: refreshTokenDoc.token };
  }

  /** Logout utilisateur */
  async logout(refreshToken: string, req?: Request) {
    const token = await this.refreshTokenService.revoke(refreshToken);
    if (!token)
      throw new BadRequestException(AuthErrorMessage.INVALID_REFRESH_TOKEN);

    await this.logAudit(token.userId.toString(), AuditAction.LOGOUT, req, {
      ipAddress: token.ipAddress || 'unknown',
      userAgent: token.userAgent || 'unknown',
    });

    return { message: 'Logged out successfully' };
  }

  /** Refresh access token */
  async refreshAccessToken(refreshToken: string, req: Request) {
    const validToken = await this.refreshTokenService.findValid(refreshToken);
    if (!validToken)
      throw new ForbiddenException(AuthErrorMessage.INVALID_REFRESH_TOKEN);

    const userResult = await this.usersService.findOne(
      validToken.userId.toString(),
    );
    const user = userResult.data?.[0];
    if (!user) throw new UnauthorizedException(AuthErrorMessage.USER_NOT_FOUND);

    const payload = {
      sub: user._id.toString(),
      userEmail: user.userEmail,
      userType: user.userType,
      userAccess: user.userAccess,
      userValidated: user.userValidated,
      userVerified: user.userEmailVerified,
    };
    const accessToken = this.jwtService.sign(payload, {
      secret: this.jwtConfig.secret,
      expiresIn: this.jwtConfig.expiresIn as any,
    });

    await this.logAudit(user._id.toString(), AuditAction.REFRESH_TOKEN, req);

    return { accessToken };
  }

  /** Vérifier un JWT */
  async verifyToken(token: string) {
    try {
      return this.jwtService.verify(token, { secret: this.jwtConfig.secret });
    } catch (err) {
      throw new UnauthorizedException(AuthErrorMessage.INVALID_TOKEN);
    }
  }

  /** Obtenir le profil utilisateur */
  async getProfile(userId: string) {
    const userResult = await this.usersService.findOne(userId);
    return userResult.data?.[0];
  }

  /** Helper pour l’audit */
  private async logAudit(
    userId: string,
    action: AuditAction,
    req?: Request,
    tokenData?: { ipAddress: string; userAgent: string },
  ) {
    await this.auditService.log({
      action,
      entityType: EntityType.USER,
      userId,
      ipAddress: req?.ip || tokenData?.ipAddress || 'unknown',
      userAgent:
        (req?.headers['user-agent'] as string) ||
        tokenData?.userAgent ||
        'unknown',
    });
  }

  /** Convertit la durée string en secondes (ex: "7d" => 604800) */
  private parseDuration(duration: string): number {
    const regex = /^(\d+)([smhd])$/;
    const match = duration.match(regex);
    if (!match) return parseInt(duration) || 0;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return value;
    }
  }
}
