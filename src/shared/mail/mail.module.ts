import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailQueueService } from './mail-queue.service';

@Module({
  providers: [MailQueueService, MailService],
  exports: [MailQueueService, MailService],
})
export class MailModule {}
