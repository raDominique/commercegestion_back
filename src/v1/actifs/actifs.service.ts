import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Actif, ActifDocument } from './actifs.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@Injectable()
export class ActifsService {
  constructor(
    @InjectModel(Actif.name)
    private readonly actifModel: Model<ActifDocument>,
  ) {}

  /**
   * Ajouter ou augmenter un actif pour un utilisateur dans un site
   * Utilisé lors d'un DEPOT
   */
  async addOrIncreaseActif(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
  ) {
    try {
      const actif = await this.actifModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          depotId: new Types.ObjectId(depotId),
          productId: new Types.ObjectId(productId),
        },
        {
          $inc: { quantite: quantite },
        },
        { upsert: true, new: true },
      );
      return actif;
    } catch (error) {
      throw new BadRequestException(
        `Erreur lors de l'ajout d'actif: ${error.message}`,
      );
    }
  }

  /**
   * Réduire ou archiver un actif pour un utilisateur dans un site
   * Utilisé lors d'un RETRAIT
   */
  async decreaseActif(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
  ) {
    try {
      const actif = await this.actifModel.findOne({
        userId: new Types.ObjectId(userId),
        depotId: new Types.ObjectId(depotId),
        productId: new Types.ObjectId(productId),
      });

      if (!actif) {
        throw new BadRequestException('Actif non trouvé pour ce retrait');
      }

      const quantiteActuelle = (actif as any).quantite;

      if (quantiteActuelle < quantite) {
        throw new BadRequestException(
          `Quantité insuffisante. Disponible: ${quantiteActuelle}, Demandée: ${quantite}`,
        );
      }

      if (quantiteActuelle === quantite) {
        // Archiver l'actif au lieu de le supprimer (conservation de l'historique)
        const archived = await this.actifModel.findByIdAndUpdate(
          actif._id,
          {
            quantite: 0,
            isActive: false,
            archivedAt: new Date(),
          },
          { new: true },
        );
        return archived;
      }

      // Réduire la quantité
      const updated = await this.actifModel.findByIdAndUpdate(
        actif._id,
        { $inc: { quantite: -quantite } },
        { new: true },
      );
      return updated;
    } catch (error) {
      throw new BadRequestException(
        `Erreur lors de la réduction d'actif: ${error.message}`,
      );
    }
  }

  /**
   * Récupérer les actifs d'un utilisateur avec pagination, recherche, tri et filtrage
   */
  async getActifsByUser(
    userId: string,
    query: any = {},
  ): Promise<PaginationResult<Actif>> {
    const {
      page = 1,
      limit = 10,
      search,
      siteId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeArchived = false, // Par défaut, exclure les archivés
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    // Filtre de base : incluire uniquement les actifs actifs par défaut
    const filter: any = { userId: new Types.ObjectId(userId) };

    // Filtre d'archivage
    if (includeArchived !== 'true' && includeArchived !== true) {
      filter.isActive = true;
    }

    // Filtre par site
    if (siteId) {
      filter.depotId = new Types.ObjectId(siteId);
    }

    // Recherche
    if (search) {
      filter.$or = [
        { 'productId.productName': { $regex: search, $options: 'i' } },
      ];
    }

    // Tri
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Exécution parallèle
    const [items, total] = await Promise.all([
      this.actifModel
        .find(filter)
        .populate(
          'userId',
          'userNickName userName userFirstname userPhone userImage',
        )
        .populate('depotId', 'siteName')
        .populate('productId', 'productName codeCPC productImage prixUnitaire')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.actifModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Liste des actifs récupérée',
      data: items,
      total,
      page: Number(page),
      limit: Number(limit),
    } as any;
  }

  /**
   * Récupérer les actifs d'un utilisateur pour un site spécifique
   */
  async getActifsByUserAndSite(
    userId: string,
    siteId: string,
    query: any = {},
  ) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeArchived = false,
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    // Filtre de base : exclure les archivés par défaut
    const filter: any = {
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(siteId),
    };

    if (includeArchived !== 'true' && includeArchived !== true) {
      filter.isActive = true;
    }

    if (search) {
      filter.$or = [
        { 'productId.productName': { $regex: search, $options: 'i' } },
      ];
    }

    // Tri
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Exécution parallèle
    const [items, total] = await Promise.all([
      this.actifModel
        .find(filter)
        .populate('productId', 'productName codeCPC productImage')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.actifModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Liste des actifs du site récupérée',
      data: items,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Récupérer un actif spécifique
   */
  async getActif(userId: string, depotId: string, productId: string) {
    return this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
    });
  }

  /**
   * Récupérer un actif par ID
   */
  async findOne(id: string): Promise<PaginationResult<Actif>> {
    const actif = await this.actifModel
      .findById(id)
      .populate(
        'userId',
        'userNickName userName userFirstname userPhone userImage',
      )
      .populate('depotId', 'siteName siteAddress siteLat siteLng location')
      .populate('productId', 'productName codeCPC productImage prixUnitaire')
      .exec();

    if (!actif)
      return {
        status: 'error',
        message: 'Actif non trouvé',
        data: null,
      };

    // Retour enrichi
    return {
      status: 'success',
      message: 'Actif récupéré',
      data: [actif],
    };
  }
}
