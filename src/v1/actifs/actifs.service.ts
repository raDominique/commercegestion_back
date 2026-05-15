import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Actif, ActifDocument } from './actifs.schema';
import { ProductService } from '../products/products.service';
import { ExportService } from '../../shared/export/export.service';

@Injectable()
export class ActifsService {
  constructor(
    @InjectModel(Actif.name) private readonly actifModel: Model<ActifDocument>,
    private readonly productService: ProductService,
    private readonly exportService: ExportService,
  ) {}

  /**
   * Ajoute ou augmente un actif existant.
   * C'est la fonction centrale pour les Dépôts et les Réceptions.
   */
  async addOrIncreaseActif(
    userId: string, // Propriétaire du bilan
    depotId: string, // Site physique
    productId: string, // Le produit
    quantite: number,
    prixUnitaire: number = 0,
    detentaireId: string, // Qui garde le produit (Hangar ou User)
    ayantDroitId: string, // Qui possède le produit (User)
  ) {
    // On cherche si un actif identique existe déjà (Même pro²priétaire, même site, même ayant-droit)
    const existingActif = await this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(productId),
      depotId: new Types.ObjectId(depotId),
      ayant_droit: new Types.ObjectId(ayantDroitId),
    });

    if (existingActif) {
      existingActif.quantite += quantite;
      existingActif.isActive = true;
      existingActif.archivedAt = undefined;
      return await existingActif.save();
    } else {
      const newActif = new this.actifModel({
        userId: new Types.ObjectId(userId),
        productId: new Types.ObjectId(productId),
        depotId: new Types.ObjectId(depotId),
        quantite,
        prixUnitaire,
        detentaire: new Types.ObjectId(detentaireId),
        ayant_droit: new Types.ObjectId(ayantDroitId),
        isActive: true,
      });
      return await newActif.save();
    }
  }

  /**
   * Diminue la quantité d'un actif (Retrait ou Vente).
   * Correction : Ajout de ayantDroitId pour correspondre à la clé unique de l'actif
   */
  async decreaseActif(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
  ) {
    console.log('DEBUG decreaseActif called with:', {
      userId,
      depotId,
      productId,
      quantite,
    });
    const actif = await this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
      isActive: true,
    });

    console.log('DEBUG decreaseActif:', {
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
      quantite,
      actif,
      actifQuantite: actif?.quantite,
    });

    if (!actif || actif.quantite < quantite) {
      throw new NotFoundException(
        `Stock insuffisant ou actif inexistant. (Demandé: ${quantite}, Dispo: ${actif?.quantite})`,
      );
    }

    actif.quantite -= quantite;

    if (actif.quantite === 0) {
      actif.isActive = false;
      actif.archivedAt = new Date();
    }

    return await actif.save();
  }

  /**
   * Met à jour la propriété (Ayant-droit) sans mouvement physique.
   * Correspond à l'étape 4c (Virement de marchandise).
   */
  async updateProperty(
    siteId: string,
    productId: string,
    quantite: number,
    ancienAyantDroitId: string,
    ayant_droit: string,
    prixUnitaire: number,
    detentaireId: string,
  ) {
    // 1. Sortie de l'actif pour l'ancien propriétaire
    await this.decreaseActif(ancienAyantDroitId, siteId, productId, quantite);

    // 2. Entrée de l'actif pour le nouveau propriétaire
    // Le détenteur (le hangar) reste le même
    await this.addOrIncreaseActif(
      ayant_droit,
      siteId,
      productId,
      quantite,
      prixUnitaire,
      detentaireId,
      ayant_droit,
    );
  }

  /**
   * Récupère les actifs d'un utilisateur sur un site précis
   */
  async getActifsByUserAndSite(userId: string, siteId: string) {
    return this.actifModel
      .find({
        userId: new Types.ObjectId(userId),
        depotId: new Types.ObjectId(siteId),
        isActive: true,
      })
      .populate('productId')
      .exec();
  }

  /**
   * Récupère la liste de tous les actifs "Hors site"
   * (Où l'utilisateur est propriétaire mais n'est pas le détenteur physique)
   */
  async getExternalAssets(userId: string) {
    return this.actifModel
      .find({
        userId: new Types.ObjectId(userId),
        detentaire: { $ne: new Types.ObjectId(userId) },
        isActive: true,
      })
      .populate('productId')
      .populate('detentaire', 'userName userNickName')
      .populate('depotId', 'siteId siteName siteAddress location')
      .exec();
  }

  async getActifDetails(actifId: string) {
    const actif = await this.actifModel
      .findById(actifId)
      .populate('productId', 'productName codeCPC productImage prixUnitaire') // Détails techniques du produit
      .populate('ayant_droit', 'userNickName userName userPhone') // Le propriétaire (souvent l'utilisateur lui-même)
      .populate('detentaire', 'userNickName userName userPhone') // Le gardien actuel (ex: Hangar ou Transporteur)
      .populate('depotId', 'siteId siteName siteAddress location') // Localisation géographique
      .exec();

    if (!actif) {
      throw new NotFoundException(`Actif avec l'ID ${actifId} non trouvé`);
    }

    return actif;
  }
  async getAvailableValidatedProducts(query: any) {
    const {
      page = 1,
      limit = 10,
      search,
      fournisseurId,
      sort = 'prixUnitaire',
      order = 1,
    } = query;

    const skip = (Number(page) - 1) * Number(limit);

    // 1. Filtrage et TRI des produits si nécessaire
    const productFilter: any = { productValidation: true };
    if (search) {
      productFilter.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { codeCPC: { $regex: search, $options: 'i' } },
      ];
    }

    // On prépare le tri pour les produits
    let productSort = {};
    if (['productName', 'codeCPC'].includes(sort)) {
      productSort = { [sort]: Number(order) };
    }

    // Récupérer les IDs triés
    const validatedProductIds =
      await this.productService.findValidatedIdsByFilter(
        productFilter,
        productSort,
      );

    // 2. Filtrage des Actifs
    const actifFilter: any = {
      productId: { $in: validatedProductIds },
      quantite: { $gt: 0 },
      isActive: true,
    };

    if (fournisseurId) {
      actifFilter.ayant_droit = new Types.ObjectId(fournisseurId);
    }

    // 3. Préparation du tri pour l'Actif
    // Si le tri n'était pas sur le produit, on l'applique sur l'actif
    let finalSort: any = {};
    if (!['productName', 'codeCPC'].includes(sort)) {
      finalSort[sort] = Number(order);
    }

    const [actifs, total] = await Promise.all([
      this.actifModel
        .find(actifFilter)
        .populate('productId')
        .populate('ayant_droit', 'userNickName raisonSocial')
        .populate('depotId', 'siteName siteAddress')
        .sort(finalSort) // Trie sur prixUnitaire ou createdAt
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.actifModel.countDocuments(actifFilter),
    ]);

    // 4. TRI MANUEL
    if (['productName', 'codeCPC'].includes(sort)) {
      actifs.sort((a: any, b: any) => {
        const valA = a.productId?.[sort] || '';
        const valB = b.productId?.[sort] || '';
        return Number(order) === 1
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      });
    }

    return {
      status: 'success',
      data: actifs.map((a) => ({
        id: a._id,
        produit: a.productId,
        vendeur: a.ayant_droit,
        site: a.depotId,
        quantite: a.quantite,
        prixUnitaire: a.prixUnitaire,
        totalValeur: a.quantite * a.prixUnitaire,
      })),
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Récupère tous les actifs d'un site sans pagination - pour utilisation en select
   * Retourne: quantité, nom du produit et id du produit
   */
  async getAllActifsByIdSite(siteId: string) {
    return this.actifModel
      .find({
        depotId: new Types.ObjectId(siteId),
        isActive: true,
        quantite: { $gt: 0 },
      })
      .populate('productId', 'productName _id')
      .select('quantite productId')
      .exec()
      .then((actifs) =>
        actifs.map((a) => ({
          quantite: a.quantite,
          productId: (a.productId as any)?._id,
          productName: (a.productId as any)?.productName,
        })),
      );
  }

  async exportAll(format: 'excel' | 'pdf', userId?: string): Promise<string> {
    const items = await this.actifModel.find().sort({ createdAt: -1 }).lean().exec();

    if (!items.length) {
      throw new NotFoundException('Aucune donnée à exporter');
    }

    const subfolder = 'actif-export';
    const columns = [
      { header: 'ID', key: '_id' },
      { header: 'Produit', key: 'productId' },
      { header: 'Site', key: 'depotId' },
      { header: 'Quantité', key: 'quantite' },
      { header: 'Prix Unitaire', key: 'prixUnitaire' },
      { header: 'Date création', key: 'createdAt' },
    ];

    if (format === 'excel') {
      return this.exportService.exportExcel(items, columns, 'Actifs', subfolder);
    }
    return this.exportService.exportPDF(
      'Liste des Actifs',
      columns.map(c => c.header),
      items.map(item => columns.map(c => String(item[c.key] ?? ''))),
      subfolder,
    );
  }
}
