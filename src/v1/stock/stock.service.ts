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
import { MailService } from 'src/shared/mail/mail.service';

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
    private readonly mailService: MailService,
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
      type !== MovementType.DEPOT &&
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
    // Utiliser les détenteur et ayant-droit fournis, sinon utiliser les defaults
    // IMPORTANT: Cette logique est critique pour la cohérence Actifs/Passifs
    
    // Détenteur: qui garde physiquement le produit
    // Default: propriétaire du site de destination
    const detentaireId = dto.detentaire || siteDestOwnerId;
    
    // Ayant-droit: qui possède légalement le produit
    // Default: l'utilisateur qui effectue le dépôt (userId)
    const ayantDroitId = dto.ayant_droit || userId;

    // Si c'est un dépôt avec site d'origine (mouvement, pas création initiale)
    // L'initiateur doit perdre l'actif du site d'origine
    if (dto.siteOrigineId) {
      await this.actifsService.decreaseActif(
        userId, // L'initiateur perd l'actif
        dto.siteOrigineId, // Du site d'origine
        dto.productId,
        dto.quantite,
      );
    }

    // Créer l'actif pour le propriétaire avec les détenteur et ayant-droit spécifiés
    await this.actifsService.addOrIncreaseActif(
      ayantDroitId, // userId (propriétaire du bilan)
      dto.siteDestinationId,
      dto.productId,
      dto.quantite,
      dto.prixUnitaire,
      detentaireId, // Qui garde physiquement
      ayantDroitId, // Qui possède légalement
    );

    // Créer un passif si le détenteur n'est pas le propriétaire
    // Le détenteur doit le produit au propriétaire
    if (detentaireId !== ayantDroitId) {
      await this.passifsService.addOrIncreasePassif(
        detentaireId, // Le débiteur (celui qui détient)
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
        ayantDroitId, // Le créancier (propriétaire)
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

    // IMPORTANT: Logger les détentaire/ayant-droit pour debug
    this.loggerService.debug(
      'ProcessTransferOrWithdraw',
      `Original detentaire=${dto.detentaire}, ayant_droit=${dto.ayant_droit}`,
    );

    // Récupérer le détentaire et ayant-droit de l'origine
    const siteOrigineOwnerId = siteOrigine.siteUserID._id
      ? siteOrigine.siteUserID._id.toString()
      : siteOrigine.siteUserID.toString();

    // Détentaire du site origine (qui garde le produit) - par défaut le proprio du site
    // Ayant-droit - par défaut l'utilisateur qui demande le transfert
    // MAIS: on doit récupérer ces infos du produit actif existant pour maintenir la cohérence

    // 1. Sortie de l'actif (diminuer du site origine)
    await this.actifsService.decreaseActif(
      userId,
      dto.siteOrigineId,
      dto.productId,
      dto.quantite,
    );

    // 2. Diminution du passif chez le détenteur du site d'origine
    // Si le site possédait le produit initialement (endettement envers userId)
    if (userId !== siteOrigineOwnerId) {
      await this.passifsService.decreasePassifByCreditor(
        siteOrigineOwnerId,
        dto.productId,
        userId,
        dto.quantite,
      );
    }

    // 3. Cas du TRANSFERT (si on déplace vers un autre site)
    if (MovementType.TRANSFERT) {
      // Respecter les paramètres dto si fournis, sinon utiliser les defaults
      const detentaireId = dto.detentaire || siteDestOwnerId;
      const ayantDroitId = dto.ayant_droit || userId;

      // Créer l'actif au site destination
      await this.actifsService.addOrIncreaseActif(
        ayantDroitId, // Propriétaire
        dto.siteDestinationId,
        dto.productId,
        dto.quantite,
        dto.prixUnitaire,
        detentaireId, // Qui garde physiquement
        ayantDroitId, // Qui possède légalement
      );

      // Créer le passif si détentaire ≠ ayant-droit
      if (detentaireId !== ayantDroitId) {
        await this.passifsService.addOrIncreasePassif(
          detentaireId,
          dto.siteDestinationId,
          dto.productId,
          dto.quantite,
          ayantDroitId,
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

    // IMPORTANT: Virement = transfert de propriété légale (ayant-droit)
    // Le détentaire physique peut rester le même (par défaut du site ou fourni)
    const detentaireId = dto.detentaire || siteDestOwnerId;

    this.loggerService.debug(
      'ProcessVirement',
      `Old proprietaire=${ancienProprietaire}, New proprietaire=${nouveauProprietaire}, Detentaire=${detentaireId}`,
    );

    // 1. Retirer l'actif de l'ancien propriétaire
    await this.actifsService.decreaseActif(
      ancienProprietaire,
      dto.siteDestinationId,
      dto.productId,
      dto.quantite,
    );

    // 2. Ajouter l'actif au nouveau propriétaire avec le même détentaire
    await this.actifsService.addOrIncreaseActif(
      nouveauProprietaire,
      dto.siteDestinationId,
      dto.productId,
      dto.quantite,
      dto.prixUnitaire,
      detentaireId, // Qui garde physiquement (peut changer ou rester le même)
      nouveauProprietaire, // Le nouveau propriétaire
    );

    // 3. Transfert de créance entre ancienProprietaire et nouveauProprietaire
    // Si le détentaire n'est pas le propriétaire, la dette change de créancier
    if (detentaireId !== ancienProprietaire || detentaireId !== nouveauProprietaire) {
      await this.passifsService.updateCreancier(
        detentaireId,
        dto.productId,
        dto.quantite,
        ancienProprietaire,
        nouveauProprietaire,
      );
    }
  }

  async getHistory(userId: string, query: any): Promise<any> {
    // 1. Extraction et valeurs par défaut pour la pagination
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const skip = (page - 1) * limit;

    // 2. Configuration du tri (ex: sortBy=createdAt & order=desc)
    const sortBy = query.sortBy || 'createdAt';
    const order = query.order === 'asc' ? 1 : -1;

    // 3. Construction des filtres dynamiques
    const filters: any = { operatorId: new Types.ObjectId(userId) };

    if (query.type) filters.type = query.type;
    if (query.productId)
      filters.productId = new Types.ObjectId(query.productId);
    if (query.isValide !== undefined)
      filters.isValide = query.isValide === 'true';

    // 4. Exécution de la requête avec pagination et tri
    const [history, total] = await Promise.all([
      this.movementModel
        .find(filters)
        .sort({ [sortBy]: order }) // Tri dynamique
        .skip(skip) // Pagination
        .limit(limit) // Pagination
        .lean()
        .populate([
          { path: 'productId', select: 'productName codeCPC' },
          {
            path: 'siteOrigineId',
            select: 'siteName siteUserID',
            populate: {
              path: 'siteUserID',
              select: 'userName userFirstname userNickName',
            },
          },
          {
            path: 'siteDestinationId',
            select: 'siteName siteUserID',
            populate: {
              path: 'siteUserID',
              select: 'userName userFirstname userNickName',
            },
          },
          {
            path: 'ayant_droit detentaire',
            select: 'userNickName userName userFirstname userId',
          },
        ])
        .select('-__v -updatedAt')
        .exec(),
      this.movementModel.countDocuments(filters), // Compter le total pour le front-end
    ]);

    return {
      status: 'success',
      message: 'Historique récupéré',
      total,
      page,
      lastPage: Math.ceil(total / limit),
      limit,
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

    const { siteId, search, startDate, endDate } = query;

    if (siteId) {
      filter.$or = [
        { siteOrigineId: new Types.ObjectId(siteId) },
        { siteDestinationId: new Types.ObjectId(siteId) },
      ];
    }

    if (search) {
      const productIds = await this.productService.findIdsByName(search);
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

  /**
   * Signaler un mouvement comme invalide et envoyer une notification
   */
  async flagMovement(
    movementId: string,
    userId: string,
    reason: string,
  ): Promise<any> {
    const movement: any = await this.movementModel
      .findById(movementId)
      .populate('operatorId', 'userEmail userName userFirstname')
      .populate('siteDestinationId', 'siteName')
      .populate('productId', 'productName')
      .exec();

    if (!movement) {
      throw new Error('Mouvement non trouvé');
    }

    // Mettre à jour le mouvement avec les informations de signalement
    movement.isValide = false;
    movement.flaggedBy = new Types.ObjectId(userId);
    movement.flagReason = reason;
    movement.flaggedAt = new Date();

    const updatedMovement = await movement.save();

    // Envoyer un email au destinataire du mouvement
    const operatorEmail = movement.operatorId?.userEmail;
    const operatorName =
      movement.operatorId?.userFirstname || movement.operatorId?.userName;
    const siteName = movement.siteDestinationId?.siteName || 'Inconnu';
    const productName = movement.productId?.productName || 'Produit inconnu';

    if (operatorEmail) {
      await this.mailService.notificationMovementFlagged(
        operatorEmail,
        operatorName,
        siteName,
        productName,
        movement.quantite,
        reason,
      );
    }

    return {
      status: 'success',
      message: 'Mouvement signalé comme invalide et notification envoyée',
      data: updatedMovement,
    };
  }

  /**
   * Valider un mouvement signalé
   */
  async validateMovementFlag(movementId: string): Promise<any> {
    const movement: any = await this.movementModel.findById(movementId);

    if (!movement) {
      throw new Error('Mouvement non trouvé');
    }

    // Mettre à jour le mouvement
    movement.isValide = true;
    movement.flaggedBy = undefined;
    movement.flagReason = undefined;
    movement.flaggedAt = undefined;

    const updatedMovement = await movement.save();

    return {
      status: 'success',
      message: 'Mouvement validé avec succès',
      data: updatedMovement,
    };
  }
}
