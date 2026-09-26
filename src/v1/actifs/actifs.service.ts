import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Actif, ActifDocument } from './actifs.schema';
import {
  Transaction,
  TransactionDocument,
} from '../transactions/transactions.schema';
import { ProductService } from '../products/products.service';
import {
  ExportService,
  ExportResult,
} from '../../shared/export/export.service';

@Injectable()
export class ActifsService {
  constructor(
    @InjectModel(Actif.name) private readonly actifModel: Model<ActifDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
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
    // On cherche si un actif identique et TOUJOURS ACTIF existe déjà
    // (Même propriétaire, même site, même ayant-droit).
    // Une ligne archivée (quantité épuisée) ne doit JAMAIS être ressuscitée :
    // elle porte l'ancien détenteur/ayant-droit. On crée alors une ligne fraîche
    // avec les acteurs actuels (ex: après un retrait, l'ayant-droit redevient détenteur).
    const existingActif = await this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(productId),
      depotId: new Types.ObjectId(depotId),
      ayant_droit: new Types.ObjectId(ayantDroitId),
      isActive: true,
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
   * Réserve une quantité sur un actif (met en attente).
   * La quantité est déduite du disponible sans impacter le stock réel.
   */
  async reserveActif(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
  ) {
    const actif = await this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
      isActive: true,
    });

    if (!actif || actif.quantite - actif.quantiteEnAttente < quantite) {
      throw new NotFoundException(
        `Stock disponible insuffisant pour réservation. (Disponible: ${actif ? actif.quantite - actif.quantiteEnAttente : 0}, Demandé: ${quantite})`,
      );
    }

    actif.quantiteEnAttente += quantite;
    return await actif.save();
  }

  /**
   * Libère une quantité précédemment réservée (remet dans le disponible).
   * Utilisé quand une transaction est rejetée ou annulée.
   */
  async releasePendingActif(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
  ) {
    const actif = await this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
      isActive: true,
    });

    if (!actif || actif.quantiteEnAttente < quantite) {
      console.warn(
        `Aucune réservation trouvée ou insuffisante pour libérer ${quantite} (en attente: ${actif?.quantiteEnAttente || 0})`,
      );
      return;
    }

    actif.quantiteEnAttente -= quantite;
    return await actif.save();
  }

  /**
   * Ajoute/augmente la quantité EN ATTENTE sur un actif (sans toucher au stock réel).
   * Utilisé pour créer la ligne "en attente" du retrayant au site de destination.
   */
  async addOrIncreaseActifEnAttente(
    userId: string,
    depotId: string,
    productId: string,
    quantiteEnAttente: number,
    prixUnitaire: number,
    detentaireId: string,
    ayantDroitId: string,
  ) {
    const filter = {
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
      detentaire: new Types.ObjectId(detentaireId),
      ayant_droit: new Types.ObjectId(ayantDroitId),
      isActive: true,
    };
    let actif = await this.actifModel.findOne(filter);
    if (!actif) {
      actif = new this.actifModel({
        ...filter,
        quantite: 0,
        quantiteEnAttente,
        prixUnitaire,
        isActive: true,
      });
    } else {
      actif.quantiteEnAttente += quantiteEnAttente;
    }
    return await actif.save();
  }

  /**
   * Confirme une réservation : retire du en-attente et diminue le stock réel.
   * Utilisé quand une transaction en attente est approuvée.
   */
  async confirmPendingActif(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
  ) {
    const actif = await this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
      isActive: true,
    });

    if (!actif || actif.quantite < quantite) {
      throw new NotFoundException(
        `Stock insuffisant pour confirmer la réservation. (Stock: ${actif?.quantite || 0}, Demandé: ${quantite})`,
      );
    }

    // Retirer du en-attente
    actif.quantiteEnAttente = Math.max(0, actif.quantiteEnAttente - quantite);
    // Diminuer le stock réel
    actif.quantite -= quantite;

    if (actif.quantite === 0) {
      actif.isActive = false;
      actif.archivedAt = new Date();
    }

    return await actif.save();
  }

  /**
   * Confirme une ligne "en attente" à la DESTINATION : convertit quantiteEnAttente -> quantite.
   * Utilisé pour le retrait approuvé : la ligne créée au site destination passe de pending à réel.
   */
  async confirmPendingActifAtDestination(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
  ) {
    const actif = await this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
      isActive: true,
    });

    if (!actif || actif.quantiteEnAttente < quantite) {
      throw new NotFoundException(
        `Ligne en attente insuffisante pour confirmer. (En attente: ${actif?.quantiteEnAttente || 0}, Demandé: ${quantite})`,
      );
    }

    // Convertir en-attente -> réel
    actif.quantiteEnAttente = Math.max(0, actif.quantiteEnAttente - quantite);
    actif.quantite += quantite;

    return await actif.save();
  }

  /**
   * Transfère un droit de propriété (ayant_droit) sur un actif stocké chez un détenteur.
   * Cas d'usage: dépôt chez un tiers + virement de droit (propriétaire X -> bénéficiaire Z)
   *
   * Important: ici, l'actif est identifié par (detentaireId=userId, depotId, productId, ayant_droit).
   */
  async transferAyantDroitWithinDetentaire(params: {
    detentaireId: string;
    depotId: string;
    productId: string;
    fromAyantDroitId: string;
    toAyantDroitId: string;
    quantite: number;
    prixUnitaire?: number;
  }) {
    const {
      detentaireId,
      depotId,
      productId,
      fromAyantDroitId,
      toAyantDroitId,
      quantite,
      prixUnitaire = 0,
    } = params;

    const sourceActif = await this.actifModel.findOne({
      userId: new Types.ObjectId(detentaireId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
      ayant_droit: new Types.ObjectId(fromAyantDroitId),
      isActive: true,
    });

    if (!sourceActif || sourceActif.quantite < quantite) {
      throw new NotFoundException(
        `Stock insuffisant ou actif inexistant pour transfert de droit. (Demandé: ${quantite}, Dispo: ${sourceActif?.quantite})`,
      );
    }

    sourceActif.quantite -= quantite;
    if (sourceActif.quantite === 0) {
      sourceActif.isActive = false;
      sourceActif.archivedAt = new Date();
    }
    await sourceActif.save();

    // Créer / augmenter l'actif cible au même détenteur/site, mais avec nouveau ayant_droit
    return this.addOrIncreaseActif(
      detentaireId,
      depotId,
      productId,
      quantite,
      prixUnitaire,
      detentaireId,
      toAyantDroitId,
    );
  }

  /**
   * Retrouve un actif déposé chez un détenteur, appartenant à un ayant-droit.
   * Si depotId est omis, cherche sur n'importe quel dépôt du détenteur.
   */
  async findDepositedActif(params: {
    detentaireId: string;
    productId: string;
    ayantDroitId: string;
    depotId?: string;
    minQuantite?: number;
  }) {
    const {
      detentaireId,
      productId,
      ayantDroitId,
      depotId,
      minQuantite = 0,
    } = params;

    const filter: any = {
      userId: new Types.ObjectId(detentaireId),
      productId: new Types.ObjectId(productId),
      ayant_droit: new Types.ObjectId(ayantDroitId),
      isActive: true,
    };
    if (depotId) filter.depotId = new Types.ObjectId(depotId);
    if (minQuantite > 0) filter.quantite = { $gte: minQuantite };

    return this.actifModel.findOne(filter);
  }

  /**
   * Retrouve un actif du BILAN de l'utilisateur (userId) qui est détenu
   * physiquement par un détenteur précis (detentaireId).
   *
   * Différence avec findDepositedActif:
   * - findDepositedActif cherche dans le bilan du DÉTENTEUR (userId = detentaireId)
   * - findOwnActifHeldByDetentaire cherche dans le bilan de l'UTILISATEUR lui-même
   *
   * Utilisé pour vérifier qu'un retrait est couvert par les actifs de la
   * personne qui effectue le retrait (règle métier: la quantité à retirer doit
   * être disponible dans les actifs de la personne qui retire).
   */
  async findOwnActifHeldByDetentaire(params: {
    userId: string;
    detentaireId: string;
    productId: string;
    depotId?: string;
    minQuantite?: number;
  }) {
    const {
      userId,
      detentaireId,
      productId,
      depotId,
      minQuantite = 0,
    } = params;

    const filter: any = {
      userId: new Types.ObjectId(userId),
      detentaire: new Types.ObjectId(detentaireId),
      productId: new Types.ObjectId(productId),
      ayant_droit: new Types.ObjectId(userId),
      isActive: true,
    };
    if (depotId) filter.depotId = new Types.ObjectId(depotId);
    if (minQuantite > 0) filter.quantite = { $gte: minQuantite };

    return this.actifModel.findOne(filter);
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

  async getActifsByIds(ids: string[]) {
    const objectIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));

    if (objectIds.length === 0) {
      return [];
    }

    const actifs = await this.actifModel
      .find({ _id: { $in: objectIds } })
      .populate('productId', 'productName codeCPC productImage prixUnitaire')
      .populate('ayant_droit', 'userNickName userName userPhone')
      .populate('detentaire', 'userNickName userName userPhone')
      .populate('depotId', 'siteId siteName siteAddress location')
      .lean()
      .exec();

    // S'il manque des identifiants (cas des PENDING qui sont en fait des Transactions).
    // La transaction est retournée dans sa structure native complète (transactionNumber,
    // type, status, initiatorId, recipientId, siteOrigineId, siteDestinationId, etc.)
    // tout en conservant les champs de compatibilité pour l'affichage type actif.
    if (actifs.length < objectIds.length) {
      const foundActifIds = actifs.map((a) => a._id.toString());
      const missingIds = objectIds.filter(
        (id) => !foundActifIds.includes(id.toString()),
      );

      if (missingIds.length > 0) {
        const txs = await this.transactionModel
          .find({ _id: { $in: missingIds } })
          .populate(
            'productId',
            'productName codeCPC productImage prixUnitaire',
          )
          .populate('initiatorId', 'userNickName userName userPhone')
          .populate('recipientId', 'userNickName userName userPhone')
          .populate('ayant_droit', 'userNickName userName userPhone')
          .populate('detentaire', 'userNickName userName userPhone')
          .populate('siteOrigineId', 'siteId siteName siteAddress location')
          .populate('siteDestinationId', 'siteId siteName siteAddress location')
          .lean()
          .exec();

        const formattedTxs = txs.map((tx: any) => ({
          ...tx,
          depotId: tx.siteDestinationId,
          quantiteEnAttente: tx.quantite,
          quantiteDisponible: 0,
        }));

        return [...actifs, ...formattedTxs];
      }
    }

    return actifs;
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
    const finalSort: any = {};
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
      .select('quantite quantiteEnAttente productId detentaire ayant_droit')
      .exec()
      .then((actifs) => {
        type PopulatedProduct = {
          _id: Types.ObjectId;
          productName: string;
        };

        // Chaque dépôt chez un tiers est écrit deux fois : dans le bilan du
        // propriétaire et dans celui du détenteur. Ces deux lignes partagent le
        // même couple (détenteur, ayant-droit) et ne doivent compter qu'une fois
        // dans le stock physique du site.
        const holdings = new Map<
          string,
          { quantite: number; productId: Types.ObjectId; productName: string }
        >();
        const products = new Map<
          string,
          { quantite: number; productId: Types.ObjectId; productName: string }
        >();

        actifs.forEach((a) => {
          const product = a.productId as unknown as PopulatedProduct | null;
          if (!product?._id) return;

          const productId = product._id.toString();
          const quantiteDisponible = Math.max(
            0,
            a.quantite - (a.quantiteEnAttente ?? 0),
          );
          const detentaireId = a.detentaire?.toString();
          const ayantDroitId = a.ayant_droit?.toString();
          // Les anciennes lignes qui ne portent pas ces informations restent
          // des lignes distinctes pour éviter de masquer du stock historique.
          const holdingId =
            detentaireId && ayantDroitId
              ? `${productId}:${detentaireId}:${ayantDroitId}`
              : a._id.toString();
          const existingHolding = holdings.get(holdingId);

          if (existingHolding) {
            // Les lignes miroir ont normalement la même quantité. Le maximum
            // protège le stock affiché si l'une d'elles est temporairement
            // réservée par une transaction en attente.
            existingHolding.quantite = Math.max(
              existingHolding.quantite,
              quantiteDisponible,
            );
            return;
          }

          holdings.set(holdingId, {
            quantite: quantiteDisponible,
            productId: product._id,
            productName: product.productName,
          });
        });

        // Additionner uniquement les dépôts réellement distincts d'un même
        // produit, après avoir éliminé les écritures miroir.
        holdings.forEach((holding) => {
          const productId = holding.productId.toString();
          const existing = products.get(productId);

          if (existing) {
            existing.quantite += holding.quantite;
            return;
          }

          products.set(productId, { ...holding });
        });

        return [...products.values()];
      });
  }

  async exportAll(
    format: 'excel' | 'pdf',
    userId?: string,
  ): Promise<ExportResult> {
    const items = await this.actifModel
      .find()
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    if (!items.length) {
      throw new NotFoundException('Aucune donnée à exporter');
    }

    const columns = [
      { header: 'ID', key: '_id' },
      { header: 'Produit', key: 'productId' },
      { header: 'Site', key: 'depotId' },
      { header: 'Quantité', key: 'quantite' },
      { header: 'Prix Unitaire', key: 'prixUnitaire' },
      { header: 'Date création', key: 'createdAt' },
    ];

    if (format === 'excel') {
      return this.exportService.exportExcel(
        items,
        columns,
        'Actifs',
        `export_actifs_${Date.now()}.xlsx`,
      );
    }
    return this.exportService.exportPDF(
      'Liste des Actifs',
      columns.map((c) => c.header),
      items.map((item) => columns.map((c) => String(item[c.key] ?? ''))),
      `export_actifs_${Date.now()}.pdf`,
    );
  }

  async findActif(
    userId: string,
    productId: string,
    depotId: string,
  ): Promise<ActifDocument | null> {
    return this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(productId),
      depotId: new Types.ObjectId(depotId),
      isActive: true,
      quantite: { $gt: 0 },
    });
  }

  /**
   * Liste les actifs déposés par l'utilisateur connecté (ayant_droit)
   * chez un détenteur fournisseur/provider (detentaire).
   *
   * Seules les lignes du BILAN de l'utilisateur connecté sont retournées
   * (userId = ayant_droit = utilisateur). La ligne miroir du bilan du
   * détenteur (userId = detenteur) est exclue pour éviter de compter deux
   * fois le même dépôt.
   *
   * Si detenteurId est fourni, filtre sur ce détenteur spécifique.
   * Sinon, liste tous les actifs déposés chez des détenteurs externes (différents du propriétaire).
   */
  async getDepositedActifsByDetenteur(
    userId: string,
    query: {
      detenteurId?: string;
      siteId?: string;
      productId?: string;
      page?: string;
      limit?: string;
      search?: string;
    },
  ) {
    const {
      detenteurId,
      siteId,
      productId,
      page = '1',
      limit = '10',
      search,
    } = query;

    const skip = (Number(page) - 1) * Number(limit);

    const detentaireFilter = detenteurId
      ? { detentaire: new Types.ObjectId(detenteurId) }
      : { detentaire: { $ne: new Types.ObjectId(userId) } };

    const filter = {
      // Bilan de l'utilisateur connecté UNIQUEMENT.
      // Sans ce filtre, la ligne du bilan du détenteur (userId = detenteur,
      // ayant_droit = utilisateur) matche aussi le filtre ayant_droit + detentaire
      // et le même dépôt est compté deux fois.
      userId: new Types.ObjectId(userId),
      ayant_droit: new Types.ObjectId(userId),
      isActive: true,
      // Ne retourner que la quantité réellement disponible : les quantités
      // réservées par des transactions PENDING ne sont pas détenues comme
      // disponible chez le détenteur.
      $expr: {
        $gt: [
          { $subtract: ['$quantite', { $ifNull: ['$quantiteEnAttente', 0] }] },
          0,
        ],
      },
      ...detentaireFilter,
      ...(siteId ? { depotId: new Types.ObjectId(siteId) } : {}),
      ...(productId ? { productId: new Types.ObjectId(productId) } : {}),
    };

    // On ne peuple que le produit. codeCPC est conservé pour la recherche
    // puis retiré de la réponse finale.
    const populate = [
      {
        path: 'productId',
        select: 'productName codeCPC',
      },
    ];

    const [actifs, total] = await Promise.all([
      this.actifModel
        .find(filter)
        .populate(populate)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.actifModel.countDocuments(filter).exec(),
    ]);

    let data = actifs;

    if (search) {
      const regex = new RegExp(search, 'i');
      data = actifs.filter((a: any) => {
        const product = a.productId;
        if (product) {
          return (
            regex.test(product.productName || '') ||
            regex.test(product.codeCPC || '')
          );
        }
        return false;
      });
    }

    // Réduire la réponse aux seuls champs utiles:
    // _id, quantite disponible, productId._id, productId.productName
    const reduced = data.map((a: any) => ({
      _id: a._id,
      quantite: Math.max(0, a.quantite - (a.quantiteEnAttente ?? 0)),
      productId: {
        _id: a.productId?._id ?? null,
        productName: a.productId?.productName ?? null,
      },
    }));

    return {
      status: 'success',
      message: "Actifs déposés par l'utilisateur connecté chez le détenteur",
      data: reduced,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Retourne l'état courant des dépôts de l'ayant-droit dans le même format
   * qu'une liste de transactions. La source reste Actif afin de ne pas inclure
   * les lignes historiques déjà sorties ou entièrement virées.
   */
  async getActiveDepositsAtOthers(
    userId: string,
    query: {
      detenteurId?: string;
      siteId?: string;
      productId?: string;
      page?: number;
      limit?: number;
      search?: string;
    },
  ) {
    const {
      detenteurId,
      siteId,
      productId,
      page = 1,
      limit = 10,
      search,
    } = query;
    const userObjectId = new Types.ObjectId(userId);
    const filter = {
      userId: userObjectId,
      ayant_droit: userObjectId,
      isActive: true,
      $expr: {
        $gt: [
          { $subtract: ['$quantite', { $ifNull: ['$quantiteEnAttente', 0] }] },
          0,
        ],
      },
      detentaire: detenteurId
        ? new Types.ObjectId(detenteurId)
        : { $ne: userObjectId },
      ...(siteId ? { depotId: new Types.ObjectId(siteId) } : {}),
      ...(productId ? { productId: new Types.ObjectId(productId) } : {}),
    };

    const actifs = await this.actifModel
      .find(filter)
      .sort({ createdAt: -1 })
      .populate([
        { path: 'productId' },
        { path: 'depotId' },
        { path: 'detentaire' },
        { path: 'ayant_droit' },
      ])
      .exec();

    const searchLower = search?.toLowerCase();
    const searched = searchLower
      ? actifs.filter((actif: any) =>
          (actif.productId?.productName || '')
            .toLowerCase()
            .includes(searchLower),
        )
      : actifs;
    const skip = (page - 1) * limit;

    return {
      status: 'success',
      message:
        "Dépôts actifs de l'utilisateur chez d'autres membres récupérés avec succès",
      data: searched.slice(skip, skip + limit).map((actif: any) => ({
        _id: actif._id,
        type: 'DÉPÔT',
        status: 'APPROVED',
        initiatorId: actif.ayant_droit,
        recipientId: actif.detentaire,
        productId: actif.productId,
        // L'actif ne conserve que son site courant, qui correspond à la destination.
        siteOrigineId: null,
        siteDestinationId: actif.depotId,
        quantite: Math.max(
          0,
          actif.quantite - (actif.quantiteEnAttente ?? 0),
        ),
        prixUnitaire: actif.prixUnitaire,
        detentaire: actif.detentaire,
        ayant_droit: actif.ayant_droit,
        isActive: actif.isActive,
        createdAt: actif.createdAt,
        updatedAt: actif.updatedAt,
      })),
      page,
      limit,
      total: searched.length,
    };
  }

  /**
   * Trouve un actif sans restriction de quantité ou isActive.
   * Utilisé pour récupérer le détenteur (detentaire) d'un actif même après diminution.
   */
  async findActifLight(
    userId: string,
    depotId: string,
    productId: string,
  ): Promise<ActifDocument | null> {
    return this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
    });
  }
}
