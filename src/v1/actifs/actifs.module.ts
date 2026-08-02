import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActifsService } from './actifs.service';
import { ActifsController } from './actifs.controller';
import { Actif, ActifSchema } from './actifs.schema';
import { ProductsModule } from '../products/products.module';
import { Transaction, TransactionSchema } from '../transactions/transactions.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Actif.name, schema: ActifSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    ProductsModule,
  ],
  controllers: [ActifsController],
  providers: [ActifsService],
  exports: [ActifsService],
})
export class ActifsModule {}
