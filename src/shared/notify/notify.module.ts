import { forwardRef, Module } from '@nestjs/common';
import { NotifyHelper } from '../helpers/notify.helper';
import { UsersModule } from 'src/v1/users/users.module';
import { AuditModule } from 'src/v1/audit/audit.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    forwardRef(() => AuditModule),
    MailModule,
  ],
  providers: [NotifyHelper],
  exports: [NotifyHelper],
})
export class NotifyModule {}
