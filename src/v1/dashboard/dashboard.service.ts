import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Transaction,
  TransactionDocument,
  TransactionStatus,
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
    @InjectModel(Actif.name) private readonly actifModel: Model<ActifDocument>,
    @InjectModel(Passif.name)
    private readonly passifModel: Model<PassifDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Site.name) private readonly siteModel: Model<SiteDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private inventoryGlobal(model: Model<any>, filter: Record<string, any>) {
    return model.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          lignes: { $sum: 1 },
          quantite: { $sum: '$quantite' },
          quantiteEnAttente: { $sum: { $ifNull: ['$quantiteEnAttente', 0] } },
        },
      },
    ]);
  }

  private inventoryBySite(model: Model<any>, filter: Record<string, any>) {
    return model.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$depotId',
          total: { $sum: '$quantite' },
          quantiteEnAttente: { $sum: { $ifNull: ['$quantiteEnAttente', 0] } },
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
      { $unwind: { path: '$site', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: { $ifNull: ['$site.siteName', 'Site inconnu'] },
          total: 1,
          quantiteEnAttente: 1,
        },
      },
      { $sort: { total: -1 } },
    ]);
  }

  private inventoryByProduct(model: Model<any>, filter: Record<string, any>) {
    return model.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$productId',
          total: { $sum: '$quantite' },
          quantiteEnAttente: { $sum: { $ifNull: ['$quantiteEnAttente', 0] } },
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
      { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          name: { $ifNull: ['$product.productName', 'Produit inconnu'] },
          total: 1,
          quantiteEnAttente: 1,
        },
      },
      { $sort: { total: -1 } },
    ]);
  }

  private completedTransactions(
    filter: Record<string, any>,
    type?: TransactionType,
  ) {
    return this.transactionModel.aggregate([
      { $match: type ? { ...filter, type } : filter },
      {
        $group: {
          _id: null,
          nombre: { $sum: 1 },
          quantite: { $sum: '$quantite' },
        },
      },
    ]);
  }

  async getDashboard(userId: string, userAccess?: string) {
    const userIdObj = new Types.ObjectId(userId);
    // `userId` est le bilan réel. Les lignes ayant_droit/detentaire sont des
    // miroirs du même dépôt, et ne doivent pas être additionnées ici.
    const actifFilter = { isActive: true, userId: userIdObj };
    const passifFilter = { isActive: true, userId: userIdObj };
    const transactionFilter = {
      $or: [
        { initiatorId: userIdObj },
        { recipientId: userIdObj },
        { ayant_droit: userIdObj },
        { detentaire: userIdObj },
      ],
      isActive: true,
      status: TransactionStatus.APPROVED,
    };

    const [
      retraits,
      depots,
      produitsEnStock,
      produitsUtilisables,
      nombreDeSite,
      actifsGlobalRows,
      passifsGlobalRows,
      actifsBySite,
      passifsBySite,
      actifsByProduct,
      passifsByProduct,
      transactionsByMonth,
      transactionsByWeek,
      totalSites,
      totalUsers,
      totalAssets,
      totalLiabilities,
      totalTransactions,
      totalProducts,
    ] = await Promise.all([
      this.completedTransactions(transactionFilter, TransactionType.RETRAIT),
      this.completedTransactions(transactionFilter, TransactionType.DEPOT),
      this.actifModel.aggregate([
        { $match: actifFilter },
        { $group: { _id: '$productId' } },
      ]),
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
      this.siteModel.countDocuments({ siteUserID: userIdObj }),
      this.inventoryGlobal(this.actifModel, actifFilter),
      this.inventoryGlobal(this.passifModel, passifFilter),
      this.inventoryBySite(this.actifModel, actifFilter),
      this.inventoryBySite(this.passifModel, passifFilter),
      this.inventoryByProduct(this.actifModel, actifFilter),
      this.inventoryByProduct(this.passifModel, passifFilter),
      this.transactionModel.aggregate([
        { $match: transactionFilter },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
            },
            count: { $sum: 1 },
            quantite: { $sum: '$quantite' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      this.transactionModel.aggregate([
        { $match: transactionFilter },
        {
          $group: {
            _id: {
              year: { $isoWeekYear: '$createdAt' },
              week: { $isoWeek: '$createdAt' },
            },
            count: { $sum: 1 },
            quantite: { $sum: '$quantite' },
          },
        },
        { $sort: { '_id.year': 1, '_id.week': 1 } },
      ]),
      this.siteModel.countDocuments(),
      this.userModel.countDocuments(),
      this.actifModel.countDocuments({ isActive: true }),
      this.passifModel.countDocuments({ isActive: true }),
      this.transactionModel.countDocuments({ isActive: true }),
      this.productModel.countDocuments(),
    ]);

    const actifsGlobal = actifsGlobalRows[0];
    const passifsGlobal = passifsGlobalRows[0];
    const retrait = retraits[0];
    const depot = depots[0];
    const quantiteTotaleActifs = actifsGlobal?.quantite || 0;
    const quantiteEnAttenteActifs = actifsGlobal?.quantiteEnAttente || 0;
    const quantiteTotalePassifs = passifsGlobal?.quantite || 0;
    const quantiteEnAttentePassifs = passifsGlobal?.quantiteEnAttente || 0;

    return {
      stats: {
        // Compatibilité : nombre d'opérations approuvées.
        retraitEffectue: retrait?.nombre || 0,
        depotEffectue: depot?.nombre || 0,
        quantiteRetraitEffectuee: retrait?.quantite || 0,
        quantiteDepotEffectuee: depot?.quantite || 0,
        stocksProduits: produitsEnStock.length,
        actifs: actifsGlobal?.lignes || 0,
        passifs: passifsGlobal?.lignes || 0,
        nombreDeSite,
        nombreDeProduitsParSite:
          nombreDeSite > 0
            ? Number((produitsEnStock.length / nombreDeSite).toFixed(2))
            : 0,
        produitsUtilisables: produitsUtilisables[0]?.total || 0,
        quantiteTotaleActifs,
        quantiteDisponibleActifs: Math.max(
          0,
          quantiteTotaleActifs - quantiteEnAttenteActifs,
        ),
        quantiteEnAttenteActifs,
        quantiteTotalePassifs,
        quantiteDisponiblePassifs: Math.max(
          0,
          quantiteTotalePassifs - quantiteEnAttentePassifs,
        ),
        quantiteEnAttentePassifs,
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
          actifs: quantiteTotaleActifs,
          passifs: quantiteTotalePassifs,
          quantiteTotaleActifs,
          quantiteTotalePassifs,
          quantiteEnAttenteActifs,
          quantiteEnAttentePassifs,
          quantiteDisponibleActifs: Math.max(
            0,
            quantiteTotaleActifs - quantiteEnAttenteActifs,
          ),
          quantiteDisponiblePassifs: Math.max(
            0,
            quantiteTotalePassifs - quantiteEnAttentePassifs,
          ),
        },
        charts: {
          // `total` est toujours une quantité physique.
          actifsBySite,
          passifsBySite,
          actifsByProduct,
          passifsByProduct,
          transactionsByMonth,
          transactionsByWeek,
        },
      },
    };
  }
}
