import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { DatabaseModule } from '../database/database.module';
import { UploadModule } from '../shared/upload/upload.module';
import { UploadService } from '../shared/upload/upload.service';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UsersModule,
    UploadModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService, UploadService],
})
export class AppModuleV1 {}
