import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cart, CartSchema, Order, OrderSchema } from './cart.schema';
import { CartService } from './cart.service';
import { CartController } from './cart.controller';
import { ShopAvailableModule } from '../shop-available/shop-available.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cart.name, schema: CartSchema },
      { name: Order.name, schema: OrderSchema },
    ]),
    ShopAvailableModule,
    TransactionsModule,
  ],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
