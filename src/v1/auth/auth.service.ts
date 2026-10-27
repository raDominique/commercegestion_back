import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { RefreshTokenService } from './refresh-token.service';
import { JwtConfig } from './config/jwt.config';
import { AuditAction, EntityType } from '../audit/audit-log.schema';
import { AuthErrorMessage } from './errors/auth-error.messages';
import { MailService } from 'src/shared/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { generateSecret, verify, generateURI } from 'otplib';
import * as qrcode from 'qrcode';

@Injectable()
export class AuthService {
  private readonly frontUrl: string;
  constructor(
    private readonly usersService: UsersService,
    private readonly auditService: AuditService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly jwtService: JwtService,
    private readonly jwtConfig: JwtConfig,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    this.frontUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
  }

  /** Login utilisateur */
  async login(userEmail: string, userPassword: string, req: Request, totpToken?: string) {
    const user = await this.usersService.findByEmailWithPassword(userEmail);

    if (!user) {
      await this.logAudit('0', AuditAction.LOGIN, req);
      throw new UnauthorizedException(AuthErrorMessage.INVALID_CREDENTIALS);
    }

    if (!user.userEmailVerified) {
      await this.logAudit(user._id.toString(), AuditAction.LOGIN, req);
      throw new UnauthorizedException(AuthErrorMessage.ACCOUNT_NOT_VERIFIED);
    }

    const match = await bcrypt.compare(userPassword, user.userPassword);
    if (!match) {
      await this.logAudit(user._id.toString(), AuditAction.LOGIN, req);
      throw new UnauthorizedException(AuthErrorMessage.INVALID_CREDENTIALS);
    }

    if (user.twoFactorEnabled) {
      // Phase 1 : le mot de passe n'est jamais renvoyé au second pas.
      // - Si totpToken fourni dans la même requête → vérification directe.
      // - Sinon on renvoie un loginChallenge (TTL 5 min) que le client utilisera
      //   sur POST /auth/2fa/complete.
      if (!totpToken) {
        const loginChallenge = this.jwtService.sign(
          {
            sub: user._id.toString(),
            purpose: 'LOGIN_2FA',
            iat: Math.floor(Date.now() / 1000),
          },
          { secret: this.jwtConfig.secret, expiresIn: '5m' as any },
        );
        return {
          require2FA: true,
          loginChallenge,
          methods: ['totp', 'email-otp'],
        };
      }
      const userWithSecret = await this.usersService.findByIdWithSecret(
        user._id.toString(),
      );
      const valid = verify({
        token: totpToken,
        secret: userWithSecret?.twoFactorSecret,
      });
      if (!valid) {
        await this.logAudit(user._id.toString(), AuditAction.LOGIN, req);
        throw new UnauthorizedException('Code 2FA invalide');
      }
    }

    return this.issueSession(user, req);
  }

  /** Seconde étape du login 2FA : vérifie le challenge puis le code TOTP et émet la session */
  async complete2FA(loginChallenge: string, totpToken: string, req: Request) {
    let decoded: any;
    try {
      decoded = this.jwtService.verify(loginChallenge, {
        secret: this.jwtConfig.secret,
      });
    } catch {
      throw new UnauthorizedException('Session 2FA expirée ou invalide');
    }
    if (decoded.purpose !== 'LOGIN_2FA') {
      throw new UnauthorizedException('Session 2FA invalide');
    }

    const user = await this.usersService.findOne(decoded.sub);
    const userDoc = user.data?.[0] as any;
    if (!userDoc) throw new UnauthorizedException(AuthErrorMessage.USER_NOT_FOUND);
    if (!userDoc.twoFactorEnabled) {
      throw new UnauthorizedException('2FA non activée');
    }

    const userWithSecret = await this.usersService.findByIdWithSecret(
      decoded.sub,
    );
    const valid = verify({ token: totpToken, secret: userWithSecret?.twoFactorSecret });
    if (!valid) {
      await this.logAudit(decoded.sub, AuditAction.LOGIN, req);
      throw new UnauthorizedException('Code 2FA invalide');
    }

    return this.issueSession(userDoc, req);
  }

  /** Émet les tokens (access + refresh) et journalise la connexion */
  private async issueSession(user: any, req: Request) {
    const payload = {
      sub: user._id.toString(),
      userEmail: user.userEmail,
      userType: user.userType,
      userAccess: user.userAccess,
      userValidated: user.userValidated,
      userVerified: user.userEmailVerified,
      userIdPartager: user.userId,
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
      req.ip || 'unknown',
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
      userIdPartager: user.userId,
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
      console.error('Token verification failed:', err);
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
    // S6594: Use RegExp.exec()
    const match = regex.exec(duration);

    // S7773: Use Number.parseInt
    if (!match) return Number.parseInt(duration, 10) || 0;

    const value = Number.parseInt(match[1], 10);
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

  /** Mot de passe oublié */
  async forgotPassword(userEmail: string, req: Request) {
    const userResult = await this.usersService.findByEmail(userEmail);
    const user = userResult.data?.[0];

    if (!user) {
      return {
        status: 'success',
        message:
          'Si cet email existe, un lien de réinitialisation sera envoyé.',
      };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
    const expiresIn = 24 * 60 * 60 * 1000;

    await this.usersService.updatePasswordReset(
      user._id.toString(),
      hashedToken,
      new Date(Date.now() + expiresIn),
    );

    const resetLink = `${this.frontUrl}/reset-password?token=${resetToken}`;

    try {
      await this.mailService.sendPasswordResetEmail(
        user.userEmail,
        user.userName,
        resetLink,
      );
    } catch (error) {
      console.error('Password reset email send failed:', error);
      throw new InternalServerErrorException(
        "Impossible d'envoyer l'email de réinitialisation.",
      );
    }

    await this.logAudit(user._id.toString(), AuditAction.PASSWORD_RESET, req);

    return {
      status: 'success',
      message: 'Si cet email existe, un lien de réinitialisation sera envoyé.',
    };
  }

  /** Réinitialiser le mot de passe */
  async resetPassword(
    resetToken: string,
    newPassword: string,
    confirmPassword: string,
    req: Request,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }

    const hashedToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    const userResult = await this.usersService.findByResetToken(hashedToken);
    const user = userResult.data?.[0];

    // S6582: Use optional chain expression
    const expiration = user?.resetPasswordExpires?.getTime() ?? 0;
    if (!user || expiration < Date.now()) {
      throw new BadRequestException(
        'Le lien de réinitialisation est invalide ou expiré.',
      );
    }

    await this.usersService.updatePassword(user._id.toString(), newPassword);
    await this.usersService.clearPasswordReset(user._id.toString());
    await this.logAudit(user._id.toString(), AuditAction.PASSWORD_CHANGED, req);

    return {
      status: 'success',
      message: 'Votre mot de passe a été réinitialisé avec succès.',
    };
  }

  /** Changer le mot de passe utilisateur connecté */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string,
    req: Request,
  ) {
    if (newPassword !== confirmPassword) {
      throw new BadRequestException('Les mots de passe ne correspondent pas.');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException(
        "Le nouveau mot de passe doit être différent de l'actuel.",
      );
    }

    const userResult = await this.usersService.findByIdWithPassword(userId);
    const user = userResult.data?.[0];

    if (!user) throw new UnauthorizedException('Utilisateur non trouvé.');

    const match = await bcrypt.compare(currentPassword, user.userPassword);
    if (!match) {
      throw new BadRequestException('Le mot de passe actuel est incorrect.');
    }

    await this.usersService.updatePassword(userId, newPassword);
    await this.logAudit(userId, AuditAction.PASSWORD_CHANGED, req);

    return {
      status: 'success',
      message: 'Votre mot de passe a été changé avec succès.',
    };
  }

  async enable2FA(userId: string) {
    const secret = generateSecret();
    await this.usersService.update2FAFields(userId, { twoFactorSecret: secret });
    const otpauth = generateURI({ issuer: 'CommerceGestion', label: userId, secret });
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);
    return { secret, qrCodeDataUrl };
  }

  async verify2FA(userId: string, token: string) {
    const user = await this.usersService.findByIdWithSecret(userId);
    if (!user?.twoFactorSecret) throw new BadRequestException('2FA non initialisée');
    const valid = verify({ token, secret: user.twoFactorSecret });
    if (!valid) throw new BadRequestException('Code invalide');
    await this.usersService.update2FAFields(userId, { twoFactorEnabled: true });
    return { enabled: true };
  }

  async disable2FA(userId: string, token: string) {
    const user = await this.usersService.findByIdWithSecret(userId);
    if (!user?.twoFactorEnabled) throw new BadRequestException('2FA non activée');
    const valid = verify({ token, secret: user.twoFactorSecret });
    if (!valid) throw new BadRequestException('Code invalide');
    await this.usersService.update2FAFields(userId, { twoFactorEnabled: false, twoFactorSecret: null });
    return { enabled: false };
  }
}
