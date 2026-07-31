import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { MailQueueService } from './mail-queue.service';
import { MailDeliverabilityService } from './mail-deliverability.service';
import { MailJob, MailJobSchema } from './schemas/mail-job.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MailJob.name, schema: MailJobSchema }]),
  ],
  providers: [MailQueueService, MailService, MailDeliverabilityService],
  controllers: [MailController],
  exports: [MailQueueService, MailService, MailDeliverabilityService],
})
export class MailModule {}
