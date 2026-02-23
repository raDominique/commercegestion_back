import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassifsService } from './passifs.service';
import { PassifsController } from './passifs.controller';
import { Passif, PassifSchema } from './passifs.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Passif.name, schema: PassifSchema }]),
  ],
  controllers: [PassifsController],
  providers: [PassifsService],
  exports: [PassifsService],
})
export class PassifsModule {}
