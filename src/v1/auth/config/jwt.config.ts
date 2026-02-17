import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtConfig {
  readonly secret: string;
  readonly expiresIn: string;
  readonly refreshSecret: string;
  readonly refreshExpiresIn: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = this.configService.get<string>(
      'JWT_SECRET',
      'your-secret-key-change-in-production',
    );
    this.expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    this.refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'your-refresh-secret-key-change-in-production',
    );
    this.refreshExpiresIn = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
  }
}
