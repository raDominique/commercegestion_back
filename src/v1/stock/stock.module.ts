import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { StockMovement, StockMovementSchema } from './stock-movement.schema';
import { ProductsModule } from '../products/products.module';
import { SiteModule } from '../sites/sites.module';
import { ActifsModule } from '../actifs/actifs.module';
import { PassifsModule } from '../passifs/passifs.module';
import { LoggerService } from 'src/common/logger/logger.service';
import { MailModule } from 'src/shared/mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockMovement.name, schema: StockMovementSchema },
    ]),
    ProductsModule,
    SiteModule,
    ActifsModule,
    PassifsModule,
    MailModule,
  ],
  controllers: [StockController],
  providers: [StockService, LoggerService],
  exports: [StockService],
})
export class StockModule {}
