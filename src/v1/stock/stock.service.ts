import { Injectable } from '@nestjs/common';
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
import { LoggerService } from 'src/common/logger/logger.service';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(StockMovement.name)
    private readonly movementModel: Model<StockMovementDocument>,
    private readonly productService: ProductService,
    private readonly siteService: SiteService,
    private readonly actifsService: ActifsService,
    private readonly passifsService: PassifsService,
    private readonly loggerService: LoggerService,
  ) {}

  async createMovement(
    dto: CreateMovementDto,
    userId: string,
    type: MovementType,
  ) {
    this.validateMovement(dto, type);

    const siteOrigine = dto.siteOrigineId
      ? await this.siteService.findOne(dto.siteOrigineId)
      : null;
    const siteDest = await this.siteService.findOne(dto.siteDestinationId);
    // 1. On récupère l'ID, que ce soit un objet peuplé ou juste l'ID
    const siteDestOwnerId = siteDest.siteUserID._id
      ? siteDest.siteUserID._id.toString()
      : siteDest.siteUserID.toString();

    const detentaireId = dto.detentaire
      ? new Types.ObjectId(dto.detentaire)
      : null;
    this.loggerService.debug(
      'Bootsrap debug',
      `DEBUG DETENTAIRES: ${detentaireId}, AYANT-DROIT: ${dto.ayant_droit}`,
    );
    const ayantDroitId = dto.ayant_droit
      ? new Types.ObjectId(dto.ayant_droit)
      : null;

    await this.processMovementByType(
      dto,
      userId,
      type,
      siteOrigine,
      siteDestOwnerId,
    );
    // Enregistrement du mouvement
    const movement = new this.movementModel({
      operatorId: new Types.ObjectId(userId),
      type: type.toUpperCase() as any,
      productId: new Types.ObjectId(dto.productId),
      quantite: dto.quantite,
      prixUnitaire: dto.prixUnitaire,

      // Utilise les IDs strings, Mongoose fera la conversion
      siteOrigineId: dto.siteOrigineId
        ? new Types.ObjectId(dto.siteOrigineId)
        : null,
      siteDestinationId: new Types.ObjectId(dto.siteDestinationId),

      // Si virement, on enregistre les acteurs
      ayant_droit: ayantDroitId,
      detentaire: detentaireId,

      // Champs virtuels ou additionnels selon ton schéma (attention aux noms)
      depotOrigine: siteOrigine?.siteName || 'EXTERIEUR',
      depotDestination: siteDest.siteName,
    });

    const savedMovement = await movement.save();

    // Mise à jour du status produit isStocker === true
    await this.productService.updateIsStocker(dto.productId, true);
    return savedMovement;
  }

  private validateMovement(dto: CreateMovementDto, type: MovementType): void {
    if (
      dto.siteOrigineId &&
      dto.siteDestinationId &&
      dto.siteOrigineId === dto.siteDestinationId
    ) {
      throw new Error(
        "Le site d'origine et le site de destination ne peuvent pas être les mêmes.",
      );
    }

    if (dto.siteOrigineId === null && type !== MovementType.DEPOT) {
      throw new Error(
        "Le site d'origine ne peut être null que pour un dépôt initial.",
      );
    }
  }

  private async processMovementByType(
    dto: CreateMovementDto,
    userId: string,
    type: MovementType,
    siteOrigine: any,
    siteDestOwnerId: string,
  ): Promise<void> {
    if (type === MovementType.DEPOT) {
      await this.processDepot(dto, userId, siteDestOwnerId);
    } else if (
      type === MovementType.TRANSFERT ||
      type === MovementType.RETRAIT
    ) {
      await this.processTransferOrWithdraw(
        dto,
        userId,
        siteOrigine,
        siteDestOwnerId,
      );
    } else if (type === MovementType.VIREMENT) {
      await this.processVirement(dto, userId, siteDestOwnerId);
    }
  }

  private async processDepot(
    dto: CreateMovementDto,
    userId: string,
    siteDestOwnerId: string,
  ): Promise<void> {
    await this.actifsService.addOrIncreaseActif(
      userId,
      dto.siteDestinationId,
      dto.productId,
      dto.quantite,
      dto.prixUnitaire,
      siteDestOwnerId,
      userId,
    );

    if (userId !== siteDestOwnerId) {
      await this.passifsService.addOrIncreasePassif(
        siteDestOwnerId,
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
        userId,
      );
    }
  }
  private async processTransferOrWithdraw(
    dto: CreateMovementDto,
    userId: string,
    siteOrigine: any,
    siteDestOwnerId: string,
  ): Promise<void> {
    if (!dto.siteOrigineId) {
      throw new Error("Le site d'origine est requis.");
    }

    // 1. Sortie de l'actif
    await this.actifsService.decreaseActif(
      userId,
      dto.siteOrigineId,
      dto.productId,
      dto.quantite,
    );

    // 2. Diminution du passif chez le gestionnaire du site d'origine
    if (siteOrigine?.siteUserID) {
      const siteOrigineOwnerId = siteOrigine.siteUserID._id
        ? siteOrigine.siteUserID._id.toString()
        : siteOrigine.siteUserID.toString();

      // Si le proprio de la marchandise n'est pas le proprio du hangar,
      // le hangar a une dette (passif) qui diminue.
      if (userId !== siteOrigineOwnerId) {
        await this.passifsService.decreasePassif(
          siteOrigineOwnerId,
          dto.productId,
          dto.quantite,
        );
      }
    }

    // 3. Cas du TRANSFERT (si on déplace vers un autre site)
    if (MovementType.TRANSFERT) {
      await this.actifsService.addOrIncreaseActif(
        userId,
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
        dto.prixUnitaire,
        siteDestOwnerId,
        userId,
      );

      if (userId !== siteDestOwnerId) {
        await this.passifsService.addOrIncreasePassif(
          siteDestOwnerId,
          dto.siteDestinationId,
          dto.productId,
          dto.quantite,
          userId,
        );
      }
    }
  }

  private async processVirement(
    dto: CreateMovementDto,
    userId: string,
    siteDestOwnerId: string,
  ): Promise<void> {
    const ancienProprietaire = userId;
    const nouveauProprietaire = dto.ayant_droit;

    if (!nouveauProprietaire) {
      throw new Error(
        "L'identifiant du nouvel ayant-droit est requis pour un virement.",
      );
    }

    await this.actifsService.decreaseActif(
      ancienProprietaire,
      dto.siteDestinationId,
      dto.productId,
      dto.quantite,
    );

    await this.actifsService.addOrIncreaseActif(
      nouveauProprietaire,
      dto.siteDestinationId,
      dto.productId,
      dto.quantite,
      dto.prixUnitaire,
      siteDestOwnerId,
      nouveauProprietaire,
    );

    await this.passifsService.updateCreancier(
      siteDestOwnerId,
      dto.productId,
      dto.quantite,
      ancienProprietaire,
      nouveauProprietaire,
    );
  }

  async getHistory(userId: string): Promise<PaginationResult<any>> {
    const history = await this.movementModel
      .find({ operatorId: new Types.ObjectId(userId) })
      .populate('productId', 'productName codeCPC')
      .sort({ createdAt: -1 })
      .exec();

    return {
      status: 'success',
      message: 'Historique des mouvements récupéré',
      data: history,
    };
  }

  /**
   * Construire un filtre pour les mouvements
   * NOTE: Cette méthode est maintenant asynchrone pour gérer la recherche de produits
   */
  private async buildMovementFilter(
    userId: string,
    query: any,
    movementType?: MovementType,
  ) {
    const filter: any = { operatorId: new Types.ObjectId(userId) };

    if (movementType) {
      filter.type = movementType;
    }

    const { siteId, productName, startDate, endDate } = query;

    if (siteId) {
      filter.$or = [
        { siteOrigineId: new Types.ObjectId(siteId) },
        { siteDestinationId: new Types.ObjectId(siteId) },
      ];
    }

    if (productName) {
      // 1. On cherche les IDs des produits qui correspondent au nom via le ProductService
      const productIds = await this.productService.findIdsByName(productName);

      // 2. On filtre les mouvements dont le productId est dans cette liste
      filter.productId = { $in: productIds };
    }

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

    const filter = await this.buildMovementFilter(userId, query, movementType);

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
        .populate(
          'ayant_droit',
          'userNickName userName userFirstname userPhone userImage',
        )
        .populate(
          'detentaire',
          'userNickName userName userFirstname userPhone userImage',
        )
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
    return await this.getMovements(userId, query, MovementType.RETRAIT);
  }

  /**
   * Liste spécifique des dépôts (Entrées en stock)
   */
  async getDepositList(
    userId: string,
    query: any,
  ): Promise<PaginationResult<any>> {
    return this.getMovements(userId, query, MovementType.DEPOT);
  }

  /**
   * Liste spécifique des retraits (Sorties de stock)
   */
  async getWithdrawList(
    userId: string,
    query: any,
  ): Promise<PaginationResult<any>> {
    return this.getMovements(userId, query, MovementType.RETRAIT);
  }
}
