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
   * Ajoute ou augmente un actif avec gestion du détenteur et de l'ayant-droit
   */
  async addOrIncreaseActif(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
    prixUnitaire: number,
    detentaire: string,
    ayant_droit: string,
  ) {
    const filter = {
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
      ayant_droit: new Types.ObjectId(ayant_droit), // Important pour différencier les stocks tiers
    };

    const update = {
      $inc: { quantite: quantite },
      $set: {
        prixUnitaire,
        detentaire: new Types.ObjectId(detentaire),
        isActive: true,
        archivedAt: null,
      },
    };

    return await this.actifModel.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });
  }

  /**
   * Réduit un actif spécifique selon son ayant-droit
   */
  async decreaseActif(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
    ayantDroitId: string,
  ) {
    const actif = await this.actifModel.findOne({
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
      ayant_droit: new Types.ObjectId(ayantDroitId),
      isActive: true,
    });

    if (!actif || actif.quantite < quantite) {
      throw new BadRequestException('Stock insuffisant pour cet ayant-droit.');
    }

    if (actif.quantite === quantite) {
      return await this.actifModel.findByIdAndUpdate(
        actif._id,
        {
          $set: { quantite: 0, isActive: false, archivedAt: new Date() },
        },
        { new: true },
      );
    }

    return await this.actifModel.findByIdAndUpdate(
      actif._id,
      { $inc: { quantite: -quantite } },
      { new: true },
    );
  }

  /**
   * Change l'ayant-droit (Virement de propriété)
   */
  async updateProperty(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
    oldOwnerId: string,
    newOwnerId: string,
  ) {
    await this.decreaseActif(userId, depotId, productId, quantite, oldOwnerId);
    return await this.addOrIncreaseActif(
      userId,
      depotId,
      productId,
      quantite,
      0,
      userId,
      newOwnerId,
    );
  }

  /**
   * Récupère les actifs d'un site (résout l'erreur TS)
   */
  async getActifsByUserAndSite(
    userId: string,
    siteId: string,
    query: any = {},
  ) {
    const { page = 1, limit = 10, includeArchived = false } = query;
    const filter: any = {
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(siteId),
    };

    if (includeArchived !== 'true' && includeArchived !== true)
      filter.isActive = true;

    const [items, total] = await Promise.all([
      this.actifModel
        .find(filter)
        .populate('productId', 'productName codeCPC productImage')
        .populate('ayant_droit', 'userName userFirstname')
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.actifModel.countDocuments(filter),
    ]);

    return { status: 'success', data: items, total, page, limit };
  }

  /**
   * Récupérer un actif par son ID avec détails complets
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
      .populate(
        'detentaire',
        'userNickName userName userFirstname userPhone userImage',
      )
      .populate(
        'ayant_droit',
        'userNickName userName userFirstname userPhone userImage',
      )
      .exec();

    if (!actif) {
      return {
        status: 'error',
        message: 'Actif non trouvé',
        data: null,
      } as any;
    }

    return {
      status: 'success',
      message: 'Actif récupéré',
      data: [actif],
    } as any;
  }
}
