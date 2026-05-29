import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShopAvailable, ShopAvailableSchema } from './shop-available.schema';
import { ShopAvailableService } from './shop-available.service';
import { ShopAvailableController } from './shop-available.controller';
import { ActifsModule } from '../actifs/actifs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ShopAvailable.name, schema: ShopAvailableSchema },
    ]),
    ActifsModule,
  ],
  controllers: [ShopAvailableController],
  providers: [ShopAvailableService],
  exports: [ShopAvailableService],
})
export class ShopAvailableModule {}
