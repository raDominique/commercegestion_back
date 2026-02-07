import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './users.schema';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  UserVerificationToken,
  UserVerificationTokenSchema,
} from './user-verification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserVerificationToken.name, schema: UserVerificationTokenSchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService, LoggerService],
  exports: [UsersService],
})
export class UsersModule {}
