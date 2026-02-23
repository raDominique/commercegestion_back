import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActifsService } from './actifs.service';
import { ActifsController } from './actifs.controller';
import { Actif, ActifSchema } from './actifs.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Actif.name, schema: ActifSchema }]),
  ],
  controllers: [ActifsController],
  providers: [ActifsService],
  exports: [ActifsService],
})
export class ActifsModule {}
