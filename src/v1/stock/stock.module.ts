import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { StockMovement, StockMovementSchema } from './stock-movement.schema';
import { ProductsModule } from '../products/products.module';
import { SiteModule } from '../sites/sites.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
    ProductsModule,
    SiteModule
  ],
  controllers: [StockController],
  providers: [StockService],
  exports: [StockService],
})
export class StockModule {}
