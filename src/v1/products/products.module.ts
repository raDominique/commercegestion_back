import { forwardRef, Module } from '@nestjs/common';
import { ProductService } from './products.service';
import { ProductController } from './products.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Product, ProductSchema } from './products.schema';
import { CpcProduct, CpcSchema } from '../cpc/cpc.schema';
import { AuditModule } from '../audit/audit.module';
import { LoggerService } from 'src/common/logger/logger.service';
import { NotificationsModule } from 'src/shared/notifications/notifications.module';
import { MailModule } from 'src/shared/mail/mail.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: CpcProduct.name, schema: CpcSchema },
    ]),
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
