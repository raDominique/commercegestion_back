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

  async addOrIncreasePassif(
    userId: string,
    depotId: string,
    productId: string,
    quantite: number,
    reason: string,
    ayantDroitId: string,
  ) {
    return await this.passifModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        depotId: new Types.ObjectId(depotId),
        productId: new Types.ObjectId(productId),
        ayant_droit: new Types.ObjectId(ayantDroitId),
      },
      { $inc: { quantite: quantite }, $set: { reason, isActive: true } },
      { upsert: true, new: true },
    );
  }

  /**
   * Récupère les passifs d'un site (résout l'erreur TS)
   */
  async getPassifsByUserAndSite(
    userId: string,
    siteId: string,
    query: any = {},
  ) {
    const { page = 1, limit = 10 } = query;
    const filter = {
      userId: new Types.ObjectId(userId),
      depotId: new Types.ObjectId(siteId),
    };

    const [items, total] = await Promise.all([
      this.passifModel
        .find(filter)
        .populate('productId', 'productName codeCPC')
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.passifModel.countDocuments(filter),
    ]);

    return { status: 'success', data: items, total, page, limit };
  }

  /**
   * Récupérer un passif par son ID
   */
  async findOne(id: string): Promise<PaginationResult<Passif>> {
    const passif = await this.passifModel
      .findById(id)
      .populate(
        'userId',
        'userNickName userName userFirstname userPhone userImage',
      )
      .populate('depotId', 'siteName siteAddress siteLat siteLng location')
      .populate('productId', 'productName codeCPC productImage prixUnitaire')
      .populate(
        'ayant_droit',
        'userNickName userName userFirstname userPhone userImage',
      )
      .exec();

    if (!passif) {
      return {
        status: 'error',
        message: 'Passif non trouvé',
        data: null,
      } as any;
    }

    return {
      status: 'success',
      message: 'Passif récupéré',
      data: [passif],
    } as any;
  }
}
