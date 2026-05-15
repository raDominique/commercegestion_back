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

import { User, UserAccess, UserDocument } from '../users/users.schema';

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

  async getDashboard(userId: string, userAccess?: string) {
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

      actifsGlobal,
      passifsGlobal,

      actifsBySite,
      passifsBySite,

      actifsByProduct,
      passifsByProduct,
    ] = await Promise.all([
      /**
       * ============================
       * GLOBAL STATS
       * ============================
       */

      this.transactionModel.countDocuments({
        initiatorId: userIdObj,
        type: TransactionType.RETRAIT,
      }),

      this.transactionModel.countDocuments({
        initiatorId: userIdObj,
        type: TransactionType.DEPOT,
      }),

      this.productModel.countDocuments({
        productOwnerId: userIdObj,
      }),

      this.actifModel.countDocuments({
        userId: userIdObj,
        isActive: true,
      }),

      this.passifModel.countDocuments({
        userId: userIdObj,
        isActive: true,
      }),

      this.siteModel.countDocuments({
        siteUserID: userIdObj,
      }),

      this.productModel.countDocuments({
        productOwnerId: userIdObj,
        productValidation: true,
      }),

      /**
       * ============================
       * ADMIN STATS
       * ============================
       */

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

      /**
       * ============================
       * GLOBAL INVENTORY
       * ============================
       */

      this.actifModel.aggregate([
        {
          $match: {
            userId: userIdObj,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            quantite: {
              $sum: '$quantite',
            },
          },
        },
      ]),

      this.passifModel.aggregate([
        {
          $match: {
            userId: userIdObj,
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            quantite: {
              $sum: '$quantite',
            },
          },
        },
      ]),

      /**
       * ============================
       * ACTIFS PAR SITE
       * ============================
       */

      this.actifModel.aggregate([
        {
          $match: {
            userId: userIdObj,
          },
        },
        {
          $lookup: {
            from: 'sites',
            localField: 'depotId',
            foreignField: '_id',
            as: 'site',
          },
        },
        {
          $unwind: '$site',
        },
        {
          $group: {
            _id: '$site._id',

            siteName: {
              $first: '$site.siteName',
            },

            total: {
              $sum: 1,
            },

            quantite: {
              $sum: '$quantite',
            },
          },
        },
        {
          $sort: {
            quantite: -1,
          },
        },
      ]),

      /**
       * ============================
       * PASSIFS PAR SITE
       * ============================
       */

      this.passifModel.aggregate([
        {
          $match: {
            userId: userIdObj,
          },
        },
        {
          $lookup: {
            from: 'sites',
            localField: 'depotId',
            foreignField: '_id',
            as: 'site',
          },
        },
        {
          $unwind: '$site',
        },
        {
          $group: {
            _id: '$site._id',

            siteName: {
              $first: '$site.siteName',
            },

            total: {
              $sum: 1,
            },

            quantite: {
              $sum: '$quantite',
            },
          },
        },
        {
          $sort: {
            quantite: -1,
          },
        },
      ]),

      /**
       * ============================
       * ACTIFS PAR PRODUIT
       * ============================
       */

      this.actifModel.aggregate([
        {
          $match: {
            userId: userIdObj,
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product',
          },
        },
        {
          $unwind: '$product',
        },
        {
          $group: {
            _id: '$product._id',

            productName: {
              $first: '$product.productName',
            },

            productImage: {
              $first: '$product.productImage',
            },

            total: {
              $sum: 1,
            },

            quantite: {
              $sum: '$quantite',
            },
          },
        },
        {
          $sort: {
            quantite: -1,
          },
        },
        {
          $limit: 10,
        },
      ]),

      /**
       * ============================
       * PASSIFS PAR PRODUIT
       * ============================
       */

      this.passifModel.aggregate([
        {
          $match: {
            userId: userIdObj,
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: 'productId',
            foreignField: '_id',
            as: 'product',
          },
        },
        {
          $unwind: '$product',
        },
        {
          $group: {
            _id: '$product._id',

            productName: {
              $first: '$product.productName',
            },

            productImage: {
              $first: '$product.productImage',
            },

            total: {
              $sum: 1,
            },

            quantite: {
              $sum: '$quantite',
            },
          },
        },
        {
          $sort: {
            quantite: -1,
          },
        },
        {
          $limit: 10,
        },
      ]),
    ]);

    /**
     * ============================
     * PRODUITS / SITE
     * ============================
     */

    const nombreDeProduitsParSite =
      nombreDeSite > 0 ? Number((stocksProduits / nombreDeSite).toFixed(2)) : 0;

    return {
      stats: {
        retraitEffectue,
        depotEffectue,

        stocksProduits,

        actifs,
        passifs,

        nombreDeSite,

        nombreDeProduitsParSite,

        produitsUtilisables,

        admin:
          userAccess === UserAccess.ADMIN
            ? {
                totalSites,
                totalUsers,
                totalAssets,
                totalLiabilities,
                totalTransactions,
                totalProducts,
              }
            : undefined,
      },

      inventory: {
        global: {
          actifs: actifsGlobal[0]?.total || 0,

          passifs: passifsGlobal[0]?.total || 0,

          quantiteTotaleActifs: actifsGlobal[0]?.quantite || 0,

          quantiteTotalePassifs: passifsGlobal[0]?.quantite || 0,
        },

        charts: {
          actifsBySite,
          passifsBySite,

          actifsByProduct,
          passifsByProduct,
        },
      },
    };
  }
}
