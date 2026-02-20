import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RefreshToken, RefreshTokenSchema } from './refresh-token.schema';
import { AuditService } from '../audit/audit.service';
import { AuditLog, AuditLogSchema } from '../audit/audit-log.schema';
import { RefreshTokenService } from './refresh-token.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtConfig } from './config/jwt.config';
import { SharedModule } from 'src/shared/shared.module';

@Module({
  imports: [
    UsersModule,
    SharedModule,
    PassportModule,
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = configService.get<string>('JWT_EXPIRES_IN', '15m');
        return {
          secret: configService.get<string>(
            'JWT_SECRET',
            'your-secret-key-change-in-production',
          ),
          signOptions: {
            expiresIn: expiresIn as any,
          },
        };
      },
    }),
  ],
  providers: [
    AuthService,
    AuditService,
    RefreshTokenService,
    JwtStrategy,
    JwtRefreshStrategy,
    JwtConfig,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
