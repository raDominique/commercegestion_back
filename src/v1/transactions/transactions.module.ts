import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction, TransactionSchema } from './transactions.schema';
import { ActifsModule } from '../actifs/actifs.module';
import { PassifsModule } from '../passifs/passifs.module';
import { SharedModule } from '../../shared/shared.module';
import { ProductsModule } from '../products/products.module';
import { StockModule } from '../stock/stock.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    ActifsModule,
    PassifsModule,
    SharedModule,
    ProductsModule,
    StockModule,
    UsersModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
