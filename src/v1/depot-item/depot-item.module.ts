import { Module } from '@nestjs/common';
import { DepotItemService } from './depot-item.service';
import { DepotItemController } from './depot-item.controller';
import { DepotItem, DepotItemSchema } from './depot-item.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DepotItem.name, schema: DepotItemSchema },
    ]),
  ],
  controllers: [DepotItemController],
  providers: [DepotItemService],
})
export class DepotItemModule {}
