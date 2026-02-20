import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './products.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UploadService } from 'src/shared/upload/upload.service';
import { AuditService } from 'src/v1/audit/audit.service';
import { AuditAction, EntityType } from 'src/v1/audit/audit-log.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly uploadService: UploadService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Créer un produit
   * Règle : isStocker est toujours false à la création
   */
  async create(
    dto: CreateProductDto,
    userId: string,
    files: Express.Multer.File[],
  ): Promise<PaginationResult<Product>> {
    const imagePaths: string[] = [];

    // Validation du categoryId
    if (!dto.categoryId) {
      throw new BadRequestException(
        'categoryId invalide. Doit être un ID MongoDB valide (24 caractères hexadécimaux).',
      );
    }

    // Validation du userId
    if (!userId) {
      throw new BadRequestException('Utilisateur invalide ou non authentifié.');
    }

    // 1. Vérification proactive des doublons pour cet utilisateur
    const existingProduct = await this.productModel.findOne({
      productOwnerId: new Types.ObjectId(userId),
      codeCPC: dto.codeCPC,
      productName: dto.productName,
    });

    if (existingProduct) {
      throw new BadRequestException(
        `Vous possédez déjà un produit nommé "${dto.productName}" avec le code CPC ${dto.codeCPC}.`,
      );
    }

    // Gestion des uploads via UploadService
    if (files && files.length > 0) {
      for (const file of files) {
        const publicUrl = await this.uploadService.saveFile(file, 'products');
        imagePaths.push(publicUrl);
      }
    }

    const newProduct = new this.productModel({
      ...dto,
      productOwnerId: new Types.ObjectId(userId),
      categoryId: new Types.ObjectId(dto.categoryId),
      productImage: imagePaths,
      isStocker: false, // Condition imposée
      productValidation: false,
    });

    const saved = await newProduct.save();

    // Audit Log
    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: EntityType.PRODUCT,
      entityId: saved._id.toString(),
      userId,
      newState: saved.toObject(),
    });

    return {
      status: 'success',
      message: 'Produit créé avec succès. En attente de mise en stock.',
      data: [saved],
    };
  }

  /**
   * Lister les produits (Paginer)
   */
  async findAll(
    query: any,
    userId: string,
  ): Promise<PaginationResult<Product>> {
    const { page = 1, limit = 10, search, isStocker } = query;
    const filter: any = {};

    if (userId) {
      filter.productOwnerId = new Types.ObjectId(userId);
    }

    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { codeCPC: { $regex: search, $options: 'i' } },
      ];
    }
    if (isStocker !== undefined) filter.isStocker = isStocker === 'true';

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      this.productModel
        .find(filter)
        .populate('categoryId')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Liste récupérée',
      data,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Valider un produit (Admin)
   */
  async validateProduct(
    id: string,
    userId: string,
  ): Promise<PaginationResult<Product>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de produit invalide.');
    }

    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produit introuvable');

    product.productValidation = true;
    await product.save();

    return {
      status: 'success',
      message: 'Produit validé',
      data: [product],
    };
  }

  /**
   * Inverser le statut de stockage
   */
  async toggleStock(
    id: string,
    userId: string,
  ): Promise<PaginationResult<Product>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de produit invalide.');
    }

    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produit introuvable');

    const previousState = product.isStocker;
    product.isStocker = !previousState;
    await product.save();

    await this.auditService.log({
      action: AuditAction.UPDATE,
      entityType: EntityType.PRODUCT,
      entityId: id,
      userId,
    });

    return {
      status: 'success',
      message: product.isStocker
        ? 'Produit mis en stock'
        : 'Produit retiré du stock',
      data: [product],
    };
  }

  /**
   * Supprimer un produit
   */
  async delete(id: string, userId: string): Promise<PaginationResult<null>> {
    const product = await this.productModel.findByIdAndDelete(id);
    if (!product) throw new NotFoundException('Produit introuvable');

    return { status: 'success', message: 'Produit supprimé', data: null };
  }
}
