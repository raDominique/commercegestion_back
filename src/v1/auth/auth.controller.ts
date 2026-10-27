import {
  Controller,
  Post,
  Body,
  Req,
  Get,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import type { Request } from 'express';
import { ApiOperation, ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Verify2FADto, Disable2FADto } from './dto/two-factor.dto';
import { Auth } from './decorators/auth.decorator';

@ApiTags('Authentication')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login user and get access + refresh tokens' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 201,
    description: 'User logged in successfully',
    schema: {
      example: {
        accessToken: 'jwt.token.here',
        refreshToken: 'refresh.token.here',
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '2FA required - challenge returned',
    schema: {
      example: {
        require2FA: true,
        loginChallenge: 'jwt.challenge.here',
        methods: ['totp', 'email-otp'],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Authentication failed',
    schema: {
      example: {
        statusCode: 401,
        message:
          'Invalid credentials OR Account not verified. Please check your email to verify your account. OR Account is inactive. Please contact support to activate your account.',
        error: 'Unauthorized',
      },
    },
  })
  login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Body('userEmail') userEmail?: string,
    @Body('userPassword') userPassword?: string,
    @Body('totpToken') totpToken?: string,
  ) {
    const email = loginDto?.userEmail ?? userEmail;
    const password = loginDto?.userPassword ?? userPassword;
    const token = loginDto?.totpToken ?? totpToken;
    return this.authService.login(email, password, req, token);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({
    status: 200,
    description: 'New access token generated',
    schema: {
      example: { accessToken: 'jwt.token.here' },
    },
  })
  @ApiResponse({ status: 403, description: 'Invalid or expired refresh token' })
  refreshAccessToken(
    @Body('refreshToken') refreshToken: string,
    @Req() req: Request,
  ) {
    return this.authService.refreshAccessToken(refreshToken, req);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout user and revoke refresh token' })
  @ApiBody({ type: LogoutDto })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  @ApiResponse({ status: 400, description: 'Invalid refresh token' })
  logout(@Body('refreshToken') refreshToken: string, @Req() req: Request) {
    return this.authService.logout(refreshToken, req);
  }

  @Post('verify-token')
  @ApiOperation({ summary: 'Verify a JWT token from Authorization header' })
  @Auth()
  @ApiResponse({
    status: 200,
    description: 'Token is valid and payload returned',
    schema: {
      example: {
        sub: 'user-id',
        email: 'user@example.com',
        userType: 'BUYER',
        iat: 1234567890,
        exp: 1234568890,
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid or missing token' })
  verifyToken(@Req() req: Request) {
    // Extraire le token du header Authorization: Bearer <token>
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException(
        'Token not provided in Authorization header',
      );
    }
    return this.authService.verifyToken(token);
  }

  @Get('profile')
  @Auth()
  @ApiOperation({
    summary: 'Get current user profile - requires valid JWT token',
  })
  @ApiResponse({
    status: 200,
    description: 'Return current user profile',
    schema: {
      example: {
        _id: 'user-id',
        email: 'user@example.com',
        userType: 'BUYER',
        companyName: 'Entreprise',
        phone: '123456789',
        isVerified: true,
        isActive: true,
        createdAt: '2024-02-01T00:00:00Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid JWT token',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  getProfile(@Req() req: any) {
    // req.user est injecté par JwtGuard et contient { userId, email, userType }
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }
    return this.authService.getProfile(userId);
  }

  @Post('forgot-password')
  @ApiOperation({
    summary: 'Demander un lien de réinitialisation de mot de passe',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Lien de réinitialisation envoyé (message sécurisé)',
  })
  @ApiResponse({ status: 400, description: 'Email invalide' })
  forgotPassword(@Body() dto: ForgotPasswordDto, @Req() req: Request) {
    return this.authService.forgotPassword(dto.userEmail, req);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Réinitialiser le mot de passe avec le token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe réinitialisé avec succès',
  })
  @ApiResponse({ status: 400, description: 'Token invalide ou expiré' })
  resetPassword(@Body() dto: ResetPasswordDto, @Req() req: Request) {
    return this.authService.resetPassword(
      dto.resetToken,
      dto.newPassword,
      dto.confirmPassword,
      req,
    );
  }

  @Post('change-password')
  @Auth()
  @ApiOperation({
    summary: 'Changer le mot de passe pour un utilisateur authentifié',
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Mot de passe changé avec succès',
  })
  @ApiResponse({ status: 400, description: 'Mot de passe actuel incorrect' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  changePassword(@Body() dto: ChangePasswordDto, @Req() req: any) {
    const userId = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('User ID not found in token');
    }
    return this.authService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
      dto.confirmPassword,
      req,
    );
  }

  @Post('2fa/complete')
  @ApiOperation({ summary: 'Seconde étape du login 2FA (TOTP)' })
  @ApiResponse({ status: 201, description: 'Session créée' })
  complete2FA(
    @Body('loginChallenge') loginChallenge: string,
    @Body('totpToken') totpToken: string,
    @Req() req: Request,
  ) {
    return this.authService.complete2FA(loginChallenge, totpToken, req);
  }

  @Post('2fa/enable')
  @Auth()
  @ApiOperation({ summary: 'Activer la 2FA (génère un QR code)' })
  @ApiResponse({ status: 201, description: 'QR code et secret générés' })
  enable2FA(@Req() req: any) {
    return this.authService.enable2FA(req.user.userId);
  }

  @Post('2fa/verify')
  @Auth()
  @ApiOperation({ summary: 'Vérifier et activer la 2FA' })
  @ApiBody({ type: Verify2FADto })
  @ApiResponse({ status: 201, description: '2FA activée' })
  verify2FA(@Req() req: any, @Body('token') token: string) {
    return this.authService.verify2FA(req.user.userId, token);
  }

  @Post('2fa/disable')
  @Auth()
  @ApiOperation({ summary: 'Désactiver la 2FA' })
  @ApiBody({ type: Disable2FADto })
  @ApiResponse({ status: 201, description: '2FA désactivée' })
  disable2FA(@Req() req: any, @Body('token') token: string) {
    return this.authService.disable2FA(req.user.userId, token);
  }
}
