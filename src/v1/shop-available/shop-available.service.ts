import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ShopAvailable, ShopAvailableDocument, ShopAvailableStatus } from './shop-available.schema';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { ActifsService } from '../actifs/actifs.service';
import { PaginationResult } from '../../shared/interfaces/pagination.interface';

@Injectable()
export class ShopAvailableService {
  constructor(
    @InjectModel(ShopAvailable.name)
    private readonly shopModel: Model<ShopAvailableDocument>,
    private readonly actifsService: ActifsService,
  ) {}

  async create(
    userId: string,
    dto: CreateShopItemDto,
  ): Promise<ShopAvailableDocument> {
    const existing = await this.actifsService.findActif(
      userId,
      dto.productId,
      dto.siteId,
    );
    if (!existing || existing.quantite < dto.quantite) {
      throw new BadRequestException(
        `Quantité insuffisante. Disponible: ${existing?.quantite ?? 0}`,
      );
    }

    return this.shopModel.create({
      vendeurId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(dto.productId),
      siteId: new Types.ObjectId(dto.siteId),
      actifId: existing._id ? new Types.ObjectId(existing._id) : undefined,
      quantite: dto.quantite,
      quantiteOriginale: dto.quantite,
      prixUnitaire: dto.prixUnitaire,
      description: dto.description || '',
      statut: ShopAvailableStatus.ACTIVE,
    });
  }

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    sortBy = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
  ): Promise<PaginationResult<ShopAvailableDocument>> {
    const filter: any = { statut: ShopAvailableStatus.ACTIVE };

    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.shopModel
        .find(filter)
        .populate('vendeurId', 'userNickName userName raisonSocial')
        .populate('productId', 'productName codeCPC productImage productDescription')
        .populate('siteId', 'siteName siteAddress')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.shopModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Annonces récupérées',
      data: data as any,
      total,
      page,
      limit,
    };
  }

  async findByVendeur(
    userId: string,
    page = 1,
    limit = 20,
    search?: string,
    sortBy = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    statut?: string,
  ): Promise<PaginationResult<ShopAvailableDocument>> {
    const filter: any = { vendeurId: new Types.ObjectId(userId) };

    if (statut && statut !== 'ALL') {
      filter.statut = statut;
    } else if (!statut) {
      filter.statut = ShopAvailableStatus.ACTIVE;
    }

    if (search) {
      filter.description = { $regex: search, $options: 'i' };
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.shopModel
        .find(filter)
        .populate('vendeurId', 'userNickName userName raisonSocial')
        .populate('productId', 'productName codeCPC productImage productDescription')
        .populate('siteId', 'siteName siteAddress')
        .sort({ [sortBy]: order === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.shopModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Mes annonces récupérées',
      data: data as any,
      total,
      page,
      limit,
    };
  }

  async findById(id: string): Promise<ShopAvailableDocument> {
    const item = await this.shopModel
      .findById(id)
      .populate('vendeurId', 'userNickName userName raisonSocial')
      .populate('productId', 'productName codeCPC productImage productDescription')
      .populate('siteId', 'siteName siteAddress')
      .exec();
    if (!item) {
      throw new NotFoundException('Annonce introuvable');
    }
    return item;
  }

  async cancel(userId: string, id: string): Promise<ShopAvailableDocument> {
    const item = await this.shopModel.findById(id);
    if (!item) {
      throw new NotFoundException('Annonce introuvable');
    }
    if (item.vendeurId.toString() !== userId) {
      throw new BadRequestException('Vous ne pouvez annuler que vos propres annonces');
    }
    if (item.statut !== ShopAvailableStatus.ACTIVE) {
      throw new BadRequestException('Seules les annonces actives peuvent être annulées');
    }

    item.statut = ShopAvailableStatus.CANCELLED;
    return item.save();
  }
}
