import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './products.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UploadService } from 'src/shared/upload/upload.service';
import { AuditService } from 'src/v1/audit/audit.service';
import { AuditAction, EntityType } from 'src/v1/audit/audit-log.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';
import { NotificationsService } from 'src/shared/notifications/notifications.service';
import { MailService } from 'src/shared/mail/mail.service';
import { UsersService } from 'src/v1/users/users.service';
import { ExportService, ExportResult } from '../../shared/export/export.service';
import { CpcProduct } from '../cpc/cpc.schema';
import { BulkCreateProductDto } from './dto/bulk-create-product.dto';
import { BulkFakeProductDto } from './dto/bulk-fake-product.dto';
import { faker } from '@faker-js/faker';
import { Readable } from 'node:stream';
import * as path from 'node:path';

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(CpcProduct.name)
    private readonly cpcModel: Model<CpcProduct>,
    private readonly uploadService: UploadService,
    private readonly auditService: AuditService,
    private readonly socketNotifications: NotificationsService,
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    private readonly exportService: ExportService,
  ) {}

  async bulkCreateFake(
    dto: BulkFakeProductDto,
    authUserId?: string,
  ): Promise<PaginationResult<Product>> {
    const { count } = dto;
    const ownerId = dto.ownerId || authUserId;

    if (!ownerId) {
      throw new BadRequestException(
        'Aucun propriétaire spécifié. Connectez-vous ou fournissez un ownerId.',
      );
    }

    const cpcList = await this.cpcModel.find().exec();
    if (!cpcList.length) {
      throw new BadRequestException('Aucune catégorie CPC trouvée dans la base.');
    }

    const created: Product[] = [];

    for (let i = 0; i < count; i++) {
      const cpc = cpcList[Math.floor(Math.random() * cpcList.length)];

      const productName = `${cpc.nom} - ${faker.commerce.productName()}`;
      const productDescription = faker.commerce.productDescription();

      let imagePath = '';
      try {
        const response = await fetch(
          `https://picsum.photos/seed/${Date.now()}_${i}/1024/1024`,
        );
        const buffer = Buffer.from(await response.arrayBuffer());
        const mockFile: Express.Multer.File = {
          buffer,
          originalname: `product_${i}.jpg`,
          mimetype: 'image/jpeg',
          fieldname: 'image',
          encoding: '7bit',
          size: buffer.length,
          stream: null as any,
          destination: '',
          filename: '',
          path: '',
        };
        imagePath = await this.uploadService.saveFile(mockFile, 'products');
      } catch {
        // Silent — proceed without image
      }

      const product = new this.productModel({
        codeCPC: cpc.code,
        productName,
        productDescription,
        categoryId: cpc._id,
        productCategory: cpc.nom,
        productImage: imagePath,
        productOwnerId: new Types.ObjectId(ownerId),
        productVolume: `${faker.number.int({ min: 10, max: 10000 })} L`,
        productHauteur: `${faker.number.int({ min: 10, max: 200 })} cm`,
        productLargeur: `${faker.number.int({ min: 10, max: 200 })} cm`,
        productLongueur: `${faker.number.int({ min: 10, max: 200 })} cm`,
        productPoids: `${faker.number.int({ min: 1, max: 5000 })} kg`,
        productValidation: false,
        isStocker: false,
      });

      const saved = await product.save();
      created.push(saved);
    }

    return {
      status: 'success',
      message: `${created.length} produits factices créés avec succès.`,
      data: created,
    };
  }

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

    // Notification automatique aux Administrateurs
    await this.socketNotifications.notifyAllAdmins(
      'Nouveau produit à valider',
      `Le produit "${saved.productName}" a été créé et nécessite une validation admin.`,
      { productId: saved._id, ownerId: userId },
    );

    // Envoyer mail au utilisateur pour le notifier que le produit a été créé et est en attente de validation
    try {
      const userResult = await this.usersService.findOne(userId);
      if (userResult?.data?.[0]) {
        const user = userResult.data[0];
        await this.mailService.notificationProductCreated(
          user.userEmail,
          user.userName,
          saved.productName,
        );
      }
    } catch (error) {
      // Si l'envoi du mail échoue, on continue quand même sans lever d'erreur
      console.error(
        "Erreur lors de l'envoi du mail de notification produit:",
        error,
      );
    }

    return {
      status: 'success',
      message: 'Produit créé avec succès.',
      data: [saved],
    };
  }

  /**
   * CRÉATION EN MASSE (BULK)
   * Endpoint dédié au remplissage de fausses données.
   * - Valide que chaque codeCPC correspond à un CPC existant
   * - Télécharge l'image depuis une URL en ligne
   * - Ignore la logique métier (doublons, audit, notifications, emails)
   */
  async bulkCreate(
    dto: BulkCreateProductDto,
    userId: string,
  ) {
    if (!userId) throw new BadRequestException('Utilisateur non identifié.');

    const created: Product[] = [];
    const errors: { index: number; reason: string }[] = [];

    for (let i = 0; i < dto.items.length; i++) {
      const item = dto.items[i];
      try {
        const cpc = await this.cpcModel.findOne({ code: item.codeCPC });
        if (!cpc) {
          errors.push({ index: i, reason: `Code CPC "${item.codeCPC}" introuvable` });
          continue;
        }

        let imagePath = '';
        if (item.imageUrl) {
          imagePath = await this.downloadAndSaveImage(item.imageUrl);
        }

        const newProduct = new this.productModel({
          codeCPC: item.codeCPC,
          productName: item.productName,
          productDescription: item.productDescription,
          categoryId: cpc._id,
          productCategory: item.productCategory || cpc.nom,
          productImage: imagePath,
          productOwnerId: new Types.ObjectId(userId),
          productVolume: item.productVolume,
          productHauteur: item.productHauteur,
          productLargeur: item.productLargeur,
          productLongueur: item.productLongueur,
          productPoids: item.productPoids,
          isStocker: false,
          productValidation: false,
        });

        const saved = await newProduct.save();
        created.push(saved);
      } catch (error) {
        errors.push({ index: i, reason: error.message });
      }
    }

    return {
      status: errors.length === 0 ? 'success' : 'partial_success',
      message: `${created.length} produit(s) créé(s), ${errors.length} erreur(s)`,
      data: created,
      ...(errors.length > 0 && { errors }),
    };
  }

  private async downloadAndSaveImage(imageUrl: string): Promise<string> {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(
        `Téléchargement échoué (${response.status}): ${response.statusText}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const urlPath = new URL(imageUrl).pathname;
    const originalName = path.basename(urlPath) || 'image.jpg';
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    const fakeFile: Express.Multer.File = {
      buffer,
      originalname: originalName,
      mimetype: mimeType,
      size: buffer.length,
      fieldname: 'image',
      encoding: '7bit',
      stream: null as any,
      destination: '',
      filename: originalName,
      path: '',
    };

    return this.uploadService.saveFile(fakeFile, 'products');
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

    if (dto.codeCPC) {
      product.codeCPC = dto.codeCPC;
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

    // 6. Envoyer email de notification au propriétaire
    try {
      const userResult = await this.usersService.findOne(userId);
      if (userResult?.data?.[0]) {
        const user = userResult.data[0];
        await this.mailService.notificationProductUpdated(
          user.userEmail,
          user.userName,
          updated.productName,
        );
      }
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi du mail de mise à jour du produit:",
        error,
      );
    }

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
   * Tri : Hors stock d'abord, puis par date de création (récent d'abord)
   */
  async findAll(
    query: any,
    userId?: string,
    isAdmin?: boolean,
  ): Promise<PaginationResult<any>> {
    const { page = 1, limit = 10, search, isStocker, validation } = query;
    const filter: any = {};

    // Filtrage par propriétaire si non-admin
    if (userId && !isAdmin) {
      filter.productOwnerId = new Types.ObjectId(userId);
    }

    // Recherche textuelle
    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { codeCPC: { $regex: search, $options: 'i' } },
      ];
    }

    // Filtre spécifique sur le statut de stockage
    if (isStocker !== undefined) {
      filter.isStocker =
        isStocker === 'true' ||
        isStocker === true ||
        isStocker === '1' ||
        isStocker === 1;
    }

    // Filtre spécifique sur le statut de validation
    if (validation !== undefined) {
      filter.productValidation =
        validation === 'true' ||
        validation === true ||
        validation === '1' ||
        validation === 1;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      this.productModel
        .find(filter)
        .populate('categoryId', 'nom')
        .populate('productOwnerId', 'userName userFirstname userNickName')
        .select(
          '_id productImage productName productValidation isStocker categoryId productOwnerId codeCPC createdAt',
        )
        // ==========================================
        // LOGIQUE DE TRI MULTIPLE
        // 1. isStocker: 1 -> false (0) avant true (1)
        // 2. createdAt: -1 -> plus récent d'abord au sein de chaque groupe
        // ==========================================
        .sort({ isStocker: 1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Liste récupérée',
      data: this.formatProductResponse(data),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }
  /**
   * Basculer l'état de validation d'un produit (Admin)
   * Une fois validé, un produit ne peut plus être désactivé
   */
  async toggleProductValidation(
    id: string,
  ): Promise<PaginationResult<Product>> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID invalide.');

    const product = await this.productModel
      .findById(id)
      .populate('productOwnerId');
    if (!product) throw new NotFoundException('Produit introuvable');

    // Empêcher la désactivation d'un produit déjà validé
    if (product.productValidation === true) {
      throw new BadRequestException(
        'Ce produit a été validé et ne peut plus être désactivé.',
      );
    }

    product.productValidation = !product.productValidation;
    await product.save();

    // Notifier l'utilisateur que son produit est validé
    if (product.productValidation) {
      // Notification socket
      await this.socketNotifications.notifyUser(
        product.productOwnerId._id.toString(),
        'Produit Validé !',
        `Votre produit "${product.productName}" a été validé par l'administration.`,
      );

      // Envoi du mail de validation au propriétaire du produit
      try {
        const owner = product.productOwnerId as any;
        if (owner?.userEmail) {
          await this.mailService.notificationProductValidated(
            owner.userEmail,
            owner.userName,
            product.productName,
          );
        }
      } catch (error) {
        console.error(
          "Erreur lors de l'envoi du mail de validation du produit:",
          error,
        );
      }
    }

    return {
      status: 'success',
      message: product.productValidation
        ? 'Produit validé'
        : 'Validation retirée',
      data: [product],
    };
  }
  /**
   * Valider tous les produits non validés
   */
  async validateAll(): Promise<{
    status: string;
    message: string;
    validatedCount: number;
  }> {
    const unvalidated = await this.productModel
      .find({ productValidation: false })
      .populate('productOwnerId')
      .exec();

    if (!unvalidated.length) {
      return {
        status: 'success',
        message: 'Tous les produits sont déjà validés.',
        validatedCount: 0,
      };
    }

    const seenOwners = new Set<string>();

    for (const product of unvalidated) {
      product.productValidation = true;
      await product.save();

      const owner = product.productOwnerId as any;
      const ownerId = owner?._id?.toString();

      if (ownerId && !seenOwners.has(ownerId)) {
        seenOwners.add(ownerId);
        const count = unvalidated.filter(
          (p) => (p.productOwnerId as any)?._id?.toString() === ownerId,
        ).length;

        await this.socketNotifications.notifyUser(
          ownerId,
          'Produits Validés !',
          `${count} de vos produits ont été validés par l'administration.`,
        );
      }
    }

    return {
      status: 'success',
      message: `${unvalidated.length} produit(s) validé(s) avec succès.`,
      validatedCount: unvalidated.length,
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
    // 1. Récupérer le produit avant suppression (pour obtenir le nom et envoyer email)
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produit introuvable');

    // 2. Supprimer le produit
    await this.productModel.findByIdAndDelete(id);

    // 3. Audit Log
    await this.auditService.log({
      action: AuditAction.DELETE,
      entityType: EntityType.PRODUCT,
      entityId: id,
      userId,
    });

    // 4. Envoyer email de notification au propriétaire
    try {
      const userResult = await this.usersService.findOne(userId);
      if (userResult?.data?.[0]) {
        const user = userResult.data[0];
        await this.mailService.notificationProductDeleted(
          user.userEmail,
          user.userName,
          product.productName,
        );
      }
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi du mail de suppression du produit:",
        error,
      );
    }

    return { status: 'success', message: 'Produit supprimé', data: null };
  }

  /**
   * UTILITAIRE : Formate un ou plusieurs produits pour la réponse API
   */
  private formatProductResponse(products: any[]): any[] {
    return products.map((product) => {
      const obj = product.toObject ? product.toObject() : product;

      // Construction propre du nom du propriétaire
      const owner = obj.productOwnerId;
      const ownerName =
        owner && typeof owner === 'object'
          ? `${owner.userName || ''} ${owner.userFirstname || ''}`.trim() ||
            owner.userNickName
          : 'Inconnu';

      return {
        _id: obj._id,
        image: obj.productImage,
        name: obj.productName,
        categoryNom: obj.categoryId?.nom || null,
        ownerName: ownerName,
        ownerNickName: owner?.userNickName || null,
        validation: obj.productValidation,
        isStocker: obj.isStocker,
        codeCPC: obj.codeCPC, // Ajouté pour plus de contexte
      };
    });
  }

  /**
   * Version interne pour forcer le statut de stockage sans vérification de propriété
   * (Utilisé par StockService lors d'un dépôt)
   */
  async setStockStatus(productId: string, status: boolean): Promise<void> {
    await this.productModel.findByIdAndUpdate(productId, { isStocker: status });
  }

  /**
   * Version améliorée de findById pour retourner l'objet Document brut si nécessaire
   * ou simplement s'assurer qu'on récupère les data correctement.
   */
  async findOneRaw(id: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(id);
    if (!product) throw new NotFoundException('Produit introuvable');
    return product;
  }

  /**
   * Recuperer tous les produits activer pour afficher dans la boutique avec pagination, limit, tri et filter
   */
  async getActiveProducts(query: any = {}): Promise<PaginationResult<Product>> {
    const {
      page = 1,
      limit = 10,
      search,
      sort = 'createdAt',
      order = -1,
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    // Uniquement les produits validés et physiquement en stock
    const filter: any = { isStocker: true, productValidation: true };

    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { codeCPC: { $regex: search, $options: 'i' } },
      ];
    }

    const sortQuery: Record<string, any> = { [sort]: Number(order) };

    const [data, total] = await Promise.all([
      this.productModel
        .find(filter)
        .populate('categoryId', 'nom')
        .populate('productOwnerId', 'userName userFirstname userNickName')
        // AJOUT DES CHAMPS MANQUANTS POUR LA BOUTIQUE
        .select(
          'productImage productName productDescription categoryId productOwnerId codeCPC productVolume productPoids createdAt',
        )
        .sort(sortQuery)
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Produits actifs récupérés',
      data: this.formatProductResponse(data),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Récupère les IDs des produits correspondant à un nom (pour la recherche dans les actifs)
   * Permet de faire le lien entre les produits validés et les actifs disponibles en stock
   */
  async findIdsByName(search: string): Promise<Types.ObjectId[]> {
    const regex = { $regex: search, $options: 'i' };
    const products = await this.productModel
      .find({ $or: [{ productName: regex }, { codeCPC: regex }] })
      .select('_id')
      .lean()
      .exec();

    return products.map((p) => p._id);
  }

  /**
   * Récupère les IDs des produits validés par l'admin, avec option de filtrage par nom
   */
  async findValidatedIds(name?: string) {
    const filter: any = { productValidation: true };
    if (name) filter.productName = { $regex: name, $options: 'i' };

    const products = await this.productModel.find(filter).select('_id').lean();
    return products.map((p) => p._id);
  }

  /**
   * Récupère les IDs des produits validés par l'admin, avec option de filtrage par nom et code CPC
   */
  async findValidatedIdsByFilter(productFilter, productSort) {
    return this.productModel
      .find(productFilter)
      .sort(productSort)
      .distinct('_id');
  }
  // Mise à jour du status produit isStocker === true
  async updateIsStocker(productId, isStocker) {
    const product = await this.productModel.findById(
      new Types.ObjectId(productId),
    );
    if (!product) {
      throw new NotFoundException('Produit introuvable');
    }
    product.isStocker = isStocker;
    await product.save();
  }

  async getSelectProducts(query: any): Promise<PaginationResult<any>> {
    const { search } = query;
    const filter: any = { productValidation: true };
    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { codeCPC: { $regex: search, $options: 'i' } },
      ];
    }

    const data = await this.productModel
      .find(filter)
      .populate('categoryId', 'nom')
      .select(
        '_id productImage productName categoryId codeCPC createdAt',
      )
      .sort({ productName: 1 })
      .exec();
    return {
      status: 'success',
      message: 'Liste des produits validés récupérée',
      data: data.map((product) => ({
        _id: product._id,
        productImage: product.productImage,
        productName: product.productName,
        categoryNom: product.categoryId?.toJSON()?.nom || null,
        codeCPC: product.codeCPC,
      })),
    };
  }

  async exportAll(format: 'excel' | 'pdf', userId?: string): Promise<ExportResult> {
    const items = await this.productModel.find().sort({ createdAt: -1 }).lean().exec();

    if (!items.length) {
      throw new NotFoundException('Aucune donnée à exporter');
    }

    const columns = [
      { header: 'ID', key: '_id' },
      { header: 'Nom', key: 'productName' },
      { header: 'Code CPC', key: 'codeCPC' },
      { header: 'En stock', key: 'isStocker' },
      { header: 'Validé', key: 'productValidation' },
      { header: 'Créé le', key: 'createdAt' },
    ];

    if (format === 'excel') {
      return this.exportService.exportExcel(items, columns, 'Produits', `export_products_${Date.now()}.xlsx`);
    }
    return this.exportService.exportPDF(
      'Liste des Produits',
      columns.map(c => c.header),
      items.map(item => columns.map(c => item[c.key] ?? '')),
      `export_products_${Date.now()}.pdf`,
    );
  }
}
