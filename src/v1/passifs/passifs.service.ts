import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionStatus } from '../transactions/transactions.schema';
import { Passif, PassifDocument } from './passifs.schema';
import {
  ExportService,
  ExportResult,
} from '../../shared/export/export.service';

@Injectable()
export class PassifsService {
  constructor(
    @InjectModel(Passif.name)
    private readonly passifModel: Model<PassifDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<Transaction>,
    private readonly exportService: ExportService,
  ) {}

  /**
   * Ajoute ou augmente une dette de marchandise.
   * Utilisé lors d'un DEPOT (Étape 0) ou d'une RECEPTION (Étape 12).
   */
  async addOrIncreasePassif(
    detentaireId: string, // Le débiteur (celui qui garde le produit)
    depotId: string | null,
    productId: string,
    quantite: number,
    creancierId: string, // L'ayant-droit (celui à qui on doit le produit)
  ) {
    // Si le détenteur est aussi l'ayant-droit, pas de passif (comptabilité interne)
    if (detentaireId === creancierId) return null;

    const existingPassif = await this.passifModel.findOne({
      userId: new Types.ObjectId(detentaireId),
      productId: new Types.ObjectId(productId),
      creancierId: new Types.ObjectId(creancierId),
    });

    if (existingPassif) {
      existingPassif.quantite += quantite;
      existingPassif.isActive = true;
      return await existingPassif.save();
    } else {
      const newPassif = new this.passifModel({
        userId: new Types.ObjectId(detentaireId), // Qui "doit"
        creancierId: new Types.ObjectId(creancierId), // À qui
        productId: new Types.ObjectId(productId),
        depotId: depotId ? new Types.ObjectId(depotId) : null,
        quantite,
        detentaire: new Types.ObjectId(detentaireId),
        ayant_droit: new Types.ObjectId(creancierId),
        typePassif: 'DETTE_MARCHANDISE_EN_DEPOT',
        isActive: true,
      });
      return await newPassif.save();
    }
  }

  /**
   * Diminue le passif (lors d'un RETRAIT ou ENLÈVEMENT par un transporteur).
   */
  async decreasePassif(
    detentaireId: string,
    productId: string,
    quantite: number,
  ) {
    const passif = await this.passifModel.findOne({
      userId: new Types.ObjectId(detentaireId),
      productId: new Types.ObjectId(productId),
      isActive: true,
    });

    if (!passif || passif.quantite < quantite) {
      // Dans certains cas logistiques, on accepte que le passif soit nul si c'est du stock propre
      return;
    }

    passif.quantite -= quantite;

    if (passif.quantite === 0) {
      passif.isActive = false;
      passif.archivedAt = new Date();
    }

    return await passif.save();
  }

  /**
   * Diminue le passif en spécifiant le créancier
   * Utilisé lors d'un RETOUR pour diminuer la dette envers un créancier spécifique
   */
  async decreasePassifByCreditor(
    detentaireId: string,
    productId: string,
    creancierId: string,
    quantite: number,
  ) {
    const passif = await this.passifModel.findOne({
      userId: new Types.ObjectId(detentaireId),
      productId: new Types.ObjectId(productId),
      creancierId: new Types.ObjectId(creancierId),
      isActive: true,
    });

    if (!passif || passif.quantite < quantite) {
      // La dette peut être inférieure ou inexistante
      // Ce cas peut survenir lors d'un retour partiel
      console.warn(
        `Passif insuffisant or not found for decreasing: detentaire=${detentaireId}, product=${productId}, creditor=${creancierId}, requested=${quantite}`,
      );
      return;
    }

    passif.quantite -= quantite;

    if (passif.quantite === 0) {
      passif.isActive = false;
      passif.archivedAt = new Date();
    }

    return await passif.save();
  }

  /**
   * Transfère une dette (passif) d'un débiteur vers un autre, pour un créancier donné.
   * Utile lors d'un virement de droit: ancien ayant-droit -> bénéficiaire, détenteur (créancier) inchangé.
   */
  async transferDebtorByCreditor(params: {
    fromDebtorId: string;
    toDebtorId: string;
    productId: string;
    creancierId: string;
    quantite: number;
    depotId?: string | null;
  }) {
    const {
      fromDebtorId,
      toDebtorId,
      productId,
      creancierId,
      quantite,
      depotId = null,
    } = params;

    if (fromDebtorId === toDebtorId) return;

    await this.decreasePassifByCreditor(
      fromDebtorId,
      productId,
      creancierId,
      quantite,
    );
    await this.addOrIncreasePassif(
      toDebtorId,
      depotId,
      productId,
      quantite,
      creancierId,
    );
  }

  /**
   * Transfert de créancier (Étape 4c).
   * Le détenteur ne change pas, mais il doit maintenant le produit à l'acheteur.
   */
  async updateCreancier(
    detentaireId: string,
    productId: string,
    quantite: number,
    ancienCreancierId: string,
    nouveauCreancierId: string,
  ) {
    // 1. Éteindre la dette envers l'ancien vendeur
    await this.decreasePassif(detentaireId, productId, quantite);

    // 2. Créer la dette envers le nouvel acheteur
    await this.addOrIncreasePassif(
      detentaireId,
      null, // depotId optionnel ici si déjà connu
      productId,
      quantite,
      nouveauCreancierId,
    );
  }

  async getPassifsByUserAndSite(userId: string, siteId: string) {
    return this.passifModel
      .find({
        userId: new Types.ObjectId(userId),
        depotId: new Types.ObjectId(siteId),
        isActive: true,
      })
      .populate('productId')
      .exec();
  }

  async getPassifDetails(passifId: string) {
    const passif = await this.passifModel
      .findById(passifId)
      .populate('productId', 'productName codeCPC productImage prixUnitaire')
      .populate('userId', 'userNickName userName userPhone userEmail')
      .populate('depotId', 'siteName siteAddress siteLat siteLng')
      .exec();

    if (passif) return passif;

    // Fallback: chercher dans les transactions PENDING (passif en attente d'approbation)
    const pendingTx = await this.transactionModel
      .findById(passifId)
      .populate('productId', 'productName codeCPC productImage prixUnitaire')
      .populate('siteDestinationId', 'siteName siteAddress siteLat siteLng')
      .populate('detentaire', 'userNickName userName userPhone userEmail')
      .populate('ayant_droit', 'userNickName userName userPhone userEmail')
      .lean()
      .exec() as any;

    if (!pendingTx || pendingTx.status !== TransactionStatus.PENDING) {
      throw new NotFoundException(`Passif avec l'ID ${passifId} non trouvé`);
    }

    return {
      _id: pendingTx._id,
      transactionNumber: pendingTx.transactionNumber,
      statut: TransactionStatus.PENDING,
      userId: pendingTx.initiatorId,
      creancierId: pendingTx.ayant_droit?._id,
      productId: pendingTx.productId,
      depotId: pendingTx.siteDestinationId?._id,
      quantite: pendingTx.quantite,
      detentaire: pendingTx.detentaire,
      ayant_droit: pendingTx.ayant_droit,
      isActive: pendingTx.isActive,
      createdAt: pendingTx.createdAt,
      updatedAt: pendingTx.updatedAt,
      typePassif: 'PENDING_DEPOT',
    };
  }

  /**
   * Récupère tous les passifs d'un site sans pagination - pour utilisation en select
   * Retourne: quantité, nom du produit et id du produit
   */
  async getAllPassifsByIdSite(siteId: string) {
    return this.passifModel
      .find({
        depotId: new Types.ObjectId(siteId),
        isActive: true,
        quantite: { $gt: 0 },
      })
      .populate('productId', 'productName _id')
      .select('quantite productId')
      .exec()
      .then((passifs) =>
        passifs.map((p) => ({
          quantite: p.quantite,
          productId: (p.productId as any)?._id,
          productName: (p.productId as any)?.productName,
        })),
      );
  }

  async exportAll(
    format: 'excel' | 'pdf',
    userId?: string,
  ): Promise<ExportResult> {
    const items = await this.passifModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!items.length) {
      throw new NotFoundException('Aucune donnée à exporter');
    }

    const columns = [
      { header: 'ID', key: '_id' },
      { header: 'Utilisateur', key: 'userId' },
      { header: 'Produit', key: 'productId' },
      { header: 'Créancier', key: 'creancierId' },
      { header: 'Quantité', key: 'quantite' },
      { header: 'Date création', key: 'createdAt' },
    ];

    if (format === 'excel') {
      return this.exportService.exportExcel(
        items,
        columns,
        'Passifs',
        `export_passifs_${Date.now()}.xlsx`,
      );
    }
    return this.exportService.exportPDF(
      'Liste des Passifs',
      columns.map((c) => c.header),
      items.map((item) => columns.map((c) => String(item[c.key] ?? ''))),
      `export_passifs_${Date.now()}.pdf`,
    );
  }
}
