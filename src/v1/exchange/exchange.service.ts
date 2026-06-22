import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ActifsService } from '../actifs/actifs.service';
import { PassifsService } from '../passifs/passifs.service';
import { UsersService } from '../users/users.service';
import { ProductService } from '../products/products.service';
import { MailService } from '../../shared/mail/mail.service';
import { ExchangeOffer, ExchangeOfferDocument } from './exchange.schema';
import { BuyExchangeOfferDto, CreateExchangeOfferDto } from './exchange.dto';

@Injectable()
export class ExchangeService {
  constructor(
    @InjectModel(ExchangeOffer.name)
    private readonly offerModel: Model<ExchangeOfferDocument>,
    private readonly actifsService: ActifsService,
    private readonly passifsService: PassifsService,
    private readonly usersService: UsersService,
    private readonly productService: ProductService,
    private readonly mailService: MailService,
  ) {}

  async createOffer(dto: CreateExchangeOfferDto, vendeurId: string) {
    if (!dto.acceptedDetenteurBIds || dto.acceptedDetenteurBIds.length === 0) {
      throw new BadRequestException(
        'Veuillez renseigner au moins un détenteur accepté (Y) pour le produit de contrepartie (B).',
      );
    }

    // Validation: le vendeur doit disposer d'un actif A chez le détenteur W au dépôt indiqué
    // L'actif de dépôt est stocké sous userId = detentaireAId, avec ayant_droit = vendeurId.
    const actifA = await this.actifsService.findDepositedActif({
      detentaireId: dto.detentaireAId,
      depotId: dto.depotAId,
      productId: dto.productAId,
      ayantDroitId: vendeurId,
      minQuantite: dto.quantiteA,
    });
    if (!actifA) {
      throw new BadRequestException(
        "Stock insuffisant: l'actif A du vendeur n'existe pas (ou quantité insuffisante) chez le détenteur/dépôt indiqué",
      );
    }

    const offer = new this.offerModel({
      vendeurId: new Types.ObjectId(vendeurId),
      productAId: new Types.ObjectId(dto.productAId),
      quantiteA: dto.quantiteA,
      detentaireAId: new Types.ObjectId(dto.detentaireAId),
      depotAId: new Types.ObjectId(dto.depotAId),
      productBId: new Types.ObjectId(dto.productBId),
      tauxEchange: dto.tauxEchange,
      acceptedDetenteurBIds: (dto.acceptedDetenteurBIds || []).map(
        (id) => new Types.ObjectId(id),
      ),
      isActive: true,
    });

    const saved = await offer.save();

    return {
      status: 'success',
      message: 'Offre d’échange créée',
      data: [saved],
      total: 1,
    };
  }

  async searchOffers(query: any) {
    const {
      productAId,
      productBId,
      detentaireAId,
      acceptedDetenteurBId,
      maxTaux,
      minTaux,
      page = 1,
      limit = 20,
    } = query;

    const filter: any = { isActive: true };
    if (productAId) filter.productAId = new Types.ObjectId(productAId);
    if (productBId) filter.productBId = new Types.ObjectId(productBId);
    if (detentaireAId) filter.detentaireAId = new Types.ObjectId(detentaireAId);
    if (acceptedDetenteurBId) {
      filter.acceptedDetenteurBIds = new Types.ObjectId(acceptedDetenteurBId);
    }
    if (minTaux || maxTaux) {
      filter.tauxEchange = {};
      if (minTaux) filter.tauxEchange.$gte = Number(minTaux);
      if (maxTaux) filter.tauxEchange.$lte = Number(maxTaux);
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      this.offerModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate([
          { path: 'vendeurId', select: 'userFirstname userName userNickName userEmail' },
          { path: 'detentaireAId', select: 'userFirstname userName userNickName userEmail' },
          { path: 'depotAId', select: 'siteName' },
          { path: 'productAId', select: 'productName' },
          { path: 'productBId', select: 'productName' },
          { path: 'acceptedDetenteurBIds', select: 'userFirstname userName userNickName' },
        ])
        .exec(),
      this.offerModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Offres d’échange',
      data,
      total,
      page: Number(page),
      limit: Number(limit),
    };
  }

  async buyOffer(offerId: string, dto: BuyExchangeOfferDto, acheteurId: string) {
    const offer = await this.offerModel.findById(offerId);
    if (!offer || !offer.isActive) {
      throw new NotFoundException('Offre introuvable ou inactive');
    }

    if (dto.quantiteA > offer.quantiteA) {
      throw new BadRequestException('Quantité demandée supérieure à la quantité disponible');
    }

    const qtyA = dto.quantiteA;
    const qtyB = qtyA * (offer.tauxEchange || 0);

    if (qtyB <= 0) {
      throw new BadRequestException('Taux d’échange invalide');
    }

    // 1) Trouver un détenteur Y accepté qui a assez de B pour l'acheteur
    const accepted = offer.acceptedDetenteurBIds?.length
      ? offer.acceptedDetenteurBIds.map((id) => id.toString())
      : [];

    if (accepted.length === 0) {
      throw new BadRequestException('Aucun détenteur accepté pour la contrepartie (produit B)');
    }

    // On cherche un actif B appartenant à l'acheteur (ayant_droit=acheteurId) chez un détenteur Y accepté.
    // depotId libre: on prend n'importe quel dépôt où la quantité est suffisante.
    let actifB: any = null;
    for (const detentaireId of accepted) {
      actifB = await this.actifsService.findDepositedActif({
        detentaireId,
        productId: offer.productBId.toString(),
        ayantDroitId: acheteurId,
        minQuantite: qtyB,
      });
      if (actifB) break;
    }

    if (!actifB) {
      throw new BadRequestException("Contrepartie insuffisante: aucun détenteur accepté ne dispose d'assez de produit B pour l'acheteur");
    }

    const detentaireBId = actifB.userId.toString();
    const depotBId = actifB.depotId.toString();

    // 2) Transfert de droit sur A: vendeur -> acheteur, détenteur W inchangé
    await this.actifsService.transferAyantDroitWithinDetentaire({
      detentaireId: offer.detentaireAId.toString(),
      depotId: offer.depotAId.toString(),
      productId: offer.productAId.toString(),
      fromAyantDroitId: offer.vendeurId.toString(),
      toAyantDroitId: acheteurId,
      quantite: qtyA,
      prixUnitaire: 0,
    });

    await this.passifsService.transferDebtorByCreditor({
      fromDebtorId: offer.vendeurId.toString(),
      toDebtorId: acheteurId,
      productId: offer.productAId.toString(),
      creancierId: offer.detentaireAId.toString(),
      quantite: qtyA,
      depotId: offer.depotAId.toString(),
    });

    // 3) Transfert de droit sur B: acheteur -> vendeur, détenteur Y inchangé
    await this.actifsService.transferAyantDroitWithinDetentaire({
      detentaireId: detentaireBId,
      depotId: depotBId,
      productId: offer.productBId.toString(),
      fromAyantDroitId: acheteurId,
      toAyantDroitId: offer.vendeurId.toString(),
      quantite: qtyB,
      prixUnitaire: 0,
    });

    await this.passifsService.transferDebtorByCreditor({
      fromDebtorId: acheteurId,
      toDebtorId: offer.vendeurId.toString(),
      productId: offer.productBId.toString(),
      creancierId: detentaireBId,
      quantite: qtyB,
      depotId: depotBId,
    });

    // 4) Mettre à jour l'offre
    offer.quantiteA -= qtyA;
    if (offer.quantiteA <= 0) {
      offer.isActive = false;
    }
    await offer.save();

    // 5) Numéro transaction simple pour l'email (on ne force pas l'écriture ledger ici)
    const txNumber = `EX-${Date.now()}`;

    // Notifications email (V, W, X, Y)
    await this.sendExchangeNotifications({
      vendeurId: offer.vendeurId.toString(),
      detentaireAId: offer.detentaireAId.toString(),
      acheteurId,
      detentaireBId,
      productAId: offer.productAId.toString(),
      productBId: offer.productBId.toString(),
      qtyA,
      qtyB,
    });

    return {
      status: 'success',
      message: 'Échange réalisé',
      data: [
        {
          offerId: offer._id,
          quantiteA: qtyA,
          quantiteB: qtyB,
          transactionNumber: txNumber,
          detentaireBId,
          depotBId,
        },
      ],
      total: 1,
    };
  }

  private async sendExchangeNotifications(params: {
    vendeurId: string;
    detentaireAId: string;
    acheteurId: string;
    detentaireBId: string;
    productAId: string;
    productBId: string;
    qtyA: number;
    qtyB: number;
  }) {
    const {
      vendeurId,
      detentaireAId,
      acheteurId,
      detentaireBId,
      productAId,
      productBId,
      qtyA,
      qtyB,
    } = params;

    const [vendeur, detA, acheteur, detB] = await Promise.all([
      this.usersService.getById(vendeurId),
      this.usersService.getById(detentaireAId),
      this.usersService.getById(acheteurId),
      this.usersService.getById(detentaireBId),
    ]);

    const [prodA, prodB] = await Promise.all([
      this.productService.findById(productAId),
      this.productService.findById(productBId),
    ]);

    const prodAName = prodA?.data?.[0]?.productName || 'Produit A';
    const prodBName = prodB?.data?.[0]?.productName || 'Produit B';

    const type = 'Échange d’actifs';
    const txNum = `EX-${Date.now()}`;
    const approverName = acheteur.userName;

    const send = async (user: any, label: string) => {
      if (!user?.userEmail) return;
      await this.mailService.notificationTransactionApproved(
        user.userEmail,
        user.userName,
        type,
        `${prodAName} ↔ ${prodBName}`,
        qtyA,
        txNum,
        approverName,
      );
    };

    await Promise.all([
      send(vendeur, 'vendeur'),
      send(detA, 'detenteurA'),
      send(acheteur, 'acheteur'),
      send(detB, 'detenteurB'),
    ]);
  }
}
