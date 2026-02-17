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
import { Auth } from './decorators/auth.decorator';

@ApiTags('Authentication')
@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) { }

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
    @Body('userEmail') userEmail: string,
    @Body('userPassword') userPassword: string,
    @Req() req: Request,
  ) {
    return this.authService.login(userEmail, userPassword, req);
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
}
