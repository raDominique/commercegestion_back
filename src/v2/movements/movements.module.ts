import { Module } from '@nestjs/common';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';
import { ActifsModule } from '../../v1/actifs/actifs.module';
import { PassifsModule } from '../../v1/passifs/passifs.module';

@Module({
  imports: [ActifsModule, PassifsModule],
  controllers: [MovementsController],
  providers: [MovementsService],
  exports: [MovementsService],
})
export class MovementsModule {}
