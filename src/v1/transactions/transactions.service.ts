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
import { UploadService } from 'src/shared/upload/upload.service';
import { ExportService } from '../../shared/export/export.service';
const { Parser: Json2CsvParser } = require('json2csv');

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
    private readonly uploadService: UploadService,
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

    // reduire la quantité du produit dans le stock du déposant (site d'origine) en attendant l'approbation
    await this.actifsService.decreaseActif(
      createDepositDto.ayant_droit, // userId: Qui dépose (détenteur)
      createDepositDto.siteOrigineId, // siteId: Site d'origine
      createDepositDto.productId, // productId: Le produit
      createDepositDto.quantite, // quantite: Diminuer la quantité du stock du déposant
    );
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
    transaction.isActive = false;

    const updatedTransaction = await transaction.save();

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
      const initiatorId = transaction.initiatorId.toString(); // Qui retourne (détenteur)
      const recipientId = transaction.recipientId.toString(); // Propriétaire (ayant-droit)
      const productId = transaction.productId.toString();
      const originSiteId = transaction.siteOrigineId.toString();
      const destinationSiteId = transaction.siteDestinationId.toString();
      const quantity = transaction.quantite;
      const unitPrice = transaction.prixUnitaire || 0;

      // 1. Diminuer l'actif de l'initiator (ayant droit) au site d'origine
      await this.actifsService.decreaseActif(
        initiatorId,
        originSiteId,
        productId,
        quantity,
      );

      // 2. Augmenter l'actif du recipient (detenteur) au site de destination
      await this.actifsService.addOrIncreaseActif(
        recipientId, // userId: Propriétaire du bilan
        destinationSiteId, // depotId: Site physique
        productId, // productId: Le produit
        quantity, // quantite
        unitPrice, // prixUnitaire
        recipientId, // detentaireId: Qui garde le produit (maintenant le propriétaire)
        recipientId, // ayantDroitId: Qui possède le produit (le propriétaire)
      );

      // 3. Diminuer le passif du recipient envers l'initiator
      await this.passifsService.decreasePassifByCreditor(
        recipientId, // detentaireId: Qui devait (le recipient)
        productId, // productId
        initiatorId, // creancierId: À qui il devait (l'initiator/propriétaire)
        quantity, // quantite: Diminuer la dette
      );

      // 4. Ajouter dans les passifs du initiateur
      await this.passifsService.addOrIncreasePassif(
        initiatorId, // detentaireId: Qui devait (le recipient)
        destinationSiteId, // depotId
        recipientId, // creancierId: À qui il devait (l'initiator/propriétaire)
        quantity, // quantite: Diminuer la dette,
        initiatorId, //detentaireId:Qui doit
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
  ): Promise<PaginationResult<TransactionDocument>> {
    const skip = (page - 1) * limit;
    const query = {
      $or: [
        { initiatorId: new Types.ObjectId(userId) },
        { recipientId: new Types.ObjectId(userId) },
      ],
    };

    if (status) {
      query['status'] = status;
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
      const transactionType = this.getTransactionTypeLabel(transaction.type);

      const approverUser = await this.usersService.getById(approverId);
      const approverName = approverUser.userName;

      // Récupérer les infos du destinataire via la base de données
      const recipientUser = await this.usersService.getById(
        transaction.recipientId?.toString(),
      );
      const recipientEmail = recipientUser.userEmail;

      await this.mailService.notificationTransactionApproved(
        recipientEmail,
        recipientUser.userName,
        transactionType,
        transaction.productId.toString(),
        transaction.quantite,
        transaction.transactionNumber,
        approverName,
      );

      console.log(
        `Approval notification sent for transaction: ${transaction.transactionNumber}`,
      );

      // Envoyer aussi la notification au déposant/initiator que sa transaction a été approuvée
      const initiatorUser = await this.usersService.getById(
        transaction.initiatorId.toString(),
      );
      const initiatorEmail = initiatorUser.userEmail;
      await this.mailService.notificationTransactionApproved(
        initiatorEmail,
        initiatorUser.userName,
        transactionType,
        transaction.productId.toString(),
        transaction.quantite,
        transaction.transactionNumber,
        approverName,
      );
      console.log(
        `Approval notification sent to initiator for transaction: ${transaction.transactionNumber}`,
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
      const transactionType = this.getTransactionTypeLabel(transaction.type);

      const approverUser = await this.usersService.getById(approuverId);
      const approverName = approverUser.userName;

      // Récupérer les infos du destinataire via la base de données
      const recipientUser = await this.usersService.getById(
        transaction.recipientId.toString(),
      );
      const recipientEmail = recipientUser.userEmail;

      await this.mailService.notificationTransactionRejected(
        recipientEmail,
        recipientUser.userName,
        transactionType,
        transaction.productId.toString(),
        transaction.quantite,
        transaction.transactionNumber,
        rejectionReason,
        approverName,
      );

      console.log(
        `Rejection notification sent for transaction: ${transaction.transactionNumber}`,
      );

      // Envoyer aussi la notification au déposant/initiator que sa transaction a été rejetée
      const initiatorUser = await this.usersService.getById(
        transaction.initiatorId.toString(),
      );
      const initiatorEmail = initiatorUser.userEmail;
      await this.mailService.notificationTransactionRejected(
        initiatorEmail,
        initiatorUser.userName,
        transactionType,
        transaction.productId.toString(),
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

      const transactionType = this.getTransactionTypeLabel(transaction.type);

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

      // --- ÉTAPE 1 : Mail au DESTINATAIRE ---
      if (recipientUser && recipientUser.userEmail) {
        try {
          await this.mailService.notificationTransactionCreated(
            recipientUser.userEmail,
            recipientUser.userName,
            transactionType,
            productName,
            transaction.quantite,
            transaction.transactionNumber,
            true, // isDestinataire: TRUE pour que le destinataire reçoive le bon template
            initiatorUser.userName,
          );
          console.log(
            `Mail envoyé au DESTINATAIRE (${recipientUser.userName})`,
          );
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(`Échec envoi mail au destinataire: ${errorMessage}`);
        }
      } else if (recipientId) {
        console.warn(
          `[Notification Warning] Destinataire introuvable ou sans email: ${recipientId}`,
        );
      }

      // --- ÉTAPE 2 : Mail à l'INITIATEUR ---
      if (initiatorUser.userEmail) {
        try {
          await this.mailService.notificationTransactionCreated(
            initiatorUser.userEmail,
            initiatorUser.userName,
            transactionType,
            productName,
            transaction.quantite,
            transaction.transactionNumber,
            false, // isDestinataire: FALSE pour l'initiateur
            recipientUser?.userName || 'Inconnu',
          );
          console.log(`Mail envoyé à l'INITIATEUR (${initiatorUser.userName})`);
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(`Échec envoi mail à l'initiateur: ${errorMessage}`);
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
  private getTransactionTypeLabel(type: TransactionType): string {
    const labels: Partial<Record<TransactionType, string>> = {
      [TransactionType.DEPOT]: 'Dépôt',
      [TransactionType.RETRAIT]: 'Retrait',
      [TransactionType.INITIALISATION]: 'Initialisation',
    };
    return labels[type] || (type as string);
  }

  /**
   * Exporte les transactions d'un utilisateur en CSV
   */
  async exportUserTransactions(userId: string, format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<string> {
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

    const subfolder = 'transactions-export';
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
      return this.exportService.exportExcel(records, columns, 'Transactions', subfolder);
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
      return this.exportService.exportPDF('Transactions', columns.map(c => c.header), rows, subfolder);
    }

    return this.generateCsv(
      transactions,
      `export_transactions_user_${userId}_${Date.now()}.csv`,
    );
  }

  /**
   * Exporte toutes les transactions du système en CSV
   */
  async exportAllTransactions(format: 'csv' | 'excel' | 'pdf' = 'csv'): Promise<string> {
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

    const subfolder = 'transactions-export';
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
      return this.exportService.exportExcel(records, columns, 'Transactions', subfolder);
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
      return this.exportService.exportPDF('Transactions', columns.map(c => c.header), rows, subfolder);
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
  ): Promise<string> {
    const fields = [
      {
        label: 'Date',
        value: (row: any) =>
          row.createdAt ? new Date(row.createdAt).toLocaleString() : 'N/A',
      },
      { label: 'N° Transaction', value: 'transactionNumber' },
      {
        label: 'Type',
        value: (row: any) => this.getTransactionTypeLabel(row.type),
      },
      { label: 'Statut', value: 'status' },
      {
        label: 'Produit',
        value: (row: any) => row.productId?.productName || 'N/A',
      },
      { label: 'Quantité', value: 'quantite' },
      { label: 'Prix Unitaire', value: 'prixUnitaire' },
      {
        label: 'Valeur Totale',
        value: (row: any) => (row.quantite || 0) * (row.prixUnitaire || 0),
      },
      {
        label: 'Initiateur',
        value: (row: any) => this.getName(row.initiatorId),
      },
      {
        label: 'Destinataire',
        value: (row: any) => this.getName(row.recipientId),
      },
      {
        label: 'Site Origine',
        value: (row: any) => row.siteOrigineId?.siteName || 'N/A',
      },
      {
        label: 'Site Destination',
        value: (row: any) => row.siteDestinationId?.siteName || 'N/A',
      },
      { label: 'Observations', value: 'observations' },
    ];

    const json2csv = new Json2CsvParser({ fields });
    const csvData = json2csv.parse(transactions);

    const buffer = Buffer.from(csvData, 'utf-8');
    const fakeFile = {
      buffer,
      originalname: fileName,
      mimetype: 'text/csv',
    } as any;

    return await this.uploadService.saveFile(fakeFile, 'transactions-export');
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
