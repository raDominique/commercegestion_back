import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionType,
} from '../transactions/transactions.schema';
import { Actif, ActifDocument } from '../actifs/actifs.schema';
import { Passif, PassifDocument } from '../passifs/passifs.schema';
import { Product, ProductDocument } from '../products/products.schema';
import { Site, SiteDocument } from '../sites/sites.schema';
import { UserAccess, User, UserDocument } from '../users/users.schema';

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Actif.name)
    private readonly actifModel: Model<ActifDocument>,
    @InjectModel(Passif.name)
    private readonly passifModel: Model<PassifDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Site.name)
    private readonly siteModel: Model<SiteDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  // API 1 dashboard où il y a: nombre de retrait effectué, nombre de dépôt, stats stocks/produits, actifs, passifs, nombre de site, nombre de produits/sites, nombre de produits peut utiliser(productValidation=true)
  async getStats(
    userId: string,
    userAccess?: string,
  ): Promise<{
    retraitEffectue: number;
    depotEffectue: number;
    stocksProduits: number;
    actifs: number;
    passifs: number;
    nombreDeSite: number;
    nombreDeProduitsParSite: number;
    produitsUtilisables: number;
    totalSites?: number;
    totalUsers?: number;
    totalAssets?: number;
    totalLiabilities?: number;
    totalTransactions?: number;
    totalProducts?: number;
  }> {
    const userIdObj = new Types.ObjectId(userId);

    const [
      retraitEffectue,
      depotEffectue,
      stocksProduits,
      actifs,
      passifs,
      nombreDeSite,
      produitsUtilisables,
      totalSites,
      totalUsers,
      totalAssets,
      totalLiabilities,
      totalTransactions,
      totalProducts,
    ] = await Promise.all([
      this.transactionModel.countDocuments({
        initiatorId: userIdObj,
        type: TransactionType.RETRAIT,
      }),
      this.transactionModel.countDocuments({
        initiatorId: userIdObj,
        type: TransactionType.DEPOT,
      }),
      this.productModel.countDocuments({ productOwnerId: userIdObj }),
      this.actifModel.countDocuments({ userId: userIdObj, isActive: true }),
      this.passifModel.countDocuments({ userId: userIdObj, isActive: true }),
      this.siteModel.countDocuments({ siteUserID: userIdObj }),
      this.productModel.countDocuments({
        productOwnerId: userIdObj,
        productValidation: true,
      }),
      userAccess === UserAccess.ADMIN
        ? this.siteModel.countDocuments()
        : Promise.resolve(undefined),
      userAccess === UserAccess.ADMIN
        ? this.userModel.countDocuments()
        : Promise.resolve(undefined),
      userAccess === UserAccess.ADMIN
        ? this.actifModel.countDocuments()
        : Promise.resolve(undefined),
      userAccess === UserAccess.ADMIN
        ? this.passifModel.countDocuments()
        : Promise.resolve(undefined),
      userAccess === UserAccess.ADMIN
        ? this.transactionModel.countDocuments()
        : Promise.resolve(undefined),
      userAccess === UserAccess.ADMIN
        ? this.productModel.countDocuments()
        : Promise.resolve(undefined),
    ]);

    // Calcul du nombre de produits par site (moyenne ou total?)
    // On va considérer que c'est le nombre total de produits divisé par le nombre de sites
    const nombreDeProduitsParSite =
      nombreDeSite > 0 ? Number((stocksProduits / nombreDeSite).toFixed(2)) : 0;

    return {
      retraitEffectue,
      depotEffectue,
      stocksProduits,
      actifs,
      passifs,
      nombreDeSite,
      nombreDeProduitsParSite,
      produitsUtilisables,
      totalSites,
      totalUsers,
      totalAssets,
      totalLiabilities,
      totalTransactions,
      totalProducts,
    };
  }
}
