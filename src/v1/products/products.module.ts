import { forwardRef, Module } from '@nestjs/common';
import { ProductService } from './products.service';
import { ProductController } from './products.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Product , ProductSchema } from './products.schema';
import { AuditModule } from '../audit/audit.module';
import { LoggerService } from 'src/common/logger/logger.service';
import { NotificationsModule } from 'src/shared/notifications/notifications.module';
import { MailModule } from 'src/shared/mail/mail.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    MailModule,
    AuditModule,
    forwardRef(() => NotificationsModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [ProductController],
  providers: [ProductService, LoggerService],
  exports: [ProductService],
})
export class ProductsModule {}
