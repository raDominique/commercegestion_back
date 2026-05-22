import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UsersModule } from './users/users.module';
import { LedgerModule } from './ledger/ledger.module';
import { DatabaseModule } from '../database/database.module';
import { UploadModule } from '../shared/upload/upload.module';
import { LedgerDisplayModule } from '../v1/ledger-display/ledger-display.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UsersModule,
    LedgerModule,
    UploadModule,
    LedgerDisplayModule,
  ],
})
export class AppModuleV2 {}
