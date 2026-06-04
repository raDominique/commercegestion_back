import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Site, SiteSchema } from './sites.schema';
import { SiteService } from './sites.service';
import { SiteController } from './sites.controller';
import { UsersModule } from '../users/users.module';
import { LoggerService } from 'src/common/logger/logger.service';
import { AuditModule } from '../audit/audit.module';
import { NotifyModule } from 'src/shared/notify/notify.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Site.name, schema: SiteSchema }]),
    AuditModule,
    forwardRef(() => UsersModule),
    NotifyModule,
  ],
  controllers: [SiteController],
  providers: [SiteService, LoggerService],
  exports: [SiteService],
})
export class SiteModule {}
