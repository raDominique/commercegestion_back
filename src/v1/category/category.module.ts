import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { Category, CategorySchema } from './cateory.schema';
import { MongooseModule } from '@nestjs/mongoose';
import { LoggerService } from 'src/common/logger/logger.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [CategoryController],
  providers: [CategoryService, LoggerService],
  exports: [CategoryService],
})
export class CategoryModule {}
