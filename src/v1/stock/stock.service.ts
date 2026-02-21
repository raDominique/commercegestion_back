import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductService } from '../products/products.service';
import { SiteService } from '../sites/sites.service';
import { CreateMovementDto } from './dto/create-movement.dto';
import {
  StockMovement,
  StockMovementDocument,
  MovementType,
} from './stock-movement.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@Injectable()
export class StockService {
  constructor(
    @InjectModel(StockMovement.name)
    private movementModel: Model<StockMovementDocument>,
    private readonly productService: ProductService,
    private readonly siteService: SiteService,
  ) {}

  async createMovement(dto: CreateMovementDto, userId: string) {
    // 1. Vérifier l'existence du produit (via ProductService)
    const product = await this.productService.findOneRaw(dto.productId);


    // 2. RÈGLE : Validation Admin requise
    if (!product.productValidation) {
      throw new BadRequestException("Produit non validé par l'admin.");
    }

    // 3. Vérifier que les sites existent (via SiteService)
    const siteOrigine = await this.siteService.findOne(dto.siteOrigineId);
    const siteDest = await this.siteService.findOne(dto.siteDestinationId);


    // 4. Création du mouvement
    const movement = new this.movementModel({
      operatorId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(dto.productId),
      depotOrigine: siteOrigine.siteName,
      depotDestination: siteDest.siteName,
      siteOrigineId: siteOrigine._id,
      siteDestinationId: siteDest._id,
      quantite: dto.quantite,
      type: dto.type,
      observations: dto.observations,
    });

    const saved = await movement.save();

    // 5. Si c'est un dépôt, marquer le produit comme stocké
    if (dto.type === MovementType.DEPOT && !product.isStocker) {
      await this.productService.setStockStatus(dto.productId, true);
    }

    return {
      status: 'success',
      message: `Opération de ${dto.type} effectuée sur le site ${siteDest.siteName}`,
      data: saved,
    };
  }

  async getHistory(userId: string) {
    return this.movementModel
      .find({ operatorId: new Types.ObjectId(userId) })
      .populate('productId', 'productName codeCPC')
      .sort({ createdAt: -1 })
      .exec();
  }

  //  On peut utiliser le findAll du productService avec isStocker=true
  // src/v1/stock/stock.service.ts

  async getMyAssets(
    userId: string,
    query: any,
  ): Promise<PaginationResult<any>> {
    const {
      siteId,
      productId,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = query;
    const skip = (Number(page) - 1) * Number(limit);

    // 1. Filtre de base
    const filter: any = { operatorId: new Types.ObjectId(userId) };

    if (siteId) {
      filter.$or = [
        { siteOrigineId: new Types.ObjectId(siteId) },
        { siteDestinationId: new Types.ObjectId(siteId) },
      ];
    }

    if (productId) filter.productId = new Types.ObjectId(productId);

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // 2. Exécution parallèle : Mouvements + Total + Calcul des soldes (Summary)
    const [movements, total, aggregateStock] = await Promise.all([
      this.movementModel
        .find(filter)
        .populate('productId', 'productName codeCPC productImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      this.movementModel.countDocuments(filter),
      this.movementModel.aggregate([
        { $match: { operatorId: new Types.ObjectId(userId) } },
        {
          $group: {
            _id: '$productId',
            solde: {
              $sum: {
                $cond: [
                  { $eq: ['$type', MovementType.DEPOT] },
                  '$quantite',
                  { $multiply: ['$quantite', -1] },
                ],
              },
            },
          },
        },
      ]),
    ]);

    // 3. Retour aplati (Flat Response)
    return {
      status: 'success',
      message: 'Actifs récupérés',
      data: movements, // Directement la liste ici
      summary: aggregateStock, // Les soldes sont au même niveau que data
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }
}
