import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Tender, TenderSchema, Bid, BidSchema } from './tender.schema';
import { TenderService } from './tender.service';
import { TenderController } from './tender.controller';
import { UploadModule } from '../../shared/upload/upload.module';

import { MailModule } from './../../shared/mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tender.name, schema: TenderSchema },
      { name: Bid.name, schema: BidSchema },
    ]),
    UploadModule,
    MailModule,
  ],
  controllers: [TenderController],
  providers: [TenderService],
  exports: [TenderService],
})
export class TenderModule {}
