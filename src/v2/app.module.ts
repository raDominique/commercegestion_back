import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { LedgerModule } from './ledger/ledger.module';
import { MovementsModule } from './movements/movements.module';
import { DatabaseModule } from '../database/database.module';
import { UploadModule } from '../shared/upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UsersModule,
    LedgerModule,
    MovementsModule,
    UploadModule,
  ],
})
export class AppModuleV2 {}
