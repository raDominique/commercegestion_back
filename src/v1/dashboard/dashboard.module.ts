import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { LedgerDisplayService } from '../ledger-display/ledger-display.service';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/transactions.schema';
import { Actif, ActifSchema } from '../actifs/actifs.schema';
import { Passif, PassifSchema } from '../passifs/passifs.schema';
import { DashboardService } from './dashboard.service';
import { Product, ProductSchema } from '../products/products.schema';
import { Site, SiteSchema } from '../sites/sites.schema';
import { User, UserSchema } from '../users/users.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Actif.name, schema: ActifSchema },
      { name: Passif.name, schema: PassifSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Site.name, schema: SiteSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [LedgerDisplayService, DashboardService],
})
export class DashboardModule {}
