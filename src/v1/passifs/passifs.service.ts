import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Passif, PassifDocument } from './passifs.schema';

@Injectable()
export class PassifsService {
  constructor(
    @InjectModel(Passif.name)
    private readonly passifModel: Model<PassifDocument>,
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
      .populate('productId', 'productName codeCPC productImage prixUnitaire') // Détails du produit
      .populate('creancierId', 'userNickName userName userPhone userEmail') // Détails de l'ayant-droit
      .populate('depotId', 'siteName siteAddress siteLat siteLng') // Détails du site/hangar
      .exec();

    if (!passif) {
      throw new NotFoundException(`Passif avec l'ID ${passifId} non trouvé`);
    }

    return passif;
  }
}
