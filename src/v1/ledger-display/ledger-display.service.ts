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
  ) {}

  /**
   * Récupère le grand livre complet pour un utilisateur
   */
  async getUserLedger(userId: string): Promise<any> {
    const userIdObj = new Types.ObjectId(userId);

    // 1. Récupérer les transactions approuvées
    const transactions = await this.transactionModel
      .find({
        status: 'APPROVED',
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
      } else if (tx.type === TransactionType.RETOUR) {
        if (isInitiator) {
          activesMovements.push(
            this.mapMovement(
              tx,
              'RETOUR (SORTIE)',
              -tx.quantite,
              'ACTIF',
              tx.siteOrigineId,
            ),
          );
          // Diminution du passif (on rend ce qu'on devait)
          passivesMovements.push(
            this.mapMovement(
              tx,
              'RETOUR (ANNULATION DETTE)',
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
              'RETOUR (REÇU)',
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
      dateTime: tx.approvedAt,
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
    };
  }

  private calculateRunningStocks(movements: any[]) {
    const balances: Record<string, number> = {};
    movements.forEach((m) => {
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

      case TransactionType.RETOUR:
        // Mouvement de retrait (initiator returns)
        movements.push({
          dateTime: transaction.approvedAt,
          transactionId: transaction._id.toString(),
          transactionNumber: transaction.transactionNumber,
          title: 'RETOUR',
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
          title: 'RETOUR',
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
          title: 'RETOUR',
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
    if (doc._id && !doc.useruserFirstname && !doc.userName && !doc.name && !doc.productName && !doc.siteName) {
      return 'N/A';
    }
    
    if (doc.useruserFirstname && doc.userName)
      return `${doc.useruserFirstname} ${doc.userName}`;
    if (doc.name) return doc.name;
    if (doc.productName) return doc.productName;
    if (doc.siteName) return doc.siteName;
    if (doc._id) return doc._id.toString();
    if (doc.id) return doc.id.toString();
    return 'N/A';
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
            select: 'userName userNickName userPhone',
          },
          {
            path: 'ayant_droit',
            select: 'userName userNickName userPhone',
          },
        ])
        .lean()
        .exec() as any,
      this.actifModel.countDocuments(filter),
    ]);

    // Formater les données pour une meilleure lisibilité
    const formattedActifs = (actifs || []).map((actif: any) => ({
      id: actif._id,
      productName: (actif.productId as any)?.productName || 'N/A',
      productCode: (actif.productId as any)?.codeCPC || 'N/A',
      productImage: (actif.productId as any)?.productImage || null,
      quantite: actif.quantite,
      prixUnitaire: actif.prixUnitaire,
      valeurTotale: (actif.quantite || 0) * (actif.prixUnitaire || 0),
      depotId: (actif.depotId as any)?._id || 'N/A',
      depot: (actif.depotId as any)?.siteName || 'N/A',
      depotAdresse: (actif.depotId as any)?.siteAddress || 'N/A',
      detentaire: (actif.detentaire as any)
        ? `${(actif.detentaire as any).userName} (${(actif.detentaire as any).userNickName})`
        : 'N/A',
      ayantDroit: (actif.ayant_droit as any)
        ? `${(actif.ayant_droit as any).userName} (${(actif.ayant_droit as any).userNickName})`
        : 'N/A',
      dateCreation: (actif as any).createdAt,
      dateModification: (actif as any).updatedAt,
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
}
