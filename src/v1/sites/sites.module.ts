import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Site, SiteSchema } from './sites.schema';
import { SiteService } from './sites.service';
import { SiteController } from './sites.controller';
import { UsersModule } from '../users/users.module';
import { LoggerService } from 'src/common/logger/logger.service';
import { AuditModule } from '../audit/audit.module';
import { AuditService } from '../audit/audit.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Site.name, schema: SiteSchema }]),
    UsersModule,
    AuditModule,
  ],
  controllers: [SiteController],
  providers: [SiteService, LoggerService],
  exports: [SiteService],
})
export class SiteModule {}
