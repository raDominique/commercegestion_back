import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductService } from '../products/products.service';
import { SiteService } from '../sites/sites.service';
import { ActifsService } from '../actifs/actifs.service';
import { PassifsService } from '../passifs/passifs.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import {
  StockMovement,
  StockMovementDocument,
  MovementType,
} from './stock-movement.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(StockMovement.name)
    private readonly movementModel: Model<StockMovementDocument>,
    private readonly productService: ProductService,
    private readonly siteService: SiteService,
    private readonly actifsService: ActifsService,
    private readonly passifsService: PassifsService,
  ) {}

  async createMovement(
    dto: CreateMovementDto,
    userId: string,
    type: MovementType,
  ) {
    // 1. Vérifier l'existence du produit (via ProductService)
    const product = await this.productService.findOneRaw(dto.productId);

    // 2. RÈGLE : Validation Admin requise
    if (!product.productValidation) {
      throw new BadRequestException("Produit non validé par l'admin.");
    }

    // 3. Vérifier que les sites existent (via SiteService)
    const siteOrigine = await this.siteService.findOne(dto.siteOrigineId);
    const siteDest = await this.siteService.findOne(dto.siteDestinationId);

    // 4. Création du mouvement
    const movement = new this.movementModel({
      operatorId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(dto.productId),
      depotOrigine: siteOrigine.siteName,
      depotDestination: siteDest.siteName,
      siteOrigineId: siteOrigine._id,
      siteDestinationId: siteDest._id,
      quantite: dto.quantite,
      prixUnitaire: dto.prixUnitaire,
      type: type,
      observations: dto.observations,
    });

    const saved = await movement.save();

    // 5. GESTION DES ACTIFS/PASSIFS
    if (type === MovementType.DEPOT) {
      // DEPOT : Augmenter les actifs du site de destination
      await this.actifsService.addOrIncreaseActif(
        userId,
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
      );

      // Marquer le produit comme stocké si ce n'est pas déjà fait
      if (!product.isStocker) {
        await this.productService.setStockStatus(dto.productId, true);
      }
    } else if (type === MovementType.RETRAIT) {
      // RETRAIT :
      // 1. Réduire les actifs du site d'origine
      await this.actifsService.decreaseActif(
        userId,
        dto.siteOrigineId,
        dto.productId,
        dto.quantite,
      );
      // 2. Augmenter les passifs du site d'origine
      await this.passifsService.addOrIncreasePassif(
        userId,
        dto.siteOrigineId,
        dto.productId,
        dto.quantite,
        'Retrait',
      );
    }

    return {
      status: 'success',
      message: `Opération de ${type} effectuée sur le site ${siteDest.siteName}`,
      data: saved,
    };
  }

  async getHistory(userId: string) {
    return this.movementModel
      .find({ operatorId: new Types.ObjectId(userId) })
      .populate('productId', 'productName codeCPC')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Construire un filtre pour les mouvements
   */
  private buildMovementFilter(
    userId: string,
    query: any,
    movementType?: MovementType,
  ) {
    const filter: any = { operatorId: new Types.ObjectId(userId) };

    if (movementType) {
      filter.type = movementType;
    }

    const { siteId, productId, startDate, endDate } = query;

    if (siteId) {
      filter.$or = [
        { siteOrigineId: new Types.ObjectId(siteId) },
        { siteDestinationId: new Types.ObjectId(siteId) },
      ];
    }

    if (productId) filter.productId = new Types.ObjectId(productId);

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    return filter;
  }

  /**
   * Agrégation des soldes par type de mouvement
   */
  private aggregateMovements(userId: string, movementType: MovementType) {
    return this.movementModel.aggregate([
      { $match: { operatorId: new Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$productId',
          solde: {
            $sum: {
              $cond: [
                { $eq: ['$type', movementType] },
                '$quantite',
                { $multiply: ['$quantite', -1] },
              ],
            },
          },
        },
      },
    ]);
  }

  /**
   * Récupérer les actifs/passifs d'un utilisateur
   */
  private async getMovements(
    userId: string,
    query: any,
    movementType: MovementType,
  ): Promise<PaginationResult<any>> {
    const { page = 1, limit = 10 } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const filter = this.buildMovementFilter(userId, query, movementType);

    const [movements, total, aggregateStock] = await Promise.all([
      this.movementModel
        .find(filter)
        .populate(
          'operatorId',
          'userNickName userName userFirstname userPhone userImage',
        )
        .populate('siteOrigineId', 'siteName siteAddress')
        .populate('siteDestinationId', 'siteName siteAddress')
        .populate('productId', 'productName codeCPC productImage prixUnitaire')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.movementModel.countDocuments(filter),
      this.aggregateMovements(userId, movementType),
    ]);

    return {
      status: 'success',
      message:
        movementType === MovementType.DEPOT
          ? 'Actifs récupérés'
          : 'Passifs récupérés',
      data: movements,
      summary: aggregateStock,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Récupérer les actifs d'un utilisateur pour un site spécifique
   * Directement depuis la table des actifs
   */
  async getSiteActifs(userId: string, siteId: string) {
    return this.actifsService.getActifsByUserAndSite(userId, siteId);
  }

  /**
   * Récupérer les passifs d'un utilisateur pour un site spécifique
   * Directement depuis la table des passifs
   */
  async getSitePassifs(userId: string, siteId: string) {
    return this.passifsService.getPassifsByUserAndSite(userId, siteId);
  }

  /**
   * Récupérer tous les actifs d'un utilisateur
   */
  async getMyAssets(
    userId: string,
    query: any,
  ): Promise<PaginationResult<any>> {
    return this.getMovements(userId, query, MovementType.DEPOT);
  }

  /**
   * Récupérer tous les passifs d'un utilisateur
   */
  async getMyPassifs(
    userId: string,
    query: any,
  ): Promise<PaginationResult<any>> {
    const result = await this.getMovements(userId, query, MovementType.RETRAIT);

    return {
      status: result.status,
      message: 'Passifs récupérés',
      data: (result.data || []).map((movement: any) => ({
        date: movement.createdAt,
        situation: movement.productId?.productName || 'N/A',
        type: movement.type,
        montant: movement.quantite * movement.prixUnitaire,
        departDe: movement.depotOrigine,
        arrivee: movement.depotDestination,
        action: movement.observations || '-',
      })),
      summary: result.summary,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }
}
