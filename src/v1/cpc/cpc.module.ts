import { Module } from '@nestjs/common';
import { CpcService } from './cpc.service';
import { CpcController } from './cpc.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { CpcProduct, CpcSchema } from './cpc.schema';
import { LoggerService } from 'src/common/logger/logger.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: CpcProduct.name, schema: CpcSchema }]),
    AuditModule
  ],
  controllers: [CpcController],
  providers: [CpcService, LoggerService],
  exports: [CpcService]
})
export class CpcModule { }
