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
    const siteOrigine = dto.siteOrigineId
      ? await this.siteService.findOne(dto.siteOrigineId)
      : null;
    const siteDest = await this.siteService.findOne(dto.siteDestinationId);

    // Le propriétaire du site cible (Le gestionnaire du hangar ou UserB)
    const siteDestOwnerId = siteDest.siteUserID.toString();

    // --- LOGIQUE DEPOT (Étape 0 du document) ---
    if (type === MovementType.DEPOT) {
      /**
       * Règle : Si je dépose chez un tiers (Hangar),
       * 1. J'augmente mon ACTIF (Ayant-droit = Moi, Détenteur = Hangar)
       * 2. J'augmente le PASSIF du Hangar (Il me doit la marchandise)
       */

      // 1. Mon Actif (Je suis l'ayant droit, le site est le détenteur)
      await this.actifsService.addOrIncreaseActif(
        userId, // Pour mon bilan
        dto.siteDestinationId, // Localisation
        dto.productId,
        dto.quantite,
        dto.prixUnitaire,
        siteDestOwnerId, // Détenteur actuel (Gestionnaire)
        userId, // Ayant-droit (Moi)
      );

      // 2. Le Passif du Gestionnaire (S'il n'est pas l'ayant-droit)
      if (userId !== siteDestOwnerId) {
        await this.passifsService.addOrIncreasePassif(
          siteDestOwnerId, // Le détenteur qui a une dette
          dto.siteDestinationId,
          dto.productId,
          dto.quantite,
          userId, // Créancier (Moi)
        );
      }
    }

    // --- LOGIQUE TRANSFERT / RETRAIT (Physique) ---
    else if (type === MovementType.TRANSFERT || type === MovementType.RETRAIT) {
      /**
       * Règle : Déplacement physique sans changement de propriété (Ayant-droit constant)
       */

      if (!dto.siteOrigineId) {
        throw new Error(
          "Le site d'origine ne peut pas être null pour un transfert ou un retrait.",
        );
      }

      // 1. Diminuer l'actif au point de départ (Détenteur A)
      await this.actifsService.decreaseActif(
        userId,
        dto.siteOrigineId,
        dto.productId,
        dto.quantite,
      );

      // 2. Si le départ était chez un tiers, diminuer son PASSIF
      if (siteOrigine && userId !== siteOrigine.siteUserID.toString()) {
        await this.passifsService.decreasePassif(
          siteOrigine.siteUserID.toString(),
          dto.productId,
          dto.quantite,
        );
      }

      // 3. Augmenter l'actif au point d'arrivée (Détenteur B)
      await this.actifsService.addOrIncreaseActif(
        userId,
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
        dto.prixUnitaire,
        siteDestOwnerId, // Nouveau détenteur
        userId, // Toujours moi l'ayant-droit
      );

      // 4. Si l'arrivée est chez un tiers, augmenter son PASSIF
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

    // --- LOGIQUE VIREMENT (Étape 4c : Cession de Propriété) ---
    else if (type === MovementType.VIREMENT) {
      /**
       * Règle : Le produit ne bouge pas de site, mais l'AYANT-DROIT change.
       * C'est le "Mouvement de compte au niveau du détenteur" de votre doc.
       */
      const ancienProprietaire = userId;
      const nouveauProprietaire = dto.ayant_droit; // Ajouter ce champ au DTO

      if (!nouveauProprietaire) {
        throw new Error(
          "L'identifiant du nouvel ayant-droit est requis pour un virement.",
        );
      }

      // 1. L'Ancien perd l'Actif
      await this.actifsService.decreaseActif(
        ancienProprietaire,
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
      );

      // 2. Le Nouveau gagne l'Actif (sur le même site, même détenteur)
      await this.actifsService.addOrIncreaseActif(
        nouveauProprietaire,
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
        dto.prixUnitaire,
        siteDestOwnerId,
        nouveauProprietaire,
      );

      // 3. Mise à jour du PASSIF du détenteur (Il doit maintenant au nouveau propriétaire)
      await this.passifsService.updateCreancier(
        siteDestOwnerId,
        dto.productId,
        dto.quantite,
        ancienProprietaire,
        nouveauProprietaire,
      );
    }

    // Enregistrement du mouvement
    const movement = new this.movementModel({
      ...dto,
      operatorId: new Types.ObjectId(userId),
      type: type,
      depotOrigine: siteOrigine?.siteName || 'EXTERIEUR',
      depotDestination: siteDest.siteName,
    });

    return await movement.save();
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
        productId: movement.productId?._id,
        montant: movement.quantite * movement.prixUnitaire,
        departDe: movement.depotOrigine,
        departDeId: movement.siteOrigineId._id,
        arrivee: movement.depotDestination,
        arriveeId: movement.siteDestinationId._id,
        action: movement.observations || '-',
      })),
      summary: result.summary,
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
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
