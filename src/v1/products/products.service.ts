import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './products.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AuditService } from 'src/v1/audit/audit.service';
import { LoggerService } from 'src/common/logger/logger.service';
import { AuditAction, EntityType } from 'src/v1/audit/audit-log.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name) private model: Model<ProductDocument>,
    private readonly auditService: AuditService,
    private readonly logger: LoggerService,
  ) {}

  async create(data: CreateProductDto, userId: string): Promise<PaginationResult<Product>> {
    this.logger.debug('Product', `Création : ${data.productName}`);
    
    const created = await new this.model({ ...data, productOwnerId: userId }).save();

    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: EntityType.PRODUCT,
      entityId: created._id.toString(),
      userId: userId,
      newState: created.toObject(),
    });

    return { status: 'success', message: 'Produit créé', data: [created] };
  }

  async findAll(query: any): Promise<PaginationResult<Product>> {
    const { page = 1, limit = 10, search, categoryId } = query;
    const filter: any = {};
    if (search) filter.productName = { $regex: search, $options: 'i' };
    if (categoryId) filter.categoryId = categoryId;

    const [data, total] = await Promise.all([
      this.model.find(filter)
        .populate('categoryId') // Récupère les infos de CpcProduct
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit))
        .exec(),
      this.model.countDocuments(filter),
    ]);

    return { status: 'success', message: 'OK', data, total, page: Number(page), limit: Number(limit) };
  }

  async findOne(id: string): Promise<PaginationResult<Product>> {
    const res = await this.model.findById(id).populate('categoryId').exec();
    if (!res) throw new NotFoundException('Produit introuvable');
    return { status: 'success', message: 'Trouvé', data: [res] };
  }

  async update(id: string, data: UpdateProductDto, userId: string): Promise<PaginationResult<Product>> {
    const previous = await this.model.findById(id).exec();
    if (!previous) throw new NotFoundException('Produit introuvable');

    const updated = await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
    if (!updated) throw new BadRequestException('Mise à jour échouée');

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entityType: EntityType.PRODUCT,
      entityId: updated._id.toString(),
      userId: userId,
      previousState: previous.toObject(),
      newState: updated.toObject(),
    });

    return { status: 'success', message: 'Mis à jour', data: [updated] };
  }

  async delete(id: string, userId: string): Promise<PaginationResult<Product>> {
    const toDelete = await this.model.findById(id).exec();
    if (!toDelete) throw new NotFoundException('Produit introuvable');

    await this.model.findByIdAndDelete(id).exec();

    await this.auditService.log({
      action: AuditAction.DELETE,
      entityType: EntityType.PRODUCT,
      entityId: id,
      userId: userId,
      previousState: toDelete.toObject(),
    });

    return { status: 'success', message: 'Supprimé' };
  }
}