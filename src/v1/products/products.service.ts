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
   * CRÉER UN PRODUIT
   * Gère une image unique et empêche les doublons pour un même utilisateur
   */
  async create(
    dto: CreateProductDto,
    userId: string,
    file?: Express.Multer.File,
  ): Promise<PaginationResult<Product>> {
    // 1. Vérification de sécurité de base
    if (!userId) throw new BadRequestException('Utilisateur non identifié.');
    if (!dto.categoryId)
      throw new BadRequestException('La catégorie CPC est requise.');

    // 2. Vérification des doublons (Même nom + Même CPC pour cet utilisateur)
    const existing = await this.productModel.findOne({
      productOwnerId: new Types.ObjectId(userId),
      codeCPC: dto.codeCPC,
      productName: dto.productName,
    });

    if (existing) {
      throw new BadRequestException(
        `Vous avez déjà un produit "${dto.productName}" dans cette catégorie.`,
      );
    }

    // 3. Gestion de l'image unique
    let imagePath = '';
    if (file) {
      imagePath = await this.uploadService.saveFile(file, 'products');
    }

    // 4. Création
    const newProduct = new this.productModel({
      ...dto,
      productOwnerId: new Types.ObjectId(userId),
      categoryId: new Types.ObjectId(dto.categoryId),
      productImage: imagePath,
      isStocker: false,
      productValidation: false,
    });

    const saved = await newProduct.save();

    // 5. Audit Log
    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: EntityType.PRODUCT,
      entityId: saved._id.toString(),
      userId,
      newState: saved.toObject(),
    });

    return {
      status: 'success',
      message: 'Produit créé avec succès.',
      data: [saved],
    };
  }

  /**
   * METTRE À JOUR UN PRODUIT
   * Remplace l'image si une nouvelle est fournie
   */
  async update(
    id: string,
    dto: Partial<CreateProductDto>,
    userId: string,
    file?: Express.Multer.File,
  ): Promise<PaginationResult<Product>> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID invalide.');

    // 1. Vérifier l'existence et la propriété
    const product = await this.productModel.findOne({
      _id: new Types.ObjectId(id),
      productOwnerId: new Types.ObjectId(userId),
    });

    if (!product)
      throw new NotFoundException('Produit introuvable ou accès refusé.');

    const previousState = product.toObject();

    // 2. Vérifier les doublons si le nom ou le code change
    if (dto.productName || dto.codeCPC) {
      const duplicate = await this.productModel.findOne({
        _id: { $ne: new Types.ObjectId(id) },
        productOwnerId: new Types.ObjectId(userId),
        codeCPC: dto.codeCPC || product.codeCPC,
        productName: dto.productName || product.productName,
      });
      if (duplicate)
        throw new BadRequestException(
          'Un produit identique existe déjà dans votre liste.',
        );
    }

    // 3. Mise à jour de l'image (Remplacement)
    if (file) {
      product.productImage = await this.uploadService.saveFile(
        file,
        'products',
      );
    }

    // 4. Mise à jour des données
    if (dto.categoryId) product.categoryId = new Types.ObjectId(dto.categoryId);

    // Fusion des autres champs
    Object.assign(product, dto);

    const updated = await product.save();

    // 5. Audit Log
    await this.auditService.log({
      action: AuditAction.UPDATE,
      entityType: EntityType.PRODUCT,
      entityId: updated._id.toString(),
      userId,
      previousState,
      newState: updated.toObject(),
    });

    return {
      status: 'success',
      message: 'Produit mis à jour avec succès.',
      data: [updated],
    };
  }

  /**
   * Récupérer un produit par ID
   */
  async findById(
    id: string,
    userId?: string,
  ): Promise<PaginationResult<Product>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de produit invalide.');
    }

    const product = await this.productModel.findById(id).populate('categoryId');
    if (!product) throw new NotFoundException('Produit introuvable');

    return {
      status: 'success',
      message: 'Produit récupéré',
      data: [product],
    };
  }

  /**
   * Lister les produits (Paginer)
   */
  async findAll(query: any, userId: string): Promise<PaginationResult<any>> {
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
        .populate('categoryId', 'nom')
        .select(
          '_id productImage productName productValidation isStocker categoryId',
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    // Transformer les données pour le format attendu
    const formattedData = data.map((product: any) => {
      const obj = product.toObject();
      return {
        _id: obj._id,
        image: obj.productImage,
        name: obj.productName,
        categoryNom: obj.categoryId?.nom || null,
        validation: obj.productValidation,
        isStocker: obj.isStocker,
      };
    });

    return {
      status: 'success',
      message: 'Liste récupérée',
      data: formattedData,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }
  
  /**
   * Basculer l'état de validation d'un produit (Admin)
   * Inverse l'état : true -> false / false -> true
   */
  async toggleProductValidation(
    id: string,
  ): Promise<PaginationResult<Product>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de produit invalide.');
    }

    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produit introuvable');

    // --- LOGIQUE VISE-VERSA ---
    product.productValidation = !product.productValidation;
    await product.save();

    return {
      status: 'success',
      message: product.productValidation
        ? 'Produit validé avec succès'
        : 'Validation du produit retirée',
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

  /**
   * Recupérer les produits d'un utilisateur (pour le dashboard)
   */
  async getMyProducts(userId: string): Promise<PaginationResult<any>> {
    const products = await this.productModel
      .find({ productOwnerId: new Types.ObjectId(userId) })
      .populate('categoryId', 'nom')
      .select(
        '_id productImage productName productValidation isStocker categoryId',
      )
      .sort({ createdAt: -1 })
      .exec();

    const formattedData = products.map((product: any) => {
      const obj = product.toObject();
      return {
        _id: obj._id,
        image: obj.productImage,
        name: obj.productName,
        categoryNom: obj.categoryId?.nom || null,
        validation: obj.productValidation,
        isStocker: obj.isStocker,
      };
    });

    return {
      status: 'success',
      message: 'Produits récupérés',
      data: formattedData,
    };
  }
}
