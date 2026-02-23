import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './users.schema';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  UserVerificationToken,
  UserVerificationTokenSchema,
} from './user-verification.schema';
import { SiteModule } from '../sites/sites.module';
import { AuditModule } from '../audit/audit.module';
import { NotifyHelper } from 'src/shared/helpers/notify.helper';
import { SharedModule } from 'src/shared/shared.module';
import { NotificationsService } from 'src/shared/notifications/notifications.service';
import { NotificationsModule } from 'src/shared/notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserVerificationToken.name, schema: UserVerificationTokenSchema },
    ]),
    forwardRef(() => SharedModule),
    forwardRef(() => NotificationsModule),
    forwardRef(() => SiteModule),
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, LoggerService],
  exports: [UsersService],
})
export class UsersModule {}
