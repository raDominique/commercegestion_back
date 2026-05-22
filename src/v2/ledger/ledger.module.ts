import { Module } from '@nestjs/common';
import { LedgerController } from './ledger.controller';
import { LedgerDisplayModule } from '../../v1/ledger-display/ledger-display.module';

@Module({
  imports: [LedgerDisplayModule],
  controllers: [LedgerController],
})
export class LedgerModule {}
