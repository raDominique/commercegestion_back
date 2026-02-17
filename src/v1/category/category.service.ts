import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './cateory.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { LoggerService } from 'src/common/logger/logger.service';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@Injectable()
export class CategoryService {
  private readonly context = 'CategoryService';

  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly logger: LoggerService,
  ) {}

  // ========================= CREATE =========================
  async create(
    createCategoryDto: CreateCategoryDto,
  ): Promise<PaginationResult<CategoryDocument>> {
    try {
      const category = new this.categoryModel(createCategoryDto);
      await category.save();

      this.logger.log(this.context, `Category created: ${category._id}`);

      return {
        status: 'success',
        message: 'Category created successfully',
        data: [category],
      };
    } catch (err) {
      this.logger.error(this.context, 'Error creating category', err.stack);
      throw new InternalServerErrorException('Failed to create category');
    }
  }

  // ========================= BULK CREATE =========================
  async createBulk(
    createCategoryDtos: CreateCategoryDto[],
  ): Promise<PaginationResult<CategoryDocument>> {
    try {
      const categories =
        await this.categoryModel.insertMany(createCategoryDtos);
      this.logger.log(
        this.context,
        `Bulk categories created: ${categories.map((c) => c._id).join(', ')}`,
      );
      return {
        status: 'success',
        message: 'Bulk categories created successfully',
        data: categories,
      };
    } catch (err) {
      this.logger.error(
        this.context,
        'Error bulk creating categories',
        err.stack,
      );
      throw new InternalServerErrorException(
        'Failed to bulk create categories',
      );
    }
  }

  // ========================= FIND ALL =========================
  async findAll(
    page = 1,
    limit = 10,
    search = '',
  ): Promise<PaginationResult<CategoryDocument>> {
    try {
      const skip = (page - 1) * limit;

      const filter = search
        ? {
            $or: [
              { catName: { $regex: search, $options: 'i' } },
              { catDescription: { $regex: search, $options: 'i' } },
            ],
          }
        : {};

      const data = await this.categoryModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .exec();

      const total = await this.categoryModel.countDocuments(filter);

      return {
        status: 'success',
        message: 'Categories fetched successfully',
        data,
        page,
        limit,
        total,
      };
    } catch (err) {
      this.logger.error(this.context, 'Error fetching categories', err.stack);
      throw new InternalServerErrorException('Failed to fetch categories');
    }
  }

  // ========================= FIND ONE =========================
  async findOne(id: string): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid category ID');

    const category = await this.categoryModel.findById(id).exec();
    if (!category) throw new NotFoundException('Category not found');

    return category;
  }

  // ========================= UPDATE =========================
  async update(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<CategoryDocument> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid category ID');

    const category = await this.categoryModel
      .findByIdAndUpdate(id, { $set: updateCategoryDto }, { new: true })
      .exec();

    if (!category) throw new NotFoundException('Category not found');

    this.logger.log(this.context, `Category updated: ${id}`);

    return category;
  }

  // ========================= DELETE =========================
  async remove(id: string): Promise<{ status: string; message: string }> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('Invalid category ID');

    const category = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!category) throw new NotFoundException('Category not found');

    this.logger.log(this.context, `Category deleted: ${id}`);

    return { status: 'success', message: 'Category deleted successfully' };
  }
}
