import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Passif, PassifDocument } from './passifs.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@Injectable()
export class PassifsService {
  constructor(
    @InjectModel(Passif.name)
    private readonly passifModel: Model<PassifDocument>,
  ) {}

  /**
   * Ajouter ou augmenter un passif pour un utilisateur dans un site
   * Utilisé lors d'un RETRAIT (transfert de l'actif au passif)
   */
  async addOrIncreasePassif(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
    reason: string = 'Retrait',
  ) {
    try {
      const passif = await this.passifModel.findOneAndUpdate(
        {
          userId: new Types.ObjectId(userId),
          depotId: new Types.ObjectId(depotId),
          productId: new Types.ObjectId(productId),
          reason: reason,
        },
        {
          $inc: { quantite: quantite },
        },
        { upsert: true, new: true },
      );
      return passif;
    } catch (error) {
      throw new BadRequestException(
        `Erreur lors de l'ajout de passif: ${error.message}`,
      );
    }
  }

  /**
   * Récupérer les passifs d'un utilisateur avec pagination, recherche, tri et filtrage
   */
  async getPassifsByUser(
    userId: string,
    query: any = {},
  ): Promise<PaginationResult<Passif>> {
    const {
      page = 1,
      limit = 10,
      search,
      siteId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      includeArchived = false,
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    // Filtre de base : inclure uniquement les passifs actifs par défaut
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
      filter.$or = [{ reason: { $regex: search, $options: 'i' } }];
    }

    // Tri
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Exécution parallèle
    const [items, total] = await Promise.all([
      this.passifModel
        .find(filter)
        .populate(
          'userId',
          'userNickName userName userFirstname userPhone userImage',
        )
        .populate('depotId', 'siteName')
        .populate('productId', 'productName codeCPC productImage')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.passifModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Liste des passifs récupérée',
      data: items,
      total,
      page: Number(page),
      limit: Number(limit),
    } as any;
  }

  /**
   * Récupérer les passifs d'un utilisateur pour un site spécifique
   */
  async getPassifsByUserAndSite(
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
      filter.$or = [{ reason: { $regex: search, $options: 'i' } }];
    }

    // Tri
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Exécution parallèle
    const [items, total] = await Promise.all([
      this.passifModel
        .find(filter)
        .populate(
          'userId',
          'userNickName userName userFirstname userPhone userImage',
        )
        .populate('depotId', 'siteName')
        .populate('productId', 'productName codeCPC productImage')
        .sort(sort)
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.passifModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Liste des passifs du site récupérée',
      data: items,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  /**
   * Récupérer un passif spécifique
   */
  async getPassif(userId: string, depotId: string, productId: string) {
    return this.passifModel.findOne({
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
    });
  }

  /**
   * Récupérer tous les passifs (Admin)
   */
  async findAll() {
    return this.passifModel
      .find()
      .populate('userId', 'email firstName lastName')
      .populate('depotId', 'siteName')
      .populate('productId', 'productName codeCPC')
      .sort({ createdAt: -1 })
      .exec();
  }

  /**
   * Récupérer un passif par ID
   */
  async findOne(id: string): Promise<PaginationResult<Passif>> {
    const passif = await this.passifModel
      .findById(id)
      .populate(
        'userId',
        'userNickName userName userFirstname userPhone userImage',
      )
      .populate('depotId', 'siteName siteAddress siteLat siteLng location')
      .populate('productId', 'productName codeCPC productImage')
      .exec();

    if (!passif)
      return {
        status: 'error',
        message: 'Passif non trouvé',
        data: null,
      };

    // Retour enrichi
    return {
      status: 'success',
      message: 'Passif récupéré',
      data: [passif],
    };
  }
}
