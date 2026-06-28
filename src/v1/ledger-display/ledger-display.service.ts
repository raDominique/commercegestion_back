import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
  TransactionType,
} from '../transactions/transactions.schema';
import { Actif, ActifDocument } from '../actifs/actifs.schema';
import { Passif, PassifDocument } from '../passifs/passifs.schema';
import { User, UserDocument } from '../users/users.schema';
import {
  ExportService,
  ExportResult,
} from '../../shared/export/export.service';

/**
 * Structure d'un mouvement dans le grand livre
 */
export interface LedgerMovement {
  dateTime: Date;
  transactionId: string;
  transactionNumber: string;
  title: string;
  product: string;
  detentaire: string; // Détenteur (pour actifs) ou Ayant-droit (pour passifs)
  site: string;
  quantity: number;
  initialStock: number;
  finalStock: number;
  movementType: 'ACTIF' | 'PASSIF';
}

/**
 * Structure du grand livre pour un utilisateur
 */
export interface UserLedger {
  userId: string;
  userName: string;
  movements: {
    actifs: LedgerMovement[];
    passifs: LedgerMovement[];
  };
}

@Injectable()
export class LedgerDisplayService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Actif.name)
    private readonly actifModel: Model<ActifDocument>,
    @InjectModel(Passif.name)
    private readonly passifModel: Model<PassifDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly exportService: ExportService,
  ) {}

  /**
   * Récupère le grand livre complet pour un utilisateur
   */
  async getUserLedger(userId: string): Promise<any> {
    const userIdObj = new Types.ObjectId(userId);

    // 1. Récupérer les transactions approuvées et rejetées
    const transactions = await this.transactionModel
      .find({
        status: { $in: ['APPROVED', 'REJECTED'] },
        $or: [
          { initiatorId: userIdObj },
          { recipientId: userIdObj },
          { ayant_droit: userIdObj },
          { detentaire: userIdObj },
        ],
      })
      .sort({ approvedAt: 1 }) // Tri ascendant pour le calcul chronologique du stock
      .populate([
        { path: 'initiatorId', select: 'userFirstname userName' },
        { path: 'recipientId', select: 'userFirstname userName' },
        { path: 'productId', select: 'productName codeCPC' },
        { path: 'siteOrigineId', select: 'siteName' },
        { path: 'siteDestinationId', select: 'siteName' },
        { path: 'detentaire', select: 'userFirstname userName' },
      ])
      .exec();

    const activesMovements: any[] = [];
    const passivesMovements: any[] = [];

    // 2. Transformer les transactions en mouvements comptables
    for (const tx of transactions) {
      // Transaction rejetée → entrée informative sans impact stock
      if (tx.status === TransactionStatus.REJECTED) {
        const rejectedActif = this.mapMovement(
          tx,
          'REJETÉ',
          tx.quantite,
          'ACTIF',
          tx.siteOrigineId,
        );
        const rejectedPassif = this.mapMovement(
          tx,
          'REJETÉ',
          tx.quantite,
          'PASSIF',
          tx.siteOrigineId,
        );
        rejectedActif.isRejected = true;
        rejectedPassif.isRejected = true;
        activesMovements.push(rejectedActif);
        passivesMovements.push(rejectedPassif);
        continue;
      }

      const isInitiator = tx.initiatorId?._id?.equals(userIdObj);
      const isRecipient = tx.recipientId?._id?.equals(userIdObj);

      // --- Logique ACTIF ---
      if (tx.type === TransactionType.INITIALISATION) {
        activesMovements.push(
          this.mapMovement(
            tx,
            'INITIALISATION',
            tx.quantite,
            'ACTIF',
            tx.siteOrigineId,
          ),
        );
      } else if (tx.type === TransactionType.DEPOT) {
        if (isInitiator) {
          activesMovements.push(
            this.mapMovement(
              tx,
              'DÉPÔT (SORTIE)',
              -tx.quantite,
              'ACTIF',
              tx.siteOrigineId,
            ),
          );
        }
        if (isRecipient) {
          activesMovements.push(
            this.mapMovement(
              tx,
              'DÉPÔT (RÉCEPTION)',
              tx.quantite,
              'ACTIF',
              tx.siteDestinationId,
            ),
          );
          // Création d'un passif (dette de marchandise envers l'initiateur)
          passivesMovements.push(
            this.mapMovement(
              tx,
              'DETTE MARCHANDISE',
              tx.quantite,
              'PASSIF',
              tx.siteDestinationId,
            ),
          );
        }
      } else if (tx.type === TransactionType.RETRAIT) {
        if (isInitiator) {
          activesMovements.push(
            this.mapMovement(
              tx,
              'RETRAIT (SORTIE)',
              -tx.quantite,
              'ACTIF',
              tx.siteOrigineId,
            ),
          );
          // Diminution du passif (on rend ce qu'on devait)
          passivesMovements.push(
            this.mapMovement(
              tx,
              'RETRAIT (ANNULATION DETTE)',
              -tx.quantite,
              'PASSIF',
              tx.siteOrigineId,
            ),
          );
        }
        if (isRecipient) {
          activesMovements.push(
            this.mapMovement(
              tx,
              'RETRAIT (APPROUVÉ)',
              tx.quantite,
              'ACTIF',
              tx.siteDestinationId,
            ),
          );
        }
      }
    }

    // 3. Calculer les stocks glissants
    this.calculateRunningStocks(activesMovements);
    this.calculateRunningStocks(passivesMovements);

    return {
      userId,
      userName:
        transactions.length > 0
          ? this.extractUserName(userIdObj, transactions[0])
          : 'Utilisateur Inconnu',
      movements: {
        actifs: activesMovements.reverse(), // On inverse pour l'affichage (plus récent en premier)
        passifs: passivesMovements.reverse(),
      },
    };
  }

  private mapMovement(
    tx: any,
    title: string,
    qty: number,
    type: string,
    siteObj: any,
  ) {
    return {
      dateTime: tx.approvedAt || tx.createdAt || new Date(),
      transactionId: tx._id.toString(),
      transactionNumber: tx.transactionNumber,
      title,
      product: tx.productId?.productName || 'Produit inconnu',
      productCode: tx.productId?.codeCPC || 'N/A',
      detentaire: this.getName(tx.detentaire || tx.initiatorId),
      site:
        tx.siteDestinationId?.siteName ||
        tx.siteOrigineId?.siteName ||
        'Site non spécifié',
      quantity: qty,
      initialStock: 0,
      finalStock: 0,
      movementType: type,
      isRejected: false,
    };
  }

  private calculateRunningStocks(movements: any[]) {
    const balances: Record<string, number> = {};
    movements.forEach((m) => {
      if (m.isRejected) {
        m.initialStock = 0;
        m.finalStock = 0;
        return;
      }
      const key = m.product;
      m.initialStock = balances[key] || 0;
      m.finalStock = m.initialStock + m.quantity;
      balances[key] = m.finalStock;
    });
  }

  private extractUserName(userId: Types.ObjectId, tx: any): string {
    if (tx.initiatorId?._id?.equals(userId))
      return this.getName(tx.initiatorId);
    if (tx.recipientId?._id?.equals(userId))
      return this.getName(tx.recipientId);
    return 'Utilisateur';
  }

  /**
   * Récupère le grand livre pour tous les mouvements du système
   */
  async getGlobalLedger(
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    data: LedgerMovement[];
    total: number;
  }> {
    const skip = (page - 1) * limit;

    const transactions = await this.transactionModel
      .find({ status: TransactionStatus.APPROVED })
      .sort({ approvedAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate([
        { path: 'initiatorId', select: 'userFirstname userName' },
        { path: 'recipientId', select: 'userFirstname userName' },
        { path: 'productId', select: 'name' },
        { path: 'siteOrigineId', select: 'name' },
        { path: 'siteDestinationId', select: 'name' },
        { path: 'detentaire', select: 'userFirstname userName' },
      ])
      .exec();

    const total = await this.transactionModel.countDocuments({
      status: TransactionStatus.APPROVED,
    });

    const movements: LedgerMovement[] = [];

    for (const transaction of transactions) {
      this.addTransactionMovements(transaction, movements);
    }

    return { data: movements, total };
  }

  /**
   * Affiche les mouvements d'un produit spécifique
   */
  async getProductMovements(
    productId: string,
    userId?: string,
  ): Promise<LedgerMovement[]> {
    const productIdObj = new Types.ObjectId(productId);

    const query: any = {
      status: TransactionStatus.APPROVED,
      productId: productIdObj,
    };

    if (userId) {
      const userIdObj = new Types.ObjectId(userId);
      query.$or = [
        { initiatorId: userIdObj },
        { recipientId: userIdObj },
        { ayant_droit: userIdObj },
      ];
    }

    const transactions = await this.transactionModel
      .find(query)
      .sort({ approvedAt: -1 })
      .populate([
        { path: 'initiatorId', select: 'userFirstname userName' },
        { path: 'recipientId', select: 'userFirstname userName' },
        { path: 'productId', select: 'name' },
        { path: 'siteOrigineId', select: 'name' },
        { path: 'siteDestinationId', select: 'name' },
        { path: 'detentaire', select: 'userFirstname userName' },
      ])
      .exec();

    const movements: LedgerMovement[] = [];
    for (const transaction of transactions) {
      this.addTransactionMovements(transaction, movements);
    }

    return movements;
  }

  /**
   * Affiche la fiche de stock (stock card) pour un produit d'un utilisateur
   */
  async getStockCard(
    userId: string,
    productId: string,
  ): Promise<{
    product: string;
    currentStock: number;
    movements: LedgerMovement[];
  }> {
    const userIdObj = new Types.ObjectId(userId);
    const productIdObj = new Types.ObjectId(productId);

    const actif = await this.actifModel
      .findOne({
        userId: userIdObj,
        productId: productIdObj,
      })
      .populate([
        { path: 'productId', select: 'productName' },
        { path: 'depotId', select: 'siteName' },
      ])
      .exec();

    if (!actif) {
      throw new NotFoundException(
        `Actif not found for user ${userId} and product ${productId}`,
      );
    }

    const movements = await this.getProductMovements(productId, userId);

    return {
      product: this.getName(actif.productId),
      currentStock: actif.quantite,
      movements: movements.reverse(), // Chronologique
    };
  }

  /**
   * Ajoute les mouvements d'une transaction aux mouvements du grand livre
   */
  private addTransactionMovements(
    transaction: TransactionDocument,
    movements: LedgerMovement[],
  ): void {
    switch (transaction.type) {
      case TransactionType.INITIALISATION:
        movements.push({
          dateTime: transaction.approvedAt,
          transactionId: transaction._id.toString(),
          transactionNumber: transaction.transactionNumber,
          title: 'INITIALISATION',
          product: this.getName(transaction.productId),
          detentaire: this.getName(transaction.detentaire),
          site: this.getName(transaction.siteOrigineId),
          quantity: transaction.quantite,
          initialStock: 0,
          finalStock: transaction.quantite,
          movementType: 'ACTIF',
        });
        break;

      case TransactionType.DEPOT:
        // Mouvement de retrait (initiator)
        movements.push({
          dateTime: transaction.approvedAt,
          transactionId: transaction._id.toString(),
          transactionNumber: transaction.transactionNumber,
          title: 'DEPOSITION',
          product: this.getName(transaction.productId),
          detentaire: this.getName(transaction.initiatorId),
          site: this.getName(transaction.siteOrigineId),
          quantity: -transaction.quantite,
          initialStock: 0,
          finalStock: 0,
          movementType: 'ACTIF',
        });

        // Mouvement de réception (recipient)
        movements.push({
          dateTime: transaction.approvedAt,
          transactionId: transaction._id.toString(),
          transactionNumber: transaction.transactionNumber,
          title: 'RECEPTION',
          product: this.getName(transaction.productId),
          detentaire: this.getName(transaction.recipientId),
          site: this.getName(transaction.siteDestinationId),
          quantity: transaction.quantite,
          initialStock: 0,
          finalStock: 0,
          movementType: 'ACTIF',
        });

        // Mouvement de passif (recipient owes initiator)
        movements.push({
          dateTime: transaction.approvedAt,
          transactionId: transaction._id.toString(),
          transactionNumber: transaction.transactionNumber,
          title: 'DEPOSITION',
          product: this.getName(transaction.productId),
          detentaire: this.getName(transaction.initiatorId),
          site: this.getName(transaction.siteDestinationId),
          quantity: transaction.quantite,
          initialStock: 0,
          finalStock: 0,
          movementType: 'PASSIF',
        });
        break;

      case TransactionType.RETRAIT:
        // Mouvement de retrait (initiator returns)
        movements.push({
          dateTime: transaction.approvedAt,
          transactionId: transaction._id.toString(),
          transactionNumber: transaction.transactionNumber,
          title: 'RETRAIT',
          product: this.getName(transaction.productId),
          detentaire: this.getName(transaction.initiatorId),
          site: this.getName(transaction.siteOrigineId),
          quantity: -transaction.quantite,
          initialStock: 0,
          finalStock: 0,
          movementType: 'ACTIF',
        });

        // Mouvement de réception (recipient receives back)
        movements.push({
          dateTime: transaction.approvedAt,
          transactionId: transaction._id.toString(),
          transactionNumber: transaction.transactionNumber,
          title: 'RETRAIT',
          product: this.getName(transaction.productId),
          detentaire: this.getName(transaction.recipientId),
          site: this.getName(transaction.siteDestinationId),
          quantity: transaction.quantite,
          initialStock: 0,
          finalStock: 0,
          movementType: 'ACTIF',
        });

        // Mouvement de passif (liability cleared)
        movements.push({
          dateTime: transaction.approvedAt,
          transactionId: transaction._id.toString(),
          transactionNumber: transaction.transactionNumber,
          title: 'RETRAIT',
          product: this.getName(transaction.productId),
          detentaire: this.getName(transaction.initiatorId),
          site: this.getName(transaction.siteOrigineId),
          quantity: -transaction.quantite,
          initialStock: 0,
          finalStock: 0,
          movementType: 'PASSIF',
        });
        break;
    }
  }

  /**
   * Calcule les stocks initiaux et finaux
   */
  private calculateStocks(
    movements: LedgerMovement[],
    actifs: ActifDocument[],
  ): void {
    // Grouper par detentaire et product
    const stockMap = new Map<string, number>();

    movements.forEach((movement) => {
      const key = `${movement.detentaire}-${movement.product}-${movement.site}`;

      if (!stockMap.has(key)) {
        // Chercher le stock initial
        const initialStock =
          actifs.find(
            (a) =>
              this.getName(a.detentaire) === movement.detentaire &&
              this.getName(a.productId) === movement.product,
          )?.quantite || 0;
        stockMap.set(key, initialStock);
      }

      const currentStock = stockMap.get(key) || 0;
      movement.initialStock = currentStock;
      movement.finalStock = currentStock + movement.quantity;
      stockMap.set(key, movement.finalStock);
    });
  }

  /**
   * Récupère le nom d'un document partir de son _id
   */
  private getName(doc: any): string {
    if (!doc) return 'N/A';

    // Si c'est juste un ID (string ou ObjectId), retourner N/A pour forcer l'investigation
    if (typeof doc === 'string') {
      return 'N/A';
    }
    if (
      doc._id &&
      !doc.userFirstname &&
      !doc.userName &&
      !doc.name &&
      !doc.productName &&
      !doc.siteName
    ) {
      return 'N/A';
    }

    if (doc.userFirstname && doc.userName)
      return `${doc.userFirstname} ${doc.userName}`;
    if (doc.name) return doc.name;
    if (doc.productName) return doc.productName;
    if (doc.siteName) return doc.siteName;
    if (doc._id) return doc._id.toString();
    if (doc.id) return doc.id.toString();
    return 'N/A';
  }

  /**
   * Exporte le grand livre d'un utilisateur en CSV
   */
  async exportUserLedger(
    userId: string,
    format: 'csv' | 'excel' | 'pdf' = 'csv',
  ): Promise<ExportResult> {
    const ledger = await this.getUserLedger(userId);
    const movements = [
      ...ledger.movements.actifs,
      ...ledger.movements.passifs,
    ].sort(
      (a, b) =>
        new Date(b.dateTime || 0).getTime() -
        new Date(a.dateTime || 0).getTime(),
    );

    if (movements.length === 0) {
      throw new NotFoundException(
        'Aucun mouvement à exporter pour cet utilisateur',
      );
    }

    const columns = [
      { header: 'Date', key: 'dateTime' },
      { header: 'Type', key: 'title' },
      { header: 'Produit', key: 'product' },
      { header: 'Quantité', key: 'quantity' },
      { header: 'Site', key: 'site' },
      { header: 'Contrepartie', key: 'detentaire' },
    ];

    if (format === 'excel') {
      return this.exportService.exportExcel(
        movements,
        columns,
        'Grand livre',
        `export_ledger_user_${userId}_${Date.now()}.xlsx`,
      );
    }
    if (format === 'pdf') {
      return this.exportService.exportPDF(
        'Grand livre',
        columns.map((c) => c.header),
        movements.map((item) => columns.map((c) => String(item[c.key] ?? ''))),
        `export_ledger_user_${userId}_${Date.now()}.pdf`,
      );
    }

    const fields = [
      'dateTime',
      'transactionNumber',
      'title',
      'product',
      'productCode',
      'detentaire',
      'site',
      'quantity',
      'initialStock',
      'finalStock',
      'movementType',
    ];

    return this.exportService.exportCSV(
      movements,
      fields,
      `export_ledger_user_${userId}_${Date.now()}.csv`,
    );
  }

  /**
   * Exporte le grand livre global en CSV
   */
  async exportGlobalLedger(
    format: 'csv' | 'excel' | 'pdf' = 'csv',
  ): Promise<ExportResult> {
    // On récupère une grande quantité pour l'export (ex: 50000)
    const result = await this.getGlobalLedger(1, 50000);

    if (result.data.length === 0) {
      throw new NotFoundException('Aucun mouvement à exporter');
    }

    const columns = [
      { header: 'Date', key: 'dateTime' },
      { header: 'Type', key: 'title' },
      { header: 'Produit', key: 'product' },
      { header: 'Quantité', key: 'quantity' },
      { header: 'Site', key: 'site' },
      { header: 'Contrepartie', key: 'detentaire' },
    ];

    if (format === 'excel') {
      return this.exportService.exportExcel(
        result.data,
        columns,
        'Grand livre global',
        `export_ledger_global_${Date.now()}.xlsx`,
      );
    }
    if (format === 'pdf') {
      return this.exportService.exportPDF(
        'Grand livre global',
        columns.map((c) => c.header),
        result.data.map((item) =>
          columns.map((c) => String(item[c.key] ?? '')),
        ),
        `export_ledger_global_${Date.now()}.pdf`,
      );
    }

    const fields = [
      'dateTime',
      'transactionNumber',
      'title',
      'product',
      'detentaire',
      'site',
      'quantity',
      'initialStock',
      'finalStock',
      'movementType',
    ];

    return this.exportService.exportCSV(
      result.data,
      fields,
      `export_ledger_global_${Date.now()}.csv`,
    );
  }

  /**
   * Récupère les mouvements d'actifs et de passifs suite à un virement de droit
   * pour l'utilisateur connecté
   */
  async getUserVirementMovements(userId: string) {
    const userIdObj = new Types.ObjectId(userId);

    const user = await this.userModel
      .findById(userIdObj)
      .select('userFirstname userName')
      .lean()
      .exec();

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const transactions = await this.transactionModel
      .find({
        type: TransactionType.VIREMENT_DROIT,
        status: TransactionStatus.APPROVED,
        $or: [
          { initiatorId: userIdObj },
          { recipientId: userIdObj },
          { ayant_droit: userIdObj },
          { detentaire: userIdObj },
        ],
      })
      .sort({ approvedAt: 1 })
      .populate([
        { path: 'initiatorId', select: 'userFirstname userName' },
        { path: 'recipientId', select: 'userFirstname userName' },
        { path: 'productId', select: 'productName codeCPC' },
        { path: 'siteOrigineId', select: 'siteName' },
        { path: 'detentaire', select: 'userFirstname userName' },
        { path: 'ayant_droit', select: 'userFirstname userName' },
      ])
      .exec();

    const memberName = `${user.userFirstname} ${user.userName}`;
    const actifs: any[] = [];
    const passifs: any[] = [];
    const actifBalances: Record<string, number> = {};
    const passifBalances: Record<string, number> = {};

    for (const tx of transactions) {
      const txn: any = tx;
      const productName = this.getName(txn.productId) || 'Produit inconnu';
      const siteName = this.getName(txn.siteOrigineId) || 'Site non spécifié';
      const dateTime = txn.approvedAt || txn.createdAt || new Date();
      const numeroTransaction = txn.transactionNumber || 'N/A';
      const title = 'Virement de droit';
      const quantite = txn.quantite || 0;

      // --- ACTIFS ---
      // Entry 1: X (initiator) loses right
      const membreX = this.getName(txn.initiatorId);
      const detenteur = this.getName(txn.detentaire || txn.initiatorId);
      const actifKeyX = `${membreX}|${productName}`;
      const a1Actif = actifBalances[actifKeyX] || 0;
      actifBalances[actifKeyX] = a1Actif - quantite;

      actifs.push({
        membre: membreX,
        dateTime,
        numeroTransaction,
        title,
        product: productName,
        detenteur,
        site: siteName,
        quantite: -quantite,
        stockInitial: a1Actif,
        stockFinal: a1Actif - quantite,
      });

      // Entry 2: Z (recipient) gains right
      const membreZ = this.getName(txn.recipientId || txn.ayant_droit);
      const actifKeyZ = `${membreZ}|${productName}`;
      const a2Actif = actifBalances[actifKeyZ] || 0;
      actifBalances[actifKeyZ] = a2Actif + quantite;

      actifs.push({
        membre: membreZ,
        dateTime,
        numeroTransaction,
        title,
        product: productName,
        detenteur,
        site: siteName,
        quantite: +quantite,
        stockInitial: a2Actif,
        stockFinal: a2Actif + quantite,
      });

      // --- PASSIFS ---
      // Entry 3: Y (detentaire) debt to X decreases
      const membreY = this.getName(txn.detentaire);
      const ayantDroitX = this.getName(txn.initiatorId);
      const passifKeyX = `${membreY}|${productName}|${ayantDroitX}`;
      const a1Passif = passifBalances[passifKeyX] || 0;
      passifBalances[passifKeyX] = a1Passif - quantite;

      passifs.push({
        membre: membreY,
        dateTime,
        numeroTransaction,
        title,
        product: productName,
        ayantDroit: ayantDroitX,
        site: siteName,
        quantite: -quantite,
        stockInitial: a1Passif,
        stockFinal: a1Passif - quantite,
      });

      // Entry 4: Y (detentaire) debt to Z increases
      const ayantDroitZ = this.getName(txn.recipientId || txn.ayant_droit);
      const passifKeyZ = `${membreY}|${productName}|${ayantDroitZ}`;
      const a2Passif = passifBalances[passifKeyZ] || 0;
      passifBalances[passifKeyZ] = a2Passif + quantite;

      passifs.push({
        membre: membreY,
        dateTime,
        numeroTransaction,
        title,
        product: productName,
        ayantDroit: ayantDroitZ,
        site: siteName,
        quantite: +quantite,
        stockInitial: a2Passif,
        stockFinal: a2Passif + quantite,
      });
    }

    return {
      memberName,
      generatedAt: new Date(),
      actifs,
      passifs,
    };
  }

  /**
   * Récupère le nom d'un utilisateur depuis les transactions
   */
  private getUserName(transactions: TransactionDocument[]): string {
    if (transactions.length === 0) return 'Unknown User';
    const firstTransaction = transactions[0];
    if (firstTransaction.initiatorId) {
      const initiator = firstTransaction.populated('initiatorId');
      if (initiator && typeof initiator !== 'string') {
        return this.getName(initiator);
      }
    }
    return 'Unknown User';
  }

  /**
   * Récupère les ACTIFS BRUTS (Stock Movement + Transaction) pour un utilisateur avec pagination et search
   * Ceci affiche les actifs créés par TOUS les mouvements (Stock Movement + Transaction)
   * C'est l'endpoint critique pour afficher les actifs du /stock/depot
   */
  async getActifsWithPagination(
    userId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const userIdObj = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    // Construire le filtre pour la recherche
    const filter: any = {
      userId: userIdObj,
      isActive: true, // Uniquement les actifs actifs (quantité > 0)
    };

    if (search) {
      // Si search fourni, chercher par productId partiellement ou par autres champs
      try {
        // Essayer de chercher par ObjectId si c'est un ID valide
        const searchObjId = new Types.ObjectId(search);
        filter.$or = [{ productId: searchObjId }, { depotId: searchObjId }];
      } catch {
        // Sinon, ignorer si c'est pas un ObjectId valide
      }
    }

    // Récupérer les actifs bruts avec pagination
    const [actifs, total] = await Promise.all([
      this.actifModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          {
            path: 'productId',
            select:
              'productName codeCPC productImage prixUnitaire productVolume',
          },
          {
            path: 'depotId',
            select: 'siteId siteName siteAddress location siteUserID',
            populate: {
              path: 'siteUserID',
              select: 'userName userNickName',
            },
          },
          {
            path: 'detentaire',
            select: '_id userName userNickName userPhone',
          },
          {
            path: 'ayant_droit',
            select: '_id userName userNickName userPhone',
          },
        ])
        .lean()
        .exec() as any,
      this.actifModel.countDocuments(filter),
    ]);

    // Formater les données pour une meilleure lisibilité
    const formattedActifs = (actifs || []).map((actif: any) => ({
      id: actif._id,
      productId: actif.productId?._id || 'N/A',
      productName: actif.productId?.productName || 'N/A',
      productCode: actif.productId?.codeCPC || 'N/A',
      productImage: actif.productId?.productImage || null,
      quantite: actif.quantite,
      prixUnitaire: actif.prixUnitaire,
      valeurTotale: (actif.quantite || 0) * (actif.prixUnitaire || 0),
      depotId: actif.depotId?._id || 'N/A',
      depot: actif.depotId?.siteName || 'N/A',
      depotAdresse: actif.depotId?.siteAddress || 'N/A',
      detentaire: actif.detentaire
        ? `${actif.detentaire.userNickName} ${actif.detentaire.userName}`
        : 'N/A',
      detentaireId: actif.detentaire?._id || null,
      ayantDroit: actif.ayant_droit
        ? `${actif.ayant_droit.userNickName} ${actif.ayant_droit.userName}`
        : 'N/A',
      ayantDroitId: actif.ayant_droit?._id || null,
      dateCreation: actif.createdAt,
      dateModification: actif.updatedAt,
      isActive: actif.isActive,
    }));

    return {
      data: formattedActifs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Récupère les PASSIFS BRUTS (Stock Movement + Transaction) pour un utilisateur avec pagination et search
   * Ceci affiche les passifs créés par TOUS les mouvements (Stock Movement + Transaction)
   * C'est l'endpoint critique pour afficher les passifs du /stock/depot
   */
  async getPassifsWithPagination(
    userId: string,
    page: number = 1,
    limit: number = 10,
    search?: string,
  ): Promise<{
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const userIdObj = new Types.ObjectId(userId);
    const skip = (page - 1) * limit;

    // Construire le filtre pour la recherche
    const filter: any = {
      userId: userIdObj,
      isActive: true, // Uniquement les passifs actifs (quantité > 0)
    };

    if (search) {
      // Si search fourni, chercher par productId partiellement ou par autres champs
      try {
        // Essayer de chercher par ObjectId si c'est un ID valide
        const searchObjId = new Types.ObjectId(search);
        filter.$or = [{ productId: searchObjId }, { depotId: searchObjId }];
      } catch {
        // Sinon, ignorer si c'est pas un ObjectId valide
      }
    }

    // Récupérer les passifs bruts avec pagination
    const [passifs, total] = await Promise.all([
      this.passifModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate([
          {
            path: 'productId',
            select:
              'productName codeCPC productImage prixUnitaire productVolume',
          },
          {
            path: 'depotId',
            select: 'siteId siteName siteAddress location siteUserID',
            populate: {
              path: 'siteUserID',
              select: 'userName userNickName',
            },
          },
          {
            path: 'detentaire',
            select: 'userName userNickName userPhone',
          },
          {
            path: 'ayant_droit',
            select: 'userName userNickName userPhone',
          },
        ])
        .lean()
        .exec() as any,
      this.passifModel.countDocuments(filter),
    ]);

    // Formater les données pour une meilleure lisibilité
    const formattedPassifs = (passifs || []).map((passif: any) => ({
      id: passif._id,
      productId: passif.productId?._id || 'N/A',
      productName: passif.productId?.productName || 'N/A',
      productCode: passif.productId?.codeCPC || 'N/A',
      productImage: passif.productId?.productImage || null,
      quantite: passif.quantite,
      prixUnitaire: passif.prixUnitaire,
      valeurTotale: (passif.quantite || 0) * (passif.prixUnitaire || 0),
      depotId: passif.depotId?._id || 'N/A',
      depot: passif.depotId?.siteName || 'N/A',
      depotAdresse: passif.depotId?.siteAddress || 'N/A',
      detentaire: passif.detentaire
        ? `${passif.detentaire.userNickName} ${passif.detentaire.userName}`
        : 'N/A',
      ayantDroit: passif.ayant_droit
        ? `${passif.ayant_droit.userNickName} ${passif.ayant_droit.userName}`
        : 'N/A',
      detentaireId: passif.detentaire?._id || null,
      ayantDroitId: passif.ayant_droit?._id || null,
      dateCreation: passif.createdAt,
      dateModification: passif.updatedAt,
      isActive: passif.isActive,
    }));

    return {
      data: formattedPassifs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Statistique de tous les actifs  et passifs
   *qui peut afficher dans le dashboard
   */
  async getActifsAndPassifsStats(userId: string): Promise<{
    actifs: number;
    passifs: number;
    quantiteTotaleActifs: number;
    quantiteTotalePassifs: number;
  }> {
    const userIdObj = new Types.ObjectId(userId);

    // Calculer les statistiques des actifs
    const actifsStats = await this.actifModel.aggregate([
      {
        $match: { userId: userIdObj },
      },
      {
        $group: {
          _id: null,
          actifs: { $sum: 1 },
          quantiteTotaleActifs: {
            $sum: '$quantite',
          },
        },
      },
    ]);

    // Calculer les statistiques des passifs
    const passifsStats = await this.passifModel.aggregate([
      {
        $match: { userId: userIdObj },
      },
      {
        $group: {
          _id: null,
          passifs: { $sum: 1 },
          quantiteTotalePassifs: {
            $sum: '$quantite',
          },
        },
      },
    ]);

    return {
      actifs: actifsStats[0]?.actifs || 0,
      passifs: passifsStats[0]?.passifs || 0,
      quantiteTotaleActifs: actifsStats[0]?.quantiteTotaleActifs || 0,
      quantiteTotalePassifs: passifsStats[0]?.quantiteTotalePassifs || 0,
    };
  }

  /**
   * Statistique des actifs et passifs par site
   */
  async getActifsAndPassifsStatsBySite(userId: string): Promise<{
    actifs: number;
    passifs: number;
    quantiteTotaleActifs: number;
    quantiteTotalePassifs: number;
  }> {
    const userIdObj = new Types.ObjectId(userId);

    // Calculer les statistiques des actifs
    const actifsStats = await this.actifModel.aggregate([
      {
        $match: { userId: userIdObj },
      },
      {
        $group: {
          _id: null,
          actifs: { $sum: 1 },
          quantiteTotaleActifs: {
            $sum: '$quantite',
          },
        },
      },
    ]);

    // Calculer les statistiques des passifs
    const passifsStats = await this.passifModel.aggregate([
      {
        $match: { userId: userIdObj },
      },
      {
        $group: {
          _id: null,
          passifs: { $sum: 1 },
          quantiteTotalePassifs: {
            $sum: '$quantite',
          },
        },
      },
    ]);

    return {
      actifs: actifsStats[0]?.actifs || 0,
      passifs: passifsStats[0]?.passifs || 0,
      quantiteTotaleActifs: actifsStats[0]?.quantiteTotaleActifs || 0,
      quantiteTotalePassifs: passifsStats[0]?.quantiteTotalePassifs || 0,
    };
  }

  /**
   * Statistique des actifs et passifs par produit
   */
  async getActifsAndPassifsStatsByProduct(userId: string): Promise<{
    actifs: number;
    passifs: number;
    quantiteTotaleActifs: number;
    quantiteTotalePassifs: number;
  }> {
    const userIdObj = new Types.ObjectId(userId);

    // Calculer les statistiques des actifs
    const actifsStats = await this.actifModel.aggregate([
      {
        $match: { userId: userIdObj },
      },
      {
        $group: {
          _id: null,
          actifs: { $sum: 1 },
          quantiteTotaleActifs: {
            $sum: '$quantite',
          },
        },
      },
    ]);

    // Calculer les statistiques des passifs
    const passifsStats = await this.passifModel.aggregate([
      {
        $match: { userId: userIdObj },
      },
      {
        $group: {
          _id: null,
          passifs: { $sum: 1 },
          quantiteTotalePassifs: {
            $sum: '$quantite',
          },
        },
      },
    ]);

    return {
      actifs: actifsStats[0]?.actifs || 0,
      passifs: passifsStats[0]?.passifs || 0,
      quantiteTotaleActifs: actifsStats[0]?.quantiteTotaleActifs || 0,
      quantiteTotalePassifs: passifsStats[0]?.quantiteTotalePassifs || 0,
    };
  }

  /**
   * Statistique des actifs et passifs avec détails par produit
   */
  async getActifsAndPassifsWithDetailsByProduct(userId: string): Promise<{
    actifs: number;
    passifs: number;
    quantiteTotaleActifs: number;
    quantiteTotalePassifs: number;
    actifsDetails: any[];
    passifsDetails: any[];
  }> {
    const userIdObj = new Types.ObjectId(userId);

    // Calculer les statistiques des actifs
    const actifsStats = await this.actifModel.aggregate([
      {
        $match: { userId: userIdObj },
      },
      {
        $group: {
          _id: null,
          actifs: { $sum: 1 },
          quantiteTotaleActifs: {
            $sum: '$quantite',
          },
        },
      },
    ]);

    // Calculer les statistiques des passifs
    const passifsStats = await this.passifModel.aggregate([
      {
        $match: { userId: userIdObj },
      },
      {
        $group: {
          _id: null,
          passifs: { $sum: 1 },
          quantiteTotalePassifs: {
            $sum: '$quantite',
          },
        },
      },
    ]);

    // Récupérer les détails des actifs
    const actifsDetails = await this.actifModel
      .find({
        userId: userIdObj,
      })
      .populate([
        {
          path: 'productId',
          select: 'productName codeCPC productImage',
        },
        {
          path: 'depotId',
          select: 'siteName',
        },
      ]);

    // Récupérer les détails des passifs
    const passifsDetails = await this.passifModel
      .find({
        userId: userIdObj,
      })
      .populate([
        {
          path: 'productId',
          select: 'productName codeCPC productImage',
        },
        {
          path: 'depotId',
          select: 'siteName',
        },
      ]);

    return {
      actifs: actifsStats[0]?.actifs || 0,
      passifs: passifsStats[0]?.passifs || 0,
      quantiteTotaleActifs: actifsStats[0]?.quantiteTotaleActifs || 0,
      quantiteTotalePassifs: passifsStats[0]?.quantiteTotalePassifs || 0,
      actifsDetails,
      passifsDetails,
    };
  }
}
