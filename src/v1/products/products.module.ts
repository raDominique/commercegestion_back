import { Module } from '@nestjs/common';
import { ProductService } from './products.service';
import { ProductController } from './products.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Product } from './products.schema';
import { AuditModule } from '../audit/audit.module';
import { ProductSchema } from './products.schema';
import { LoggerService } from 'src/common/logger/logger.service';
import { NotificationsModule } from 'src/shared/notifications/notifications.module';
import { MailService } from 'src/shared/mail/mail.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    AuditModule,
    NotificationsModule,
    UsersModule,
  ],
  controllers: [ProductController],
  providers: [ProductService, LoggerService, MailService],
  exports: [ProductService],
})
export class ProductsModule {}
