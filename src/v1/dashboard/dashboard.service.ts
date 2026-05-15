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

      transactionsByMonth, // ✅ nom de variable ajouté
      transactionsByWeek, // ✅ nom de variable ajouté
    ] = await Promise.all([
      // --- placeholders pour les valeurs existantes ---
      // retraitEffectue
      this.transactionModel.countDocuments({
        initiatorId: userIdObj,
        type: TransactionType.RETRAIT,
      }),
      // depotEffectue
      this.transactionModel.countDocuments({
        initiatorId: userIdObj,
        type: TransactionType.DEPOT,
      }),
      // stocksProduits
      this.productModel.countDocuments({ userId: userIdObj }),
      // actifs
      this.actifModel.countDocuments({ userId: userIdObj }),
      // passifs
      this.passifModel.countDocuments({ userId: userIdObj }),
      // nombreDeSite
      this.siteModel.countDocuments({ userId: userIdObj }),
      // produitsUtilisables
      this.productModel.countDocuments({ userId: userIdObj, usable: true }),

      // admin stats
      this.siteModel.countDocuments(),
      this.userModel.countDocuments(),
      this.actifModel.countDocuments(),
      this.passifModel.countDocuments(),
      this.transactionModel.countDocuments(),
      this.productModel.countDocuments(),

      // actifsGlobal
      this.actifModel.aggregate([
        { $match: { userId: userIdObj } },
        {
          $group: {
            _id: null,
            total: { $sum: '$montant' },
            quantite: { $sum: '$quantite' },
          },
        },
      ]),
      // passifsGlobal
      this.passifModel.aggregate([
        { $match: { userId: userIdObj } },
        {
          $group: {
            _id: null,
            total: { $sum: '$montant' },
            quantite: { $sum: '$quantite' },
          },
        },
      ]),

      // actifsBySite
      this.actifModel.aggregate([
        { $match: { userId: userIdObj } },
        { $group: { _id: '$siteId', total: { $sum: '$montant' } } },
      ]),
      // passifsBySite
      this.passifModel.aggregate([
        { $match: { userId: userIdObj } },
        { $group: { _id: '$siteId', total: { $sum: '$montant' } } },
      ]),

      // actifsByProduct
      this.actifModel.aggregate([
        { $match: { userId: userIdObj } },
        { $group: { _id: '$productId', total: { $sum: '$montant' } } },
      ]),
      // passifsByProduct
      this.passifModel.aggregate([
        { $match: { userId: userIdObj } },
        { $group: { _id: '$productId', total: { $sum: '$montant' } } },
      ]),

      /**
       * ============================
       * TRANSACTIONS PAR MOIS
       * ============================
       */
      this.transactionModel.aggregate([
        {
          $match: {
            initiatorId: userIdObj,
          },
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
          $match: {
            initiatorId: userIdObj,
          },
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
