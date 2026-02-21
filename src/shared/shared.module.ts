import { Module, forwardRef } from '@nestjs/common';
import { NotifyHelper } from './helpers/notify.helper';
import { MailService } from './mail/mail.service';
import { UsersModule } from 'src/v1/users/users.module';
import { AuditModule } from 'src/v1/audit/audit.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => AuditModule),
    NotificationsModule,
  ],
  providers: [NotifyHelper, MailService],
  exports: [NotifyHelper, MailService],
})
export class SharedModule {}
