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
import { EmailOtpService } from './email-otp.service';
import {
  encryptSecret,
  decryptSecret,
  generateBackupCodes,
  hashBackupCode,
} from './utils/two-factor-encryption';
import { AuthSecurityService } from './security/auth-security.service';

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
    private readonly emailOtpService: EmailOtpService,
    private readonly authSecurityService: AuthSecurityService,
  ) {
    this.frontUrl =
      this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
  }

  /** Login utilisateur */
  async login(
    userEmail: string,
    userPassword: string,
    req: Request,
    totpToken?: string,
    rememberMe?: boolean,
  ) {
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
            rememberMe: !!rememberMe,
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
      const decryptedSecret = userWithSecret?.twoFactorSecret
        ? decryptSecret(userWithSecret.twoFactorSecret)
        : undefined;
      const valid = verify({
        token: totpToken,
        secret: decryptedSecret,
      });
      if (!valid) {
        await this.logAudit(user._id.toString(), AuditAction.LOGIN, req);
        throw new UnauthorizedException('Code 2FA invalide');
      }
      if (rememberMe) {
        await this.logAudit(user._id.toString(), AuditAction.LOGIN_REMEMBER_ME, req);
      }
      return this.issueSession(user, req, rememberMe);
    }

    // Phase 6: 2FA obligatoire à la première connexion
    const setupToken = this.jwtService.sign(
      {
        sub: user._id.toString(),
        purpose: '2FA_SETUP',
        iat: Math.floor(Date.now() / 1000),
      },
      { secret: this.jwtConfig.secret, expiresIn: '10m' as any },
    );
    await this.logAudit(user._id.toString(), AuditAction.TWO_FA_FORCED_SETUP, req);
    return {
      require2faSetup: true,
      setupToken,
    };
  }

  /** Seconde étape du login 2FA : vérifie le challenge puis le code TOTP ou email OTP et émet la session */
  async complete2FA(
    loginChallenge: string,
    req: Request,
    totpToken?: string,
    emailOtpToken?: string,
    rememberMe?: boolean,
  ) {
    const rateLimitKey = `complete2fa:${req.ip || 'unknown'}`;
    this.authSecurityService.checkRateLimit(rateLimitKey);

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

    const lockoutKey = `lockout:${decoded.sub}`;
    this.authSecurityService.checkLockout(lockoutKey);

    const user = await this.usersService.findOne(decoded.sub);
    const userDoc = user.data?.[0] as any;
    if (!userDoc) throw new UnauthorizedException(AuthErrorMessage.USER_NOT_FOUND);
    if (!userDoc.twoFactorEnabled) {
      throw new UnauthorizedException('2FA non activée');
    }

    let valid = false;
    if (totpToken) {
      try {
        this.authSecurityService.checkAndRecordTotpCode(decoded.sub, totpToken);
      } catch (e) {
        await this.logAudit(decoded.sub, AuditAction.TWO_FA_FAILED, req);
        throw e;
      }
      const userWithSecret = await this.usersService.findByIdWithSecret(
        decoded.sub,
      );
      const decryptedSecret = userWithSecret?.twoFactorSecret
        ? decryptSecret(userWithSecret.twoFactorSecret)
        : undefined;
      valid = verify({ token: totpToken, secret: decryptedSecret });
      if (valid) {
        await this.logAudit(decoded.sub, AuditAction.TWO_FA_CHOSEN_METHOD, req, {
          ipAddress: req.ip || 'unknown',
          userAgent: (req.headers['user-agent'] as string) || 'unknown',
        } as any);
      }
    } else if (emailOtpToken) {
      valid = await this.emailOtpService.verifyCode(decoded.sub, emailOtpToken);
      if (valid) {
        await this.logAudit(decoded.sub, AuditAction.TWO_FA_CHOSEN_METHOD, req, {
          ipAddress: req.ip || 'unknown',
          userAgent: (req.headers['user-agent'] as string) || 'unknown',
        } as any);
      }
    } else {
      throw new BadRequestException('Code 2FA requis');
    }

    if (!valid) {
      this.authSecurityService.recordFailedAttempt(lockoutKey);
      await this.logAudit(decoded.sub, AuditAction.TWO_FA_FAILED, req);
      await this.logAudit(decoded.sub, AuditAction.LOGIN, req);
      throw new UnauthorizedException('Code 2FA invalide');
    }

    this.authSecurityService.resetFailedAttempts(lockoutKey);
    if (decoded.rememberMe) {
      await this.logAudit(userDoc._id.toString(), AuditAction.LOGIN_REMEMBER_ME, req);
    }
    return this.issueSession(userDoc, req, decoded.rememberMe);
  }

  /** Émet les tokens (access + refresh) et journalise la connexion */
  private async issueSession(user: any, req: Request, rememberMe?: boolean) {
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

    let refreshExpiresInSeconds = this.parseDuration(
      this.jwtConfig.refreshExpiresIn,
    );
    if (rememberMe) {
      refreshExpiresInSeconds = 30 * 24 * 60 * 60; // 30 jours
    } else {
      refreshExpiresInSeconds = 24 * 60 * 60; // 24 heures
    }

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

  /** Envoyer un code OTP par email pour le 2FA */
  async sendEmailChallenge(loginChallenge: string, req: Request) {
    const rateLimitKey = `emailchallenge:${req.ip || 'unknown'}`;
    this.authSecurityService.checkRateLimit(rateLimitKey);

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
    if (!userDoc.userEmailVerified) {
      throw new UnauthorizedException('Email non vérifié');
    }

    try {
      const { code } = await this.emailOtpService.createCode(
        decoded.sub,
        req.ip || 'unknown',
        req.headers['user-agent'] as string,
      );
      await this.mailService.sendTwoFactorCodeEmail(
        userDoc.userEmail,
        userDoc.userName || userDoc.userEmail,
        code,
        10,
      );
      await this.logAudit(decoded.sub, AuditAction.TWO_FA_EMAIL_CODE_SENT, req);
      return { sent: true };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        "Erreur lors de l'envoi du code OTP",
      );
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
    try {
      await this.refreshTokenService.revokeAllByUser(user._id.toString());
    } catch (e) {
      // Ignore errors on token revocation
    }
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
    try {
      await this.refreshTokenService.revokeAllByUser(userId);
    } catch (e) {
      // Ignore errors on token revocation
    }
    await this.logAudit(userId, AuditAction.PASSWORD_CHANGED, req);

    return {
      status: 'success',
      message: 'Votre mot de passe a été changé avec succès.',
    };
  }

  async enable2FA(userId: string) {
    const secret = generateSecret();
    const encryptedSecret = encryptSecret(secret);
    await this.usersService.update2FAFields(userId, { twoFactorSecret: encryptedSecret });
    const otpauth = generateURI({ issuer: 'CommerceGestion', label: userId, secret });
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);
    return { secret, qrCodeDataUrl };
  }

  async verify2FA(userId: string, token: string) {
    const rateLimitKey = `verify2fa:${userId}:${userId}`;
    this.authSecurityService.checkRateLimit(rateLimitKey);
    this.authSecurityService.checkLockout(`lockout:${userId}`);

    const user = await this.usersService.findByIdWithSecret(userId);
    if (!user?.twoFactorSecret) throw new BadRequestException('2FA non initialisée');
    try {
      this.authSecurityService.checkAndRecordTotpCode(userId, token);
    } catch (e) {
      this.authSecurityService.recordFailedAttempt(`lockout:${userId}`);
      throw e;
    }
    const decryptedSecret = decryptSecret(user.twoFactorSecret);
    const valid = verify({ token, secret: decryptedSecret });
    if (!valid) {
      this.authSecurityService.recordFailedAttempt(`lockout:${userId}`);
      throw new BadRequestException('Code invalide');
    }
    this.authSecurityService.resetFailedAttempts(`lockout:${userId}`);
    const backupCodes = generateBackupCodes(8);
    const hashedBackupCodes = backupCodes.map((code) => hashBackupCode(code));
    await this.usersService.update2FAFields(userId, {
      twoFactorEnabled: true,
      twoFactorBackupCodes: hashedBackupCodes,
    });
    return { enabled: true, backupCodes };
  }

  async disable2FA(userId: string, token: string) {
    const rateLimitKey = `disable2fa:${userId}`;
    this.authSecurityService.checkRateLimit(rateLimitKey);
    this.authSecurityService.checkLockout(`lockout:${userId}`);

    const user = await this.usersService.findByIdWithSecret(userId);
    if (!user?.twoFactorEnabled) throw new BadRequestException('2FA non activée');
    try {
      this.authSecurityService.checkAndRecordTotpCode(userId, token);
    } catch (e) {
      this.authSecurityService.recordFailedAttempt(`lockout:${userId}`);
      throw e;
    }
    const decryptedSecret = decryptSecret(user.twoFactorSecret);
    const valid = verify({ token, secret: decryptedSecret });
    if (!valid) {
      this.authSecurityService.recordFailedAttempt(`lockout:${userId}`);
      throw new BadRequestException('Code invalide');
    }
    this.authSecurityService.resetFailedAttempts(`lockout:${userId}`);
    await this.usersService.update2FAFields(userId, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    });
    return { enabled: false };
  }

  async useBackupCode(loginChallenge: string, backupCode: string, req: Request) {
    const rateLimitKey = `backupcode:${req.ip || 'unknown'}`;
    this.authSecurityService.checkRateLimit(rateLimitKey);

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

    const lockoutKey = `lockout:${decoded.sub}`;
    this.authSecurityService.checkLockout(lockoutKey);

    const user = await this.usersService.findOne(decoded.sub);
    const userDoc = user.data?.[0] as any;
    if (!userDoc) throw new UnauthorizedException(AuthErrorMessage.USER_NOT_FOUND);
    if (!userDoc.twoFactorEnabled) {
      throw new UnauthorizedException('2FA non activée');
    }

    const hashedCode = hashBackupCode(backupCode);
    const userWithBackup = await this.usersService.findByIdWithSecret(
      decoded.sub,
    );
    const backupCodes = userWithBackup?.twoFactorBackupCodes || [];

    if (!backupCodes.includes(hashedCode)) {
      this.authSecurityService.recordFailedAttempt(lockoutKey);
      await this.logAudit(decoded.sub, AuditAction.TWO_FA_FAILED, req);
      throw new UnauthorizedException('Code de secours invalide');
    }

    // Remove used backup code
    const updatedCodes = backupCodes.filter((code) => code !== hashedCode);
    await this.usersService.update2FAFields(decoded.sub, {
      twoFactorBackupCodes: updatedCodes,
    });

    this.authSecurityService.resetFailedAttempts(lockoutKey);
    await this.logAudit(decoded.sub, AuditAction.TWO_FA_CHOSEN_METHOD, req, {
      ipAddress: req.ip || 'unknown',
      userAgent: (req.headers['user-agent'] as string) || 'unknown',
    } as any);

    if (decoded.rememberMe) {
      await this.logAudit(userDoc._id.toString(), AuditAction.LOGIN_REMEMBER_ME, req);
    }
    return this.issueSession(userDoc, req, decoded.rememberMe);
  }
}
