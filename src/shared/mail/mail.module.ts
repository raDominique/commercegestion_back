import { Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { MailQueueService } from './mail-queue.service';

@Module({
  controllers: [MailController],
  providers: [MailQueueService, MailService],
  exports: [MailQueueService, MailService],
})
export class MailModule {}
