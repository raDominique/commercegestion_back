import { Module, forwardRef } from '@nestjs/common';
import { NotifyHelper } from './helpers/notify.helper';
import { MailService } from './mail/mail.service';
import { UsersModule } from 'src/v1/users/users.module';
import { AuditModule } from 'src/v1/audit/audit.module';

@Module({
  imports: [forwardRef(() => UsersModule), forwardRef(() => AuditModule)],
  providers: [NotifyHelper, MailService],
  exports: [NotifyHelper, MailService],
})
export class SharedModule {}
