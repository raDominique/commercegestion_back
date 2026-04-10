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
  holder: string; // Détenteur (pour actifs) ou Ayant-droit (pour passifs)
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
   * Affiche les actifs et passifs avec mouvements historiques
   */
  async getUserLedger(userId: string): Promise<UserLedger> {
    const userIdObj = new Types.ObjectId(userId);

    // Récupérer toutes les transactions approuvées de l'utilisateur
    const transactions = await this.transactionModel
      .find({
        status: TransactionStatus.APPROVED,
        $or: [
          { initiatorId: userIdObj },
          { recipientId: userIdObj },
          { ayant_droit: userIdObj },
          { detentaire: userIdObj },
        ],
      })
      .sort({ approvedAt: -1 })
      .populate([
        { path: 'initiatorId', select: 'firstName lastName' },
        { path: 'recipientId', select: 'firstName lastName' },
        { path: 'productId', select: 'name codeCPC' },
        { path: 'siteOrigineId', select: 'name' },
        { path: 'siteDestinationId', select: 'name' },
      ])
      .exec();

    // Récupérer les actifs de l'utilisateur
    const actifs = await this.actifModel
      .find({ userId: userIdObj })
      .populate([
        { path: 'productId', select: 'name' },
        { path: 'depotId', select: 'name' },
        { path: 'detentaire', select: 'firstName lastName' },
        { path: 'ayant_droit', select: 'firstName lastName' },
      ])
      .exec();

    // Construire les mouvements d'actifs
    const activesMovements: LedgerMovement[] = [];
    const passivesMovements: LedgerMovement[] = [];

    // Traiter les transactions pour créer les mouvements
    for (const transaction of transactions) {
      if (transaction.status === TransactionStatus.APPROVED) {
        if (transaction.type === TransactionType.INITIALISATION) {
          // Pour l'initialisation, ajouter un mouvement actif
          activesMovements.push({
            dateTime: transaction.approvedAt,
            transactionId: transaction._id.toString(),
            transactionNumber: transaction.transactionNumber,
            title: 'INITIALISATION',
            product: this.getName(transaction.productId),
            holder: this.getName(transaction.detentaire),
            site: this.getName(transaction.siteOrigineId),
            quantity: transaction.quantite,
            initialStock: 0, // À calculer depuis les actifs
            finalStock: transaction.quantite, // À calculer depuis les actifs
            movementType: 'ACTIF',
          });
        } else if (transaction.type === TransactionType.DEPOT) {
          // Pour un dépôt: mouvement négatif pour l'initiateur, positif pour le recipient
          if (transaction.initiatorId.equals(userIdObj)) {
            activesMovements.push({
              dateTime: transaction.approvedAt,
              transactionId: transaction._id.toString(),
              transactionNumber: transaction.transactionNumber,
              title: 'Mametráka',
              product: this.getName(transaction.productId),
              holder: this.getName(transaction.initiatorId),
              site: this.getName(transaction.siteOrigineId),
              quantity: -transaction.quantite, // Négatif (diminution)
              initialStock: 0,
              finalStock: 0,
              movementType: 'ACTIF',
            });
          }

          if (transaction.recipientId.equals(userIdObj)) {
            activesMovements.push({
              dateTime: transaction.approvedAt,
              transactionId: transaction._id.toString(),
              transactionNumber: transaction.transactionNumber,
              title: 'Mametráka',
              product: this.getName(transaction.productId),
              holder: this.getName(transaction.recipientId),
              site: this.getName(transaction.siteDestinationId),
              quantity: transaction.quantite, // Positif (augmentation)
              initialStock: 0,
              finalStock: 0,
              movementType: 'ACTIF',
            });

            // Ajouter aussi un passif
            passivesMovements.push({
              dateTime: transaction.approvedAt,
              transactionId: transaction._id.toString(),
              transactionNumber: transaction.transactionNumber,
              title: 'Mametráka',
              product: this.getName(transaction.productId),
              holder: this.getName(transaction.initiatorId),
              site: this.getName(transaction.siteDestinationId),
              quantity: transaction.quantite,
              initialStock: 0,
              finalStock: 0,
              movementType: 'PASSIF',
            });
          }
        } else if (transaction.type === TransactionType.RETOUR) {
          // Pour un retour: inverse du dépôt
          if (transaction.initiatorId.equals(userIdObj)) {
            activesMovements.push({
              dateTime: transaction.approvedAt,
              transactionId: transaction._id.toString(),
              transactionNumber: transaction.transactionNumber,
              title: 'RETOUR',
              product: this.getName(transaction.productId),
              holder: this.getName(transaction.initiatorId),
              site: this.getName(transaction.siteOrigineId),
              quantity: -transaction.quantite, // Négatif (diminution)
              initialStock: 0,
              finalStock: 0,
              movementType: 'ACTIF',
            });
          }

          if (transaction.recipientId.equals(userIdObj)) {
            activesMovements.push({
              dateTime: transaction.approvedAt,
              transactionId: transaction._id.toString(),
              transactionNumber: transaction.transactionNumber,
              title: 'RETOUR',
              product: this.getName(transaction.productId),
              holder: this.getName(transaction.recipientId),
              site: this.getName(transaction.siteDestinationId),
              quantity: transaction.quantite, // Positif (augmentation)
              initialStock: 0,
              finalStock: 0,
              movementType: 'ACTIF',
            });

            // Ajouter aussi un passif diminué
            passivesMovements.push({
              dateTime: transaction.approvedAt,
              transactionId: transaction._id.toString(),
              transactionNumber: transaction.transactionNumber,
              title: 'RETOUR',
              product: this.getName(transaction.productId),
              holder: this.getName(transaction.initiatorId),
              site: this.getName(transaction.siteOrigineId),
              quantity: -transaction.quantite, // Négatif
              initialStock: 0,
              finalStock: 0,
              movementType: 'PASSIF',
            });
          }
        }
      }
    }

    // Calculer les stocks initiaux et finaux
    this.calculateStocks(activesMovements, actifs);
    this.calculateStocks(passivesMovements, actifs);

    return {
      userId,
      userName: this.getUserName(transactions),
      movements: {
        actifs: activesMovements,
        passifs: passivesMovements,
      },
    };
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
        { path: 'initiatorId', select: 'firstName lastName' },
        { path: 'recipientId', select: 'firstName lastName' },
        { path: 'productId', select: 'name' },
        { path: 'siteOrigineId', select: 'name' },
        { path: 'siteDestinationId', select: 'name' },
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
        { path: 'initiatorId', select: 'firstName lastName' },
        { path: 'recipientId', select: 'firstName lastName' },
        { path: 'productId', select: 'name' },
        { path: 'siteOrigineId', select: 'name' },
        { path: 'siteDestinationId', select: 'name' },
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
        { path: 'productId', select: 'name' },
        { path: 'depotId', select: 'name' },
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
          holder: this.getName(transaction.detentaire),
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
          title: 'Mametráka',
          product: this.getName(transaction.productId),
          holder: this.getName(transaction.initiatorId),
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
          title: 'Mametráka',
          product: this.getName(transaction.productId),
          holder: this.getName(transaction.recipientId),
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
          title: 'Mametráka',
          product: this.getName(transaction.productId),
          holder: this.getName(transaction.initiatorId),
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
          holder: this.getName(transaction.initiatorId),
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
          holder: this.getName(transaction.recipientId),
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
          holder: this.getName(transaction.initiatorId),
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
    // Grouper par holder et product
    const stockMap = new Map<string, number>();

    movements.forEach((movement) => {
      const key = `${movement.holder}-${movement.product}-${movement.site}`;

      if (!stockMap.has(key)) {
        // Chercher le stock initial
        const initialStock =
          actifs.find(
            (a) =>
              this.getName(a.detentaire) === movement.holder &&
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
    if (typeof doc === 'string') return doc;
    if (doc.name) return doc.name;
    if (doc.firstName && doc.lastName)
      return `${doc.firstName} ${doc.lastName}`;
    return doc.toString();
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
        filter.$or = [
          { productId: searchObjId },
          { depotId: searchObjId },
        ];
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
            select: 'productName codeCPC productImage prixUnitaire productVolume',
          },
          {
            path: 'depotId',
            select: 'siteName siteAddress location siteUserID',
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
