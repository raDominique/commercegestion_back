import { PaginationResult } from './../../shared/interfaces/pagination.interface';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ulid } from 'ulid';
import {
  Transaction,
  TransactionDocument,
  TransactionType,
  TransactionStatus,
} from './transactions.schema';
import {
  CreateDepositDto,
  CreateReturnDto,
  CreateInitializationDto,
  CreateVenteDto,
  CreateVirementDroitDto,
  ApproveTransactionDto,
  RejectTransactionDto,
} from './dto/create-transaction.dto';
import { ActifsService } from '../actifs/actifs.service';
import { PassifsService } from '../passifs/passifs.service';
import { MailService } from '../../shared/mail/mail.service';
import { ProductService } from '../products/products.service';
import { StockService } from '../stock/stock.service';
import { MovementType } from '../stock/stock-movement.schema';
import { CreateMovementDto } from '../stock/dto/create-movement.dto';
import { UsersService } from '../users/users.service';
import { SiteService } from '../sites/sites.service';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  ExportService,
  ExportResult,
} from '../../shared/export/export.service';

@Injectable()
export class TransactionsService {
  logger: any;
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    private readonly actifsService: ActifsService,
    private readonly passifsService: PassifsService,
    private readonly productService: ProductService,
    private readonly mailService: MailService,
    private readonly stockService: StockService,
    private readonly usersService: UsersService,
    private readonly siteService: SiteService,
    private readonly loggers: LoggerService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * Génère un numéro de transaction unique avec ULID
   * ULID = Universally Unique Lexicographically Sortable Identifier
   * Format: 26 caractères alphanumériques (case-insensitive)
   * Avantages:
   * - Monotone (sortable par timestamp)
   * - Unique sans collision
   * - Plus court qu'UUID
   * - Lisible
   */
  private generateTransactionNumber(): string {
    return ulid();
  }

  /**
   * Crée une transaction de dépôt
   * Le dépôt transfère un produit d'un utilisateur vers un autre
   * Le déposant perd l'actif, le recevant gagne l'actif, et un passif est créé pour le recevant envers le déposant
   * NOTE: Les mouvements d'actifs/passifs sont appliqués uniquement lors de l'approbation
   */
  async createDeposit(
    createDepositDto: CreateDepositDto,
  ): Promise<PaginationResult<TransactionDocument>> {
    const transactionNumber = this.generateTransactionNumber();

    const transaction = new this.transactionModel({
      transactionNumber,
      type: TransactionType.DEPOT,
      status: TransactionStatus.PENDING,
      initiatorId: new Types.ObjectId(createDepositDto.ayant_droit),
      recipientId: new Types.ObjectId(createDepositDto.detentaire),
      productId: new Types.ObjectId(createDepositDto.productId),
      siteOrigineId: new Types.ObjectId(createDepositDto.siteOrigineId),
      siteDestinationId: new Types.ObjectId(createDepositDto.siteDestinationId),
      quantite: createDepositDto.quantite,
      prixUnitaire: createDepositDto.prixUnitaire || null,
      detentaire: new Types.ObjectId(createDepositDto.detentaire),
      ayant_droit: new Types.ObjectId(createDepositDto.ayant_droit),
      observations: createDepositDto.observations || null,
      isActive: true,
    });

    const savedTransaction = await transaction.save();

    // Envoyer la notification de création (fire-and-forget)
    this.sendCreationNotification(savedTransaction).catch((error) => {
      console.error('Failed to send creation notification:', error);
    });

    // Réserver la quantité dans l'actif du déposant (site d'origine) si un actif existe
    // Si aucun actif n'existe, le stock est considéré comme externe (hors système)
    try {
      await this.actifsService.decreaseActif(
        createDepositDto.ayant_droit,
        createDepositDto.siteOrigineId,
        createDepositDto.productId,
        createDepositDto.quantite,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        console.warn(
          `Aucun actif existant pour le dépôt (ayant_droit=${createDepositDto.ayant_droit}, site=${createDepositDto.siteOrigineId}, product=${createDepositDto.productId}). Le stock est considéré comme externe.`,
        );
      } else {
        throw error;
      }
    }
    return {
      status: 'success',
      message:
        "Transaction de dépôt créée avec succès et en attente d'approbation",
      data: [savedTransaction],
      total: 1,
    };
  }

  /**
   * Crée une transaction de retour
   * Le retour transfère un produit du recevant au propriétaire
   */
  async createReturn(
    createReturnDto: CreateReturnDto,
  ): Promise<PaginationResult<TransactionDocument>> {
    const transactionNumber = this.generateTransactionNumber();

    const transaction = new this.transactionModel({
      transactionNumber,
      type: TransactionType.RETRAIT,
      status: TransactionStatus.PENDING,
      initiatorId: new Types.ObjectId(createReturnDto.ayant_droit),
      recipientId: new Types.ObjectId(createReturnDto.detentaire),
      productId: new Types.ObjectId(createReturnDto.productId),
      siteOrigineId: new Types.ObjectId(createReturnDto.siteOrigineId),
      siteDestinationId: new Types.ObjectId(createReturnDto.siteDestinationId),
      quantite: createReturnDto.quantite,
      prixUnitaire: createReturnDto.prixUnitaire || null,
      detentaire: new Types.ObjectId(createReturnDto.detentaire),
      ayant_droit: new Types.ObjectId(createReturnDto.ayant_droit),
      observations: createReturnDto.observations || null,
      isActive: true,
    });

    const savedTransaction = await transaction.save();

    // Envoyer la notification de création (fire-and-forget)
    this.sendCreationNotification(savedTransaction).catch((error) => {
      console.error('Failed to send creation notification:', error);
    });

    return {
      status: 'success',
      message:
        "Transaction de retour créée avec succès et en attente d'approbation",
      data: [savedTransaction],
      total: 1,
    };
  }

  /**
   * Crée une transaction d'initialisation de stock
   */
  async createInitialization(
    createInitDto: CreateInitializationDto,
    userId: string,
  ): Promise<PaginationResult<TransactionDocument>> {
    const transactionNumber = this.generateTransactionNumber();

    const transaction = new this.transactionModel({
      transactionNumber,
      type: TransactionType.INITIALISATION,
      status: TransactionStatus.APPROVED, // Initialisation est approuvée immédiatement
      initiatorId: new Types.ObjectId(userId),
      recipientId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(createInitDto.productId),
      siteOrigineId: new Types.ObjectId(createInitDto.siteOrigineId),
      siteDestinationId: new Types.ObjectId(createInitDto.siteOrigineId),
      quantite: createInitDto.quantite,
      prixUnitaire: createInitDto.prixUnitaire || null,
      detentaire: new Types.ObjectId(userId),
      ayant_droit: new Types.ObjectId(userId),
      observations: createInitDto.observations || null,
      isActive: true,
      approvedAt: new Date(), // Date d'approbation immédiate
    });

    const savedTransaction = await transaction.save();

    // Faire update l'Actif du produit pour refléter la nouvelle quantité initialisée
    await this.actifsService.addOrIncreaseActif(
      userId, // userId: Propriétaire du bilan
      createInitDto.siteOrigineId, // depotId: Site d'initialisation
      createInitDto.productId, // productId: Le produit
      createInitDto.quantite, // quantite
      createInitDto.prixUnitaire || 0, // prixUnitaire
      userId, // detentaireId: Qui garde le produit (l'initialisateur)
      userId, // ayantDroitId: Qui possède le produit (l'initialisateur)
    );

    // Envoyer la notification de création (fire-and-forget)
    this.sendCreationNotification(savedTransaction).catch((error) => {
      console.error('Failed to send creation notification:', error);
    });

    return {
      status: 'success',
      message:
        "Transaction d'initialisation créée avec succès et en attente d'approbation",
      data: [savedTransaction],
      total: 1,
    };
  }

  /**
   * Crée une transaction d'achat/vente (VENTE)
   * L'acheteur initie l'achat, la quantite est réservée chez le vendeur
   */
  async createVente(
    createVenteDto: CreateVenteDto,
    acheteurId: string,
  ): Promise<PaginationResult<TransactionDocument>> {
    const transactionNumber = this.generateTransactionNumber();

    const transaction = new this.transactionModel({
      transactionNumber,
      type: TransactionType.VENTE,
      status: TransactionStatus.PENDING,
      initiatorId: new Types.ObjectId(acheteurId),
      recipientId: new Types.ObjectId(createVenteDto.vendeurId),
      productId: new Types.ObjectId(createVenteDto.productId),
      siteOrigineId: new Types.ObjectId(createVenteDto.siteOrigineId),
      siteDestinationId: createVenteDto.siteDestinationId
        ? new Types.ObjectId(createVenteDto.siteDestinationId)
        : new Types.ObjectId(createVenteDto.siteOrigineId),
      quantite: createVenteDto.quantite,
      prixUnitaire: createVenteDto.prixUnitaire,
      detentaire: new Types.ObjectId(createVenteDto.vendeurId),
      ayant_droit: new Types.ObjectId(acheteurId),
      observations: createVenteDto.observations || null,
      isActive: true,
    });

    const savedTransaction = await transaction.save();

    // Réserver la quantite chez le vendeur
    await this.actifsService.decreaseActif(
      createVenteDto.vendeurId,
      createVenteDto.siteOrigineId,
      createVenteDto.productId,
      createVenteDto.quantite,
    );

    // Envoyer la notification de création (fire-and-forget)
    this.sendCreationNotification(savedTransaction).catch((error) => {
      console.error('Failed to send creation notification:', error);
    });

    return {
      status: 'success',
      message:
        "Transaction d'achat/vente créée avec succès et en attente d'approbation",
      data: [savedTransaction],
      total: 1,
    };
  }

  /**
   * Virement de droit auprès d'un bénéficiaire tiers
   * X (ayant-droit/propriétaire) transfère ses droits sur un dépôt chez Y (détenteur) vers Z.
   * Opération validée immédiatement (pas de mouvement physique).
   */
  async createVirementDroit(
    dto: CreateVirementDroitDto,
    initiatorId: string,
  ): Promise<PaginationResult<TransactionDocument>> {
    const transactionNumber = this.generateTransactionNumber();

    // Validation: X doit avoir assez de quantité sur l'actif déposé chez Y au site indiqué
    // (Actif identifié par detentaireId=userId, depotId=siteId, productId, ayant_droit=initiatorId)
    await this.actifsService.transferAyantDroitWithinDetentaire({
      detentaireId: dto.detentaireId,
      depotId: dto.siteId,
      productId: dto.productId,
      fromAyantDroitId: initiatorId,
      toAyantDroitId: dto.beneficiaryId,
      quantite: dto.quantite,
      prixUnitaire: 0,
    });

    // Transfert du passif associé (si existant): débiteur X -> débiteur Z, créancier = détenteur Y
    await this.passifsService.transferDebtorByCreditor({
      fromDebtorId: initiatorId,
      toDebtorId: dto.beneficiaryId,
      productId: dto.productId,
      creancierId: dto.detentaireId,
      quantite: dto.quantite,
      depotId: dto.siteId,
    });

    const transaction = new this.transactionModel({
      transactionNumber,
      type: TransactionType.VIREMENT_DROIT,
      status: TransactionStatus.APPROVED,
      initiatorId: new Types.ObjectId(initiatorId),
      recipientId: new Types.ObjectId(dto.beneficiaryId),
      productId: new Types.ObjectId(dto.productId),
      siteOrigineId: new Types.ObjectId(dto.siteId),
      siteDestinationId: new Types.ObjectId(dto.siteId),
      quantite: dto.quantite,
      prixUnitaire: null,
      detentaire: new Types.ObjectId(dto.detentaireId),
      ayant_droit: new Types.ObjectId(dto.beneficiaryId),
      observations: dto.observations || null,
      isActive: true,
      approvedAt: new Date(),
      approuveurId: new Types.ObjectId(initiatorId),
      metadata: {
        previousAyantDroitId: initiatorId,
        beneficiaryId: dto.beneficiaryId,
        detentaireId: dto.detentaireId,
      },
    });

    const savedTransaction = await transaction.save();

    // Notifications: X, Y, Z
    this.sendVirementDroitNotifications(
      savedTransaction,
      initiatorId,
      dto.detentaireId,
      dto.beneficiaryId,
    ).catch((error) =>
      console.error('Failed to send virement notifications:', error),
    );

    return {
      status: 'success',
      message: 'Virement de droit effectué avec succès',
      data: [savedTransaction],
      total: 1,
    };
  }

  /**
   * Approuve une transaction
   * Cela génère les mouvements d'actifs et de passifs correspondants
   */
  async approveTransaction(
    transactionId: string,
    approveDto: ApproveTransactionDto,
  ): Promise<PaginationResult<TransactionDocument>> {
    const transaction = await this.transactionModel.findById(transactionId);

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot approve transaction with status: ${transaction.status}`,
      );
    }

    // Approuver la transaction
    transaction.status = TransactionStatus.APPROVED;
    transaction.approuveurId = new Types.ObjectId(approveDto.approuveurId);
    transaction.approvedAt = new Date();

    if (approveDto.observations) {
      transaction.observations = approveDto.observations;
    }

    const updatedTransaction = await transaction.save();

    // Appliquer les mouvements d'actifs/passifs selon le type
    await this.applyTransactionMovements(updatedTransaction);

    // Envoyer la notification d'approbation (fire-and-forget)
    this.sendApprovalNotification(
      updatedTransaction,
      approveDto.approuveurId,
    ).catch((error) => {
      console.error('Failed to send approval notification:', error);
    });

    return {
      status: 'success',
      message: 'Transaction approuvée avec succès et mouvements appliqués',
      data: [updatedTransaction],
      total: 1,
    };
  }

  /**
   * Rejette une transaction
   */
  async rejectTransaction(
    transactionId: string,
    rejectDto: RejectTransactionDto,
  ): Promise<PaginationResult<TransactionDocument>> {
    const transaction = await this.transactionModel.findById(transactionId);

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject transaction with status: ${transaction.status}`,
      );
    }

    transaction.status = TransactionStatus.REJECTED;
    transaction.approuveurId = new Types.ObjectId(rejectDto.approuveurId);
    transaction.motifRejet = rejectDto.motifRejet;
    transaction.approvedAt = new Date();

    const updatedTransaction = await transaction.save();

    // Restaurer la quantite dans l'actif du déposant si depot
    if (transaction.type === TransactionType.DEPOT) {
      await this.actifsService.addOrIncreaseActif(
        transaction.ayant_droit.toString(),
        transaction.siteOrigineId.toString(),
        transaction.productId.toString(),
        transaction.quantite,
        transaction.prixUnitaire || 0,
        transaction.detentaire.toString(),
        transaction.ayant_droit.toString(),
      );
    } else if (transaction.type === TransactionType.VENTE) {
      // Restaurer la quantite chez le vendeur si vente annulée
      await this.actifsService.addOrIncreaseActif(
        transaction.detentaire.toString(),
        transaction.siteOrigineId.toString(),
        transaction.productId.toString(),
        transaction.quantite,
        transaction.prixUnitaire || 0,
        transaction.detentaire.toString(),
        transaction.detentaire.toString(),
      );
    }

    // Envoyer la notification de rejet (fire-and-forget)
    this.sendRejectionNotification(
      updatedTransaction,
      rejectDto.motifRejet,
      rejectDto.approuveurId,
    ).catch((error) => {
      console.error('Failed to send rejection notification:', error);
    });

    return {
      status: 'success',
      message: 'Transaction rejetée avec succès',
      data: [updatedTransaction],
      total: 1,
    };
  }

  /**
   * Applique les mouvements d'actifs et passifs
   * Appelle les services appropriés selon le type de transaction
   */
  private async applyTransactionMovements(
    transaction: TransactionDocument,
  ): Promise<void> {
    switch (transaction.type) {
      case TransactionType.DEPOT:
        await this.applyDepositMovements(transaction);
        break;
      case TransactionType.RETRAIT:
        await this.applyReturnMovements(transaction);
        break;
      case TransactionType.INITIALISATION:
        await this.applyInitializationMovements(transaction);
        break;
      case TransactionType.VENTE:
        await this.applyVenteMovements(transaction);
        break;
    }
  }

  /**
   * Applique les mouvements pour un dépôt en créant un StockMovement
   * SOLUTION 1: Utilise StockService pour une source de vérité unique
   *
   * Flux:
   * 1. Transaction approuvée
   * 2. Crée un StockMovement type DEPOT
   * 3. StockMovement crée les actifs/passifs et marque isStocker=true
   *
   * Avantages:
   * - Une SOURCE DE VÉRITÉ (StockMovement)
   * - Traçabilité complète (Transaction + StockMovement lié)
   * - Pas de doublons
   * - Facile à audit/debug
   */
  private async applyDepositMovements(
    transaction: TransactionDocument,
  ): Promise<void> {
    try {
      // Construire un DTO pour StockMovement
      const movementDto: CreateMovementDto = {
        siteOrigineId: transaction.siteOrigineId?.toString(),
        siteDestinationId: transaction.siteDestinationId.toString(),
        productId: transaction.productId.toString(),
        quantite: transaction.quantite,
        prixUnitaire: transaction.prixUnitaire || 0,
        detentaire: transaction.recipientId?.toString(),
        ayant_droit: transaction.initiatorId?.toString(),
        observations: `Transaction DEPOT #${transaction.transactionNumber} approuvée`,
      };

      // Appeler StockService pour créer le mouvement
      // Cela crée les actifs/passifs automatiquement
      const stockMovement = await this.stockService.createMovement(
        movementDto,
        transaction.initiatorId.toString(),
        MovementType.DEPOT,
      );

      // Lier la Transaction au StockMovement créé
      transaction.linkedStockMovementId = stockMovement._id;
      await transaction.save();
    } catch (error) {
      console.error('Error applying deposit movements:', error);
      throw error;
    }
  }

  /**
   * Applique les mouvements pour un retour
   * C'est l'inverse d'un dépôt:
   * - L'initiator (qui retourne) perd l'actif
   * - Le recipient (propriétaire) regagne l'actif
   * - Le passif du recipient envers l'initiator est diminué/supprimé
   */
  private async applyReturnMovements(
    transaction: TransactionDocument,
  ): Promise<void> {
    try {
      // Pour un RETRAIT (retour), on inverse le flux d'un DEPOT :
      // - Le détenteur (qui gardait physiquement) sort le stock
      // - L'ayant-droit (propriétaire légal) récupère le stock
      // - Le passif créé au dépôt est diminué

      const detentaireId = transaction.detentaire.toString();
      const ayantDroitId = transaction.ayant_droit.toString();
      const productId = transaction.productId.toString();
      const originSiteId = transaction.siteOrigineId.toString();
      const destinationSiteId = transaction.siteDestinationId.toString();
      const quantity = transaction.quantite;
      const unitPrice = transaction.prixUnitaire || 0;

      // 1. Sortie du stock chez le détenteur (site d'origine)
      await this.actifsService.decreaseActif(
        detentaireId,
        originSiteId,
        productId,
        quantity,
      );

      // 2. Entrée du stock chez l'ayant-droit (site de destination)
      await this.actifsService.addOrIncreaseActif(
        ayantDroitId, // userId: Propriétaire du bilan
        destinationSiteId, // depotId: Site physique
        productId,
        quantity,
        unitPrice,
        ayantDroitId, // detentaireId: il récupère physiquement
        ayantDroitId, // ayantDroitId: il est propriétaire légal
      );

      // 3. Diminuer le passif lié au dépôt (si existant)
      // NB: lors d'un DEPOT via StockService, le passif est créé avec:
      // userId = ayantDroitId (débiteur) / creancierId = detentaireId
      await this.passifsService.decreasePassifByCreditor(
        ayantDroitId,
        productId,
        detentaireId,
        quantity,
      );

      console.log(
        'Return movements applied for transaction:',
        transaction.transactionNumber,
      );
    } catch (error) {
      console.error('Error applying return movements:', error);
      throw error;
    }
  }

  /**
   * Applique les mouvements pour une initialisation
   * Crée un nouvel actif avec la quantité spécifiée
   */
  private async applyInitializationMovements(
    transaction: TransactionDocument,
  ): Promise<void> {
    try {
      const initiatorId = transaction.initiatorId.toString();
      const productId = transaction.productId.toString();
      const siteId = transaction.siteOrigineId.toString();
      const quantity = transaction.quantite;
      const unitPrice = transaction.prixUnitaire || 0;

      // 1. Créer un nouvel actif pour l'initiator
      await this.actifsService.addOrIncreaseActif(
        initiatorId, // userId: Propriétaire du bilan
        siteId, // depotId: Site d'initialisation
        productId, // productId: Le produit
        quantity, // quantite
        unitPrice, // prixUnitaire
        initiatorId, // detentaireId: Qui garde le produit
        initiatorId, // ayantDroitId: Qui possède le produit (lui-même)
      );

      // 2. Pas de passif pour l'initialisation (c'est pour l'utilisateur lui-même)

      console.log(
        'Initialization movements applied for transaction:',
        transaction.transactionNumber,
      );
    } catch (error) {
      console.error('Error applying initialization movements:', error);
      throw error;
    }
  }

  /**
   * Applique les mouvements pour un achat/vente (VENTE)
   * Transfère l'actif du vendeur vers l'acheteur
   */
  private async applyVenteMovements(
    transaction: TransactionDocument,
  ): Promise<void> {
    try {
      const vendeurId = transaction.detentaire.toString();
      const acheteurId = transaction.ayant_droit.toString();
      const productId = transaction.productId.toString();
      const siteOrigineId = transaction.siteOrigineId.toString();
      const siteDestinationId = transaction.siteDestinationId.toString();
      const quantity = transaction.quantite;
      const unitPrice = transaction.prixUnitaire || 0;

      // 1. Créer un actif pour l'acheteur
      await this.actifsService.addOrIncreaseActif(
        acheteurId,
        siteDestinationId,
        productId,
        quantity,
        unitPrice,
        acheteurId,
        acheteurId,
      );

      console.log(
        'Vente movements applied for transaction:',
        transaction.transactionNumber,
        `Vendeur: ${vendeurId}, Acheteur: ${acheteurId}, Produit: ${productId}, Quantité: ${quantity}`,
      );
    } catch (error) {
      console.error('Error applying vente movements:', error);
      throw error;
    }
  }

  /**
   * Récupère les transactions en attente de validation
   */
  async getPendingTransactions(
    recipientId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<PaginationResult<TransactionDocument>> {
    const skip = (page - 1) * limit;

    const data = await this.transactionModel
      .find({
        recipientId: new Types.ObjectId(recipientId),
        status: TransactionStatus.PENDING,
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        'initiatorId',
        'recipientId',
        'productId',
        'siteOrigineId',
        'siteDestinationId',
      ])
      .exec();

    const total = await this.transactionModel.countDocuments({
      recipientId: new Types.ObjectId(recipientId),
      status: TransactionStatus.PENDING,
    });

    return {
      status: 'success',
      message: 'Transactions en attente récupérées avec succès',
      data,
      page,
      limit,
      total,
    };
  }

  /**
   * Récupère toutes les transactions d'un utilisateur
   */
  async getUserTransactions(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: TransactionStatus,
    type?: TransactionType,
  ): Promise<PaginationResult<TransactionDocument>> {
    const skip = (page - 1) * limit;
    const query: any = {
      $or: [
        { initiatorId: new Types.ObjectId(userId) },
        { recipientId: new Types.ObjectId(userId) },
      ],
    };

    if (status) {
      query.status = status;
    }

    if (type) {
      query.type = type;
    }

    const data = await this.transactionModel
      .find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        'initiatorId',
        'recipientId',
        'productId',
        'siteOrigineId',
        'siteDestinationId',
      ])
      .exec();

    const total = await this.transactionModel.countDocuments(query);

    return {
      status: 'success',
      message: 'Transactions utilisateur récupérées avec succès',
      data,
      page,
      limit,
      total,
    };
  }

  /**
   * Récupère une transaction par ID
   */
  async getTransactionById(
    transactionId: string,
  ): Promise<PaginationResult<TransactionDocument>> {
    const transaction = await this.transactionModel
      .findById(transactionId)
      .populate([
        'initiatorId',
        'recipientId',
        'productId',
        'siteOrigineId',
        'siteDestinationId',
      ])
      .exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    return {
      status: 'success',
      message: 'Transaction récupérée avec succès',
      data: [transaction],
      total: 1,
    };
  }

  /**
   * Récupère les transactions par numéro
   */
  async getTransactionByNumber(
    transactionNumber: string,
  ): Promise<PaginationResult<TransactionDocument>> {
    const transaction = await this.transactionModel
      .findOne({ transactionNumber })
      .populate([
        'initiatorId',
        'recipientId',
        'productId',
        'siteOrigineId',
        'siteDestinationId',
      ])
      .exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionNumber} not found`);
    }

    return {
      status: 'success',
      message: 'Transaction récupérée avec succès',
      data: [transaction],
      total: 1,
    };
  }

  /**
   * Récupère les transactions validées pour le grand livre
   */
  async getApprovedTransactions(
    userId?: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginationResult<TransactionDocument>> {
    const skip = (page - 1) * limit;
    const query = { status: TransactionStatus.APPROVED };

    if (userId) {
      query['$or'] = [
        { initiatorId: new Types.ObjectId(userId) },
        { recipientId: new Types.ObjectId(userId) },
      ];
    }

    const data = await this.transactionModel
      .find(query)
      .sort({ approvedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        'initiatorId',
        'recipientId',
        'productId',
        'siteOrigineId',
        'siteDestinationId',
      ])
      .exec();

    const total = await this.transactionModel.countDocuments(query);

    return {
      status: 'success',
      message: 'Transactions approuvées récupérées avec succès',
      data,
      page,
      limit,
      total,
    };
  }

  /**
   * Récupère tous les dépôts APProuvés où l'utilisateur est ayant_droit
   * et le détenteur est un autre membre, et qui n'ont pas encore fait
   * l'objet d'un virement de droit (VIREMENT_DROIT).
   */
  async getAllDepositAtOthersMe(
    userId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
    siteId?: string,
    productId?: string,
    detentaireId?: string,
  ): Promise<PaginationResult<TransactionDocument>> {
    const skip = (page - 1) * limit;
    const userObjId = new Types.ObjectId(userId);

    // 1) Trouver tous les VIREMENT_DROIT où cet utilisateur a transféré ses droits
    const virements = await this.transactionModel
      .find({
        type: TransactionType.VIREMENT_DROIT,
        status: TransactionStatus.APPROVED,
        'metadata.previousAyantDroitId': userId,
        isActive: true,
      })
      .select('productId detentaire siteOrigineId quantite')
      .lean()
      .exec();

    // Index: (productId|detentaire|siteOrigineId) -> quantité totale virée
    const viredMap = new Map<string, number>();
    for (const v of virements) {
      const key = `${v.productId.toString()}|${v.detentaire?.toString() || ''}|${v.siteOrigineId?.toString() || ''}`;
      viredMap.set(key, (viredMap.get(key) || 0) + v.quantite);
    }

    // 2) Construire la requête MongoDB avec les filtres directs
    const filters: any[] = [
      { type: TransactionType.DEPOT },
      { status: TransactionStatus.APPROVED },
      { ayant_droit: userObjId },
      { detentaire: { $ne: userObjId } },
      { isActive: true },
    ];

    if (productId) {
      filters.push({ productId: new Types.ObjectId(productId) });
    }

    if (siteId) {
      const siteObjId = new Types.ObjectId(siteId);
      filters.push({
        $or: [
          { siteOrigineId: siteObjId },
          { siteDestinationId: siteObjId },
        ],
      });
    }

    if (detentaireId) {
      filters.push({ detentaire: new Types.ObjectId(detentaireId) });
    }

    const query = filters.length > 1 ? { $and: filters } : filters[0];

    const depots = await this.transactionModel
      .find(query)
      .sort({ createdAt: -1 })
      .populate([
        'initiatorId',
        'recipientId',
        'productId',
        'siteOrigineId',
        'siteDestinationId',
        'detentaire',
        'ayant_droit',
      ])
      .exec();

    // 3) Filtrer ceux dont la totalité de la quantité a déjà été virée
    const getId = (field: any): string => {
      if (!field) return '';
      if (field._id) return field._id.toString();
      return field.toString();
    };

    const filtered = depots.filter((d) => {
      const key = `${getId(d.productId)}|${getId(d.detentaire)}|${getId(d.siteOrigineId)}`;
      const viredQty = viredMap.get(key) || 0;
      return viredQty < d.quantite;
    });

    // 4) Filtre text search (post-filter sur les données peuplées)
    const searchLower = search?.toLowerCase();
    const searched = searchLower
      ? filtered.filter((d) => {
          const productName = (d.productId as any)?.productName?.toLowerCase() || '';
          const txNumber = d.transactionNumber?.toLowerCase() || '';
          return (
            productName.includes(searchLower) ||
            txNumber.includes(searchLower)
          );
        })
      : filtered;

    const total = searched.length;
    const data = searched.slice(skip, skip + limit);

    return {
      status: 'success',
      message:
        'Dépôts chez les autres membres sans virement de droit récupérés avec succès',
      data,
      page,
      limit,
      total,
    };
  }

  /**
   * Envoie les notifications d'approbation de transaction
   * Notifie le destinataire que sa transaction a été approuvée
   * Notifie aussi le déposant/initiator que sa transaction a été approuvée
   * Fire-and-forget: n'attend pas la confirmation d'envoi
   */
  private async sendApprovalNotification(
    transaction: TransactionDocument,
    approverId: string,
  ): Promise<void> {
    try {
      this.loggers.debug(
        'sendApprovalNotification',
        `Sending approval notification for transaction: ${transaction.transactionNumber}`,
      );
      const approverUser = await this.usersService.getById(approverId);
      const approverName = approverUser.userName;

      // Récupérer les infos du destinataire via la base de données
      const recipientUser = await this.usersService.getById(
        transaction.recipientId?.toString(),
      );
      const recipientEmail = recipientUser.userEmail;
      // Récupérer le nom du produit
      const product = await this.productService.findById(
        transaction.productId.toString(),
      );
      const productName = product?.data?.[0]?.productName || 'Produit';

      const recipientType = this.getTransactionTypeLabel(
        transaction.type,
        false,
      );

      await this.mailService.notificationTransactionApproved(
        recipientEmail,
        recipientUser.userName,
        recipientType,
        productName,
        transaction.quantite,
        transaction.transactionNumber,
        approverName,
      );

      console.log(
        `Approval notification sent for transaction (destinataire): ${transaction.transactionNumber} type: ${recipientType}`,
      );

      // Envoyer aussi la notification au déposant/initiator que sa transaction a été approuvée
      const initiatorUser = await this.usersService.getById(
        transaction.initiatorId.toString(),
      );
      const initiatorEmail = initiatorUser.userEmail;
      const initiatorType = this.getTransactionTypeLabel(
        transaction.type,
        true,
      );
      await this.mailService.notificationTransactionApproved(
        initiatorEmail,
        initiatorUser.userName,
        initiatorType,
        productName,
        transaction.quantite,
        transaction.transactionNumber,
        approverName,
      );
      console.log(
        `Approval notification sent to initiator for transaction: ${transaction.transactionNumber} type: ${initiatorType}`,
      );
    } catch (error) {
      console.error(
        `Failed to send approval notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Ne pas throw pour ne pas bloquer l'approbation
    }
  }

  /**
   * Envoie les notifications de rejet de transaction
   * Notifie le destinataire que sa transaction a été rejetée
   * Notifie aussi le déposant/initiator que sa transaction a été rejetée
   * Fire-and-forget: n'attend pas la confirmation d'envoi
   */
  private async sendRejectionNotification(
    transaction: TransactionDocument,
    rejectionReason: string,
    approuverId: string,
  ): Promise<void> {
    try {
      const approverUser = await this.usersService.getById(approuverId);
      const approverName = approverUser.userName;

      // Récupérer le nom du produit
      const product = await this.productService.findById(
        transaction.productId.toString(),
      );
      const productName = product?.data?.[0]?.productName || 'Produit';

      // Récupérer les infos du destinataire via la base de données
      const recipientUser = await this.usersService.getById(
        transaction.recipientId.toString(),
      );
      const recipientEmail = recipientUser.userEmail;
      const recipientType = this.getTransactionTypeLabel(
        transaction.type,
        false,
      );

      await this.mailService.notificationTransactionRejected(
        recipientEmail,
        recipientUser.userName,
        recipientType,
        productName,
        transaction.quantite,
        transaction.transactionNumber,
        rejectionReason,
        approverName,
      );

      console.log(
        `Rejection notification sent for transaction: ${transaction.transactionNumber} type: ${recipientType}`,
      );

      // Envoyer aussi la notification au déposant/initiator que sa transaction a été rejetée
      const initiatorUser = await this.usersService.getById(
        transaction.initiatorId.toString(),
      );
      const initiatorEmail = initiatorUser.userEmail;
      const initiatorType = this.getTransactionTypeLabel(
        transaction.type,
        true,
      );
      await this.mailService.notificationTransactionRejected(
        initiatorEmail,
        initiatorUser.userName,
        initiatorType,
        productName,
        transaction.quantite,
        transaction.transactionNumber,
        rejectionReason,
        approverName,
      );
      console.log(
        `Rejection notification sent to initiator for transaction: ${transaction.transactionNumber}`,
      );
    } catch (error) {
      console.error(
        `Failed to send rejection notification: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Ne pas throw pour ne pas bloquer le rejet
    }
  }

  /**
   * Envoie les notifications de création de transaction
   */
  private async sendCreationNotification(
    transaction: TransactionDocument,
  ): Promise<void> {
    try {
      this.loggers.debug(
        'sendCreationNotification',
        `Demarrage notification pour transaction: ${transaction.transactionNumber}`,
      );

      // 1. Récupération des utilisateurs
      const initiatorId = transaction.initiatorId?.toString();
      const recipientId = transaction.recipientId?.toString();

      const initiatorUser = initiatorId
        ? await this.usersService.getById(initiatorId)
        : null;
      const recipientUser = recipientId
        ? await this.usersService.getById(recipientId)
        : null;

      if (!initiatorUser) {
        console.error(
          `[Notification Error] Initiateur introuvable: ${initiatorId}`,
        );
        return;
      }

      // Recuperer le nom du produit
      const product = await this.productService.findById(
        transaction.productId.toString(),
      );
      const productName = product?.data?.[0]?.productName || 'Produit';

      // --- CAS SPÉCIFIQUE : INITIALISATION ---
      if (transaction.type === TransactionType.INITIALISATION) {
        if (initiatorUser.userEmail) {
          try {
            // Récupérer le nom du site
            let siteName = 'Site Principal';
            if (transaction.siteOrigineId) {
              const site = await this.siteService.findOne(
                transaction.siteOrigineId.toString(),
              );
              if (site) siteName = site.siteName;
            }

            await this.mailService.notificationTransactionInitialized(
              initiatorUser.userEmail,
              initiatorUser.userName,
              productName,
              transaction.quantite,
              transaction.transactionNumber,
              siteName,
            );
            console.log(
              `Mail d'initialisation envoyé à (${initiatorUser.userName})`,
            );
          } catch (error: unknown) {
            console.error(
              `Échec envoi mail initialisation: ${error instanceof Error ? error.message : 'Unknown error'}`,
            );
          }
        }
        return; // Fin du traitement pour l'initialisation
      }

      // --- ÉTAPE 1 : Mail au DESTINATAIRE (vendeur pour VENTE) ---
      if (recipientUser) {
        console.log(
          `[Mail Debug] Destinataire trouvé: ${recipientUser.userName}, email: ${recipientUser.userEmail || 'NON DEFINI'}`,
        );
      } else {
        console.warn(
          `[Mail Debug] Destinataire INTROUVABLE avec ID: ${recipientId}`,
        );
      }

      if (recipientUser && recipientUser.userEmail) {
        try {
          const recipientType = this.getTransactionTypeLabel(
            transaction.type,
            false,
          );
          await this.mailService.notificationTransactionCreated(
            recipientUser.userEmail,
            recipientUser.userName,
            recipientType,
            productName,
            transaction.quantite,
            transaction.transactionNumber,
            true, // isDestinataire: TRUE
            initiatorUser.userName,
            transaction.type,
          );
          console.log(
            `[Mail OK] Destinataire (${recipientUser.userName} → ${recipientUser.userEmail}) type: ${recipientType}`,
          );
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Mail FAIL] Destinataire: ${errorMessage}`);
        }
      } else if (recipientId) {
        console.warn(
          `[Mail SKIP] Destinataire introuvable ou sans email: ${recipientId}`,
        );
      }

      // --- ÉTAPE 2 : Mail à l'INITIATEUR (acheteur pour VENTE) ---
      if (initiatorUser.userEmail) {
        try {
          const initiatorType = this.getTransactionTypeLabel(
            transaction.type,
            true,
          );
          await this.mailService.notificationTransactionCreated(
            initiatorUser.userEmail,
            initiatorUser.userName,
            initiatorType,
            productName,
            transaction.quantite,
            transaction.transactionNumber,
            false, // isDestinataire: FALSE
            recipientUser?.userName || 'Inconnu',
            transaction.type,
          );
          console.log(
            `[Mail OK] Initiateur (${initiatorUser.userName} → ${initiatorUser.userEmail}) type: ${initiatorType}`,
          );
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(`[Mail FAIL] Initiateur: ${errorMessage}`);
        }
      }
    } catch (globalError: unknown) {
      const errorMessage =
        globalError instanceof Error ? globalError.message : 'Inconnue';
      console.error(`Erreur globale sendCreationNotification: ${errorMessage}`);
    }
  }

  /**
   * Retourne le label lisible du type de transaction
   */
  private getTransactionTypeLabel(
    type: TransactionType,
    isInitiator = true,
  ): string {
    if (type === TransactionType.VENTE) {
      return isInitiator ? 'Achat' : 'Vente';
    }
    const labels: Partial<Record<TransactionType, string>> = {
      [TransactionType.DEPOT]: 'Dépôt',
      [TransactionType.RETRAIT]: 'Retrait',
      [TransactionType.INITIALISATION]: 'Initialisation',
      [TransactionType.VIREMENT_DROIT]: 'Virement de droit',
      [TransactionType.ECHANGE]: 'Échange d’actifs',
    };
    return labels[type] || (type as string);
  }

  private async sendVirementDroitNotifications(
    transaction: TransactionDocument,
    initiatorId: string,
    detentaireId: string,
    beneficiaryId: string,
  ) {
    const [initiatorUser, detentaireUser, beneficiaryUser] = await Promise.all([
      this.usersService.getById(initiatorId),
      this.usersService.getById(detentaireId),
      this.usersService.getById(beneficiaryId),
    ]);

    const product = await this.productService.findById(
      transaction.productId.toString(),
    );
    const productName = product?.data?.[0]?.productName || 'Produit';
    const txType = this.getTransactionTypeLabel(TransactionType.VIREMENT_DROIT);

    const sendTo = async (user: any, recipientName: string) => {
      if (!user?.userEmail) return;
      await this.mailService.notificationTransactionApproved(
        user.userEmail,
        recipientName,
        txType,
        productName,
        transaction.quantite,
        transaction.transactionNumber,
        initiatorUser.userName,
      );
    };

    await Promise.all([
      sendTo(initiatorUser, initiatorUser.userName),
      sendTo(detentaireUser, detentaireUser.userName),
      sendTo(beneficiaryUser, beneficiaryUser.userName),
    ]);
  }

  /**
   * Exporte les transactions d'un utilisateur en CSV
   */
  async exportUserTransactions(
    userId: string,
    format: 'csv' | 'excel' | 'pdf' = 'csv',
  ): Promise<ExportResult> {
    const transactions = await this.transactionModel
      .find({
        $or: [
          { initiatorId: new Types.ObjectId(userId) },
          { recipientId: new Types.ObjectId(userId) },
        ],
      })
      .sort({ createdAt: -1 })
      .populate([
        { path: 'initiatorId', select: 'userFirstname userName' },
        { path: 'recipientId', select: 'userFirstname userName' },
        { path: 'productId', select: 'productName' },
        { path: 'siteOrigineId', select: 'siteName' },
        { path: 'siteDestinationId', select: 'siteName' },
      ])
      .exec();

    if (transactions.length === 0) {
      throw new NotFoundException(
        'Aucune transaction à exporter pour cet utilisateur',
      );
    }

    const columns = [
      { header: 'N° Transaction', key: 'transactionNumber' },
      { header: 'Type', key: 'type' },
      { header: 'Statut', key: 'status' },
      { header: 'Initiateur', key: 'initiatorId' },
      { header: 'Destinataire', key: 'recipientId' },
      { header: 'Produit', key: 'productId' },
      { header: 'Quantité', key: 'quantite' },
      { header: 'Prix Unitaire', key: 'prixUnitaire' },
      { header: 'Date', key: 'createdAt' },
    ];

    if (format === 'excel') {
      const records = transactions.map((t: any) => ({
        transactionNumber: t.transactionNumber,
        type: this.getTransactionTypeLabel(t.type),
        status: t.status,
        initiatorId: this.getName(t.initiatorId),
        recipientId: this.getName(t.recipientId),
        productId: t.productId?.productName || 'N/A',
        quantite: t.quantite,
        prixUnitaire: t.prixUnitaire ?? 'N/A',
        createdAt: t.createdAt ? new Date(t.createdAt).toLocaleString() : 'N/A',
      }));
      return this.exportService.exportExcel(
        records,
        columns,
        'Transactions',
        `export_transactions_user_${userId}_${Date.now()}.xlsx`,
      );
    }
    if (format === 'pdf') {
      const rows = transactions.map((t: any) => [
        t.transactionNumber,
        this.getTransactionTypeLabel(t.type),
        t.status,
        this.getName(t.initiatorId),
        this.getName(t.recipientId),
        t.productId?.productName || 'N/A',
        String(t.quantite ?? ''),
        String(t.prixUnitaire ?? ''),
        t.createdAt ? new Date(t.createdAt).toLocaleString() : 'N/A',
      ]);
      return this.exportService.exportPDF(
        'Transactions',
        columns.map((c) => c.header),
        rows,
        `export_transactions_user_${userId}_${Date.now()}.pdf`,
      );
    }

    return this.generateCsv(
      transactions,
      `export_transactions_user_${userId}_${Date.now()}.csv`,
    );
  }

  /**
   * Exporte toutes les transactions du système en CSV
   */
  async exportAllTransactions(
    format: 'csv' | 'excel' | 'pdf' = 'csv',
  ): Promise<ExportResult> {
    const transactions = await this.transactionModel
      .find()
      .sort({ createdAt: -1 })
      .populate([
        { path: 'initiatorId', select: 'userFirstname userName' },
        { path: 'recipientId', select: 'userFirstname userName' },
        { path: 'productId', select: 'productName' },
        { path: 'siteOrigineId', select: 'siteName' },
        { path: 'siteDestinationId', select: 'siteName' },
      ])
      .exec();

    if (transactions.length === 0) {
      throw new NotFoundException('Aucune transaction à exporter');
    }

    const columns = [
      { header: 'N° Transaction', key: 'transactionNumber' },
      { header: 'Type', key: 'type' },
      { header: 'Statut', key: 'status' },
      { header: 'Initiateur', key: 'initiatorId' },
      { header: 'Destinataire', key: 'recipientId' },
      { header: 'Produit', key: 'productId' },
      { header: 'Quantité', key: 'quantite' },
      { header: 'Prix Unitaire', key: 'prixUnitaire' },
      { header: 'Date', key: 'createdAt' },
    ];

    if (format === 'excel') {
      const records = transactions.map((t: any) => ({
        transactionNumber: t.transactionNumber,
        type: this.getTransactionTypeLabel(t.type),
        status: t.status,
        initiatorId: this.getName(t.initiatorId),
        recipientId: this.getName(t.recipientId),
        productId: t.productId?.productName || 'N/A',
        quantite: t.quantite,
        prixUnitaire: t.prixUnitaire ?? 'N/A',
        createdAt: t.createdAt ? new Date(t.createdAt).toLocaleString() : 'N/A',
      }));
      return this.exportService.exportExcel(
        records,
        columns,
        'Transactions',
        `export_transactions_all_${Date.now()}.xlsx`,
      );
    }
    if (format === 'pdf') {
      const rows = transactions.map((t: any) => [
        t.transactionNumber,
        this.getTransactionTypeLabel(t.type),
        t.status,
        this.getName(t.initiatorId),
        this.getName(t.recipientId),
        t.productId?.productName || 'N/A',
        String(t.quantite ?? ''),
        String(t.prixUnitaire ?? ''),
        t.createdAt ? new Date(t.createdAt).toLocaleString() : 'N/A',
      ]);
      return this.exportService.exportPDF(
        'Transactions',
        columns.map((c) => c.header),
        rows,
        `export_transactions_all_${Date.now()}.pdf`,
      );
    }

    return this.generateCsv(
      transactions,
      `export_transactions_all_${Date.now()}.csv`,
    );
  }

  /**
   * Génère un fichier CSV à partir d'une liste de transactions
   */
  private async generateCsv(
    transactions: any[],
    fileName: string,
  ): Promise<ExportResult> {
    const fields = [
      'date',
      'transactionNumber',
      'type',
      'status',
      'product',
      'quantite',
      'prixUnitaire',
      'valeurTotale',
      'initiator',
      'recipient',
      'siteOrigine',
      'siteDestination',
      'observations',
    ];

    const data = transactions.map((t) => ({
      date: t.createdAt ? new Date(t.createdAt).toLocaleString() : 'N/A',
      transactionNumber: t.transactionNumber,
      type: this.getTransactionTypeLabel(t.type),
      status: t.status,
      product: t.productId?.productName || 'N/A',
      quantite: t.quantite,
      prixUnitaire: t.prixUnitaire,
      valeurTotale: (t.quantite || 0) * (t.prixUnitaire || 0),
      initiator: this.getName(t.initiatorId),
      recipient: this.getName(t.recipientId),
      siteOrigine: t.siteOrigineId?.siteName || 'N/A',
      siteDestination: t.siteDestinationId?.siteName || 'N/A',
      observations: t.observations,
    }));

    return this.exportService.exportCSV(data, fields, fileName);
  }

  /**
   * Helper pour extraire un nom lisible d'un document peuplé
   */
  private getName(doc: any): string {
    if (!doc) return 'N/A';
    if (doc.userFirstname && doc.userName)
      return `${doc.userFirstname} ${doc.userName}`;
    if (doc.userName) return doc.userName;
    if (doc.name) return doc.name;
    if (doc.productName) return doc.productName;
    if (doc.siteName) return doc.siteName;
    if (doc._id) return doc._id.toString();
    return 'N/A';
  }
}
