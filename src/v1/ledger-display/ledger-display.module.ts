import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LedgerDisplayService } from './ledger-display.service';
import { LedgerDisplayController } from './ledger-display.controller';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/transactions.schema';
import { Actif, ActifSchema } from '../actifs/actifs.schema';
import { Passif, PassifSchema } from '../passifs/passifs.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Actif.name, schema: ActifSchema },
      { name: Passif.name, schema: PassifSchema },
    ]),
  ],
  controllers: [LedgerDisplayController],
  providers: [LedgerDisplayService],
  exports: [LedgerDisplayService],
})
export class LedgerDisplayModule {}
