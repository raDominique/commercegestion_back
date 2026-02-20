import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DepotItem } from './depot-item.schema';
import { AdjustStockDto, TransferStockDto } from './dto/inventory.dto';

@Injectable()
export class DepotItemService {
  constructor(
    @InjectModel(DepotItem.name) private readonly model: Model<DepotItem>,
  ) {}

  async adjustStock(ownerId: string, dto: AdjustStockDto) {
    const { depotId, productId, quantity, prix } = dto;
    const filter = {
      currentOwnerId: new Types.ObjectId(ownerId),
      currentDepotId: new Types.ObjectId(depotId),
      productId: new Types.ObjectId(productId),
    };

    if (quantity < 0) {
      const current = await this.model.findOne(filter);
      if (!current || current.stock < Math.abs(quantity)) {
        throw new BadRequestException('Stock insuffisant pour cette sortie');
      }
    }

    return await this.model
      .findOneAndUpdate(
        filter,
        {
          $inc: { stock: quantity },
          $set: { lastUpdate: new Date(), ...(prix !== undefined && { prix }) },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  async getInventoryBySite(siteId: string, ownerId: string) {
    return await this.model
      .find({
        currentDepotId: new Types.ObjectId(siteId),
        currentOwnerId: new Types.ObjectId(ownerId),
      })
      .populate('productId')
      .exec();
  }

  async transfer(ownerId: string, dto: TransferStockDto) {
    const { fromSiteId, toSiteId, productId, quantity } = dto;

    // 1. Décrémenter la source
    const source = await this.adjustStock(ownerId, {
      depotId: fromSiteId,
      productId,
      quantity: -quantity,
    });

    // 2. Incrémenter la destination (on hérite du prix de la source)
    await this.adjustStock(ownerId, {
      depotId: toSiteId,
      productId,
      quantity: quantity,
      prix: source.prix,
    });

    return { message: 'Transfert inter-dépôts terminé' };
  }
}
