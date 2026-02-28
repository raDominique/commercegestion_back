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
    const siteOrigine = await this.siteService.findOne(dto.siteOrigineId);
    const siteDest = await this.siteService.findOne(dto.siteDestinationId);
    const userBId = siteDest.siteUserID.toString(); // Le propriétaire du site cible

    // --- LOGIQUE DEPOT ---
    if (type === MovementType.DEPOT) {
      // Situation : Je dépose chez moi. Détenteur = Moi, Ayant-droit = Moi.
      await this.actifsService.addOrIncreaseActif(
        userId,
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
        dto.prixUnitaire,
        userId,
        userId,
      );
    }

    // --- LOGIQUE RETRAIT (Transfert Physique) ---
    else if (type === MovementType.RETRAIT) {
      // 1. Sortie de mon stock physique (où je suis ayant-droit)
      await this.actifsService.decreaseActif(
        userId,
        dto.siteOrigineId,
        dto.productId,
        dto.quantite,
        userId,
      );

      // 2. Création d'un passif (trace de sortie)
      await this.passifsService.addOrIncreasePassif(
        userId,
        dto.siteOrigineId,
        dto.productId,
        dto.quantite,
        'Transfert vers tiers',
        userId,
      );

      // 3. Entrée chez User B : Il est DETENTAIRE, mais JE reste AYANT-DROIT
      await this.actifsService.addOrIncreaseActif(
        userBId,
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
        dto.prixUnitaire,
        userBId,
        userId,
      );
    }

    // --- LOGIQUE VIREMENT (Cession de Propriété) ---
    else if (type === MovementType.VIREMENT) {
      // Situation : Le produit est déjà chez User B. Je lui cède la propriété.
      // On change l'ayant-droit de Moi -> User B sur le site de User B.
      await this.actifsService.updateProperty(
        userBId,
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
        userId,
        userBId,
      );
    }

    // Enregistrement du journal
    const movement = new this.movementModel({
      ...dto,
      operatorId: new Types.ObjectId(userId),
      type: type,
      depotOrigine: siteOrigine.siteName,
      depotDestination: siteDest.siteName,
    });

    return await movement.save();
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
