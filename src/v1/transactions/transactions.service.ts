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
import { LoggerService } from 'src/common/logger/logger.service';

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
    private readonly loggers: LoggerService,
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
      type: TransactionType.RETOUR,
      status: TransactionStatus.PENDING,
      initiatorId: new Types.ObjectId(createReturnDto.detentaire),
      recipientId: new Types.ObjectId(createReturnDto.ayant_droit),
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
      status: TransactionStatus.PENDING,
      initiatorId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(createInitDto.productId),
      siteOrigineId: new Types.ObjectId(createInitDto.siteOrigineId),
      siteDestinationId: new Types.ObjectId(createInitDto.siteOrigineId),
      quantite: createInitDto.quantite,
      prixUnitaire: createInitDto.prixUnitaire || null,
      detentaire: new Types.ObjectId(userId),
      ayant_droit: new Types.ObjectId(userId),
      observations: createInitDto.observations || null,
      isActive: true,
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
    this.sendApprovalNotification(updatedTransaction, 'Admin').catch(
      (error) => {
        console.error('Failed to send approval notification:', error);
      },
    );

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
      'Admin',
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
      case TransactionType.RETOUR:
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

      // 1. Diminuer l'actif de l'initiator (détenteur) au site d'origine
      await this.actifsService.decreaseActif(
        initiatorId,
        originSiteId,
        productId,
        quantity,
      );

      // 2. Augmenter l'actif du recipient (propriétaire) au site de destination
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
    approverName: string = 'Admin',
  ): Promise<void> {
    try {
      this.loggers.debug(
        'sendApprovalNotification',
        `Sending approval notification for transaction: ${transaction.transactionNumber}`,
      );
      const transactionType = this.getTransactionTypeLabel(transaction.type);

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
    approverName: string = 'Admin',
  ): Promise<void> {
    try {
      const transactionType = this.getTransactionTypeLabel(transaction.type);

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
      const productName = transaction.productId.toString();

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
      [TransactionType.RETOUR]: 'Retour',
      [TransactionType.INITIALISATION]: 'Initialisation',
    };
    return labels[type] || (type as string);
  }
}
