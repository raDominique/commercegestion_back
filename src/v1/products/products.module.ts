import { Module } from '@nestjs/common';
import { ProductService } from './products.service';
import { ProductController } from './products.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Product } from './products.schema';
import { AuditModule } from '../audit/audit.module';
import { ProductSchema } from './products.schema';
import { LoggerService } from 'src/common/logger/logger.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
    AuditModule,
  ],
  controllers: [ProductController],
  providers: [ProductService, LoggerService],
  exports: [ProductService],

})
export class ProductsModule { }
