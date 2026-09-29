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
    // Les dépôts chez un tiers sont représentés par des écritures miroir :
    // selon le rôle de l'utilisateur, l'information peut être portée par
    // userId, ayant_droit, detentaire, creancierId ou initiator/recipient.
    // Le dashboard doit utiliser les mêmes rôles que les écrans Actifs,
    // Passifs et Transactions afin de ne pas retourner des statistiques vides.
    const actifFilter = {
      isActive: true,
      $or: [
        { userId: userIdObj },
        { ayant_droit: userIdObj },
        { detentaire: userIdObj },
      ],
    };
    const passifFilter = {
      isActive: true,
      $or: [
        { userId: userIdObj },
        { creancierId: userIdObj },
        { ayant_droit: userIdObj },
        { detentaire: userIdObj },
      ],
    };
    const transactionActorFilter = {
      $or: [
        { initiatorId: userIdObj },
        { recipientId: userIdObj },
        { ayant_droit: userIdObj },
        { detentaire: userIdObj },
      ],
    };

    const [
      retraitEffectue,
      depotEffectue,
      produitsEnStock,
      actifs,
      passifs,
      nombreDeSite,
      produitsUtilisablesStats,

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

      transactionsByMonth, // ✅ nom de variable ajouté
      transactionsByWeek, // ✅ nom de variable ajouté
    ] = await Promise.all([
      // --- placeholders pour les valeurs existantes ---
      // retraitEffectue
      this.transactionModel.countDocuments({
        type: TransactionType.RETRAIT,
        ...transactionActorFilter,
      }),
      // depotEffectue
      this.transactionModel.countDocuments({
        type: TransactionType.DEPOT,
        ...transactionActorFilter,
      }),
      // Produits réellement présents dans les actifs de l'utilisateur.
      // productOwnerId désigne le créateur du catalogue, pas le propriétaire
      // du stock ; l'utiliser ici donnait 0 pour la plupart des utilisateurs.
      this.actifModel.aggregate([
        { $match: actifFilter },
        { $group: { _id: '$productId' } },
      ]),
      // actifs
      this.actifModel.countDocuments(actifFilter),
      // passifs
      this.passifModel.countDocuments(passifFilter),
      // nombreDeSite
      this.siteModel.countDocuments({ siteUserID: userIdObj }),
      // Produits validés réellement utilisables dans les actifs de l'utilisateur.
      this.actifModel.aggregate([
        { $match: actifFilter },
        { $group: { _id: '$productId' } },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        { $unwind: '$product' },
        { $match: { 'product.productValidation': true } },
        { $count: 'total' },
      ]),

      // admin stats
      this.siteModel.countDocuments(),
      this.userModel.countDocuments(),
      this.actifModel.countDocuments(),
      this.passifModel.countDocuments(),
      this.transactionModel.countDocuments(),
      this.productModel.countDocuments(),

      // actifsGlobal
      this.actifModel.aggregate([
        { $match: actifFilter },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $multiply: ['$quantite', { $ifNull: ['$prixUnitaire', 0] }],
              },
            },
            quantite: { $sum: '$quantite' },
          },
        },
      ]),
      // passifsGlobal
      this.passifModel.aggregate([
        { $match: passifFilter },
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $multiply: ['$quantite', { $ifNull: ['$prixUnitaire', 0] }],
              },
            },
            quantite: { $sum: '$quantite' },
          },
        },
      ]),

      // actifsBySite
      this.actifModel.aggregate([
        { $match: actifFilter },
        {
          $group: {
            _id: '$depotId',
            total: {
              $sum: {
                $multiply: ['$quantite', { $ifNull: ['$prixUnitaire', 0] }],
              },
            },
          },
        },
        {
          $lookup: {
            from: 'sites',
            localField: '_id',
            foreignField: '_id',
            as: 'site',
          },
        },
        {
          $unwind: { path: '$site', preserveNullAndEmptyArrays: true },
        },
        {
          $project: {
            _id: 1,
            name: '$site.siteName',
            total: 1,
          },
        },
      ]),
      // passifsBySite
      this.passifModel.aggregate([
        { $match: passifFilter },
        {
          $group: {
            _id: '$depotId',
            total: {
              $sum: {
                $multiply: ['$quantite', { $ifNull: ['$prixUnitaire', 0] }],
              },
            },
          },
        },
        {
          $lookup: {
            from: 'sites',
            localField: '_id',
            foreignField: '_id',
            as: 'site',
          },
        },
        {
          $unwind: { path: '$site', preserveNullAndEmptyArrays: true },
        },
        {
          $project: {
            _id: 1,
            name: '$site.siteName',
            total: 1,
          },
        },
      ]),

      // actifsByProduct
      this.actifModel.aggregate([
        { $match: actifFilter },
        {
          $group: {
            _id: '$productId',
            total: {
              $sum: {
                $multiply: ['$quantite', { $ifNull: ['$prixUnitaire', 0] }],
              },
            },
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        {
          $unwind: { path: '$product', preserveNullAndEmptyArrays: true },
        },
        {
          $project: {
            _id: 1,
            name: '$product.productName',
            total: 1,
          },
        },
      ]),
      // passifsByProduct
      this.passifModel.aggregate([
        { $match: passifFilter },
        {
          $group: {
            _id: '$productId',
            total: {
              $sum: {
                $multiply: ['$quantite', { $ifNull: ['$prixUnitaire', 0] }],
              },
            },
          },
        },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'product',
          },
        },
        {
          $unwind: { path: '$product', preserveNullAndEmptyArrays: true },
        },
        {
          $project: {
            _id: 1,
            name: '$product.productName',
            total: 1,
          },
        },
      ]),

      /**
       * ============================
       * TRANSACTIONS PAR MOIS
       * ============================
       */
      this.transactionModel.aggregate([
        {
          $match: transactionActorFilter,
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            '_id.year': 1,
            '_id.month': 1,
          },
        },
      ]),

      /**
       * ============================
       * TRANSACTIONS PAR SEMAINE
       * ============================
       */
      this.transactionModel.aggregate([
        {
          $match: transactionActorFilter,
        },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              week: { $week: '$createdAt' },
            },
            count: { $sum: 1 },
          },
        },
        {
          $sort: {
            '_id.year': 1,
            '_id.week': 1,
          },
        },
      ]),
    ]);

    /**
     * ============================
     * PRODUITS / SITE
     * ============================
     */

    const stocksProduits = produitsEnStock.length;
    const produitsUtilisables = produitsUtilisablesStats[0]?.total || 0;
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

          transactionsByMonth, // ✅ maintenant résolu
          transactionsByWeek, // ✅ maintenant résolu
        },
      },
    };
  }
}
