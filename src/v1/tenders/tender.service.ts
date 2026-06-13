import { MailService } from './../../shared/mail/mail.service';
import { ProductService } from './../products/products.service';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Tender,
  TenderDocument,
  TenderStatus,
  Bid,
  BidDocument,
  BidStatus,
} from './tender.schema';
import { CreateTenderDto } from './dto/create-tender.dto';
import { SubmitBidDto } from './dto/submit-bid.dto';
import { AwardTenderDto } from './dto/award-tender.dto';
import { UpdateTenderDto } from './dto/update-tender.dto';
import { UpdateBidDto } from './dto/update-bid.dto';
import { UploadService } from '../../shared/upload/upload.service';
import { PaginationResult } from '../../shared/interfaces/pagination.interface';

@Injectable()
export class TenderService {
  constructor(
    @InjectModel(Tender.name)
    private readonly tenderModel: Model<TenderDocument>,
    @InjectModel(Bid.name)
    private readonly bidModel: Model<BidDocument>,
    private readonly uploadService: UploadService,
    private readonly mailService: MailService,
  ) {}

  // ===================== TENDERS =====================

  async create(
    userId: string,
    dto: CreateTenderDto,
    file?: Express.Multer.File,
  ): Promise<TenderDocument> {
    let documentPieces = '';
    if (file) {
      documentPieces = await this.uploadService.saveFile(file, 'tenders');
    }

    return this.tenderModel.create({
      lanceurId: new Types.ObjectId(userId),
      productId: new Types.ObjectId(dto.productId),
      titre: dto.titre,
      description: dto.description,
      quantite: dto.quantite,
      unite: dto.unite || '',
      dateLimite: new Date(dto.dateLimite),
      siteLivraison: dto.siteLivraison ? new Types.ObjectId(dto.siteLivraison) : null,
      conditionsPaiement: dto.conditionsPaiement || '',
      delaiLivraisonSouhaite: dto.delaiLivraisonSouhaite || '',
      documentPieces,
      statut: TenderStatus.OUVERT,
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTenderDto,
    file?: Express.Multer.File,
  ): Promise<TenderDocument> {
    const tender = await this.tenderModel.findById(id);
    if (!tender) throw new NotFoundException('Appel d\'offres introuvable');
    if (tender.lanceurId.toString() !== userId) {
      throw new BadRequestException('Seul le lanceur peut modifier cet appel d\'offres');
    }
    if (tender.statut !== TenderStatus.OUVERT) {
      throw new BadRequestException('Seuls les appels d\'offres ouverts peuvent être modifiés');
    }

    const updateData: any = { ...dto };
    if (file) {
      updateData.documentPieces = await this.uploadService.saveFile(file, 'tenders');
    }
    if (dto.productId) updateData.productId = new Types.ObjectId(dto.productId);
    if (dto.siteLivraison) updateData.siteLivraison = new Types.ObjectId(dto.siteLivraison);
    if (dto.dateLimite) updateData.dateLimite = new Date(dto.dateLimite);

    const updatedTender = await this.tenderModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    if (!updatedTender) throw new NotFoundException('Appel d\'offres introuvable');
    return updatedTender;
  }

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    statut?: TenderStatus,
    sortBy = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
    userId?: string,
  ): Promise<PaginationResult<any>> {
    const filter: any = {};

    if (statut) {
      filter.statut = statut;
    }
    if (search) {
      filter.$or = [
        { titre: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const sortOrder = order === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.tenderModel
        .find(filter)
        .populate('lanceurId', 'userNickName userName raisonSocial')
        .populate('productId', 'productName codeCPC productImage')
        .populate('siteLivraison', 'siteName siteAddress')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.tenderModel.countDocuments(filter),
    ]);

    const enriched = await this.enrichWithHasBid(data, userId);

    return {
      status: 'success',
      message: 'Appels d\'offres récupérés',
      data: enriched,
      total,
      page,
      limit,
    };
  }

  async findMine(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<PaginationResult<TenderDocument>> {
    const filter = { lanceurId: new Types.ObjectId(userId) };
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.tenderModel
        .find(filter)
        .populate('lanceurId', 'userNickName userName raisonSocial')
        .populate('productId', 'productName codeCPC productImage')
        .populate('siteLivraison', 'siteName siteAddress')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.tenderModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Mes appels d\'offres récupérés',
      data: data as any,
      total,
      page,
      limit,
    };
  }

  async findById(id: string, userId?: string): Promise<any> {
    const tender = await this.tenderModel
      .findById(id)
      .populate('lanceurId', 'userNickName userName raisonSocial userEmail userPhone')
      .populate('productId', 'productName codeCPC productImage')
      .populate('siteLivraison', 'siteName siteAddress')
      .populate('soumissionRetenue')
      .exec();
    if (!tender) {
      throw new NotFoundException('Appel d\'offres introuvable');
    }

    let hasBid = false;
    if (userId) {
      const bid = await this.bidModel
        .findOne({
          appelOffreId: new Types.ObjectId(id),
          soumissionnaireId: new Types.ObjectId(userId),
        })
        .exec();
      hasBid = !!bid;
    }

    return { ...tender.toObject(), hasBid };
  }

  private async enrichWithHasBid(
    tenders: TenderDocument[],
    userId?: string,
  ): Promise<any[]> {
    if (!userId || !tenders.length) {
      return tenders.map(t => ({ ...t.toObject(), hasBid: false }));
    }

    const tenderIds = tenders.map(t => t._id);
    const userBids = await this.bidModel
      .find({
        soumissionnaireId: new Types.ObjectId(userId),
        appelOffreId: { $in: tenderIds },
      })
      .select('appelOffreId')
      .exec();

    const bidTenderIds = new Set(userBids.map(b => b.appelOffreId.toString()));

    return tenders.map(t => ({
      ...t.toObject(),
      hasBid: bidTenderIds.has(t._id.toString()),
    }));
  }

  async cancel(userId: string, id: string): Promise<TenderDocument> {
    const tender = await this.tenderModel.findById(id);
    if (!tender) {
      throw new NotFoundException('Appel d\'offres introuvable');
    }
    if (tender.lanceurId.toString() !== userId) {
      throw new BadRequestException(
        'Seul le lanceur peut annuler cet appel d\'offres',
      );
    }
    if (tender.statut !== TenderStatus.OUVERT) {
      throw new BadRequestException(
        'Seuls les appels d\'offres ouverts peuvent être annulés',
      );
    }

    tender.statut = TenderStatus.ANNULE;
    return tender.save();
  }

  // ===================== BIDS =====================

  async submitBid(
    userId: string,
    dto: SubmitBidDto,
    file?: Express.Multer.File,
  ): Promise<BidDocument> {
    const tender = await this.tenderModel.findById(dto.appelOffreId);
    if (!tender) {
      throw new NotFoundException('Appel d\'offres introuvable');
    }
    if (tender.statut !== TenderStatus.OUVERT) {
      throw new BadRequestException(
        'Cet appel d\'offres n\'accepte plus de soumissions',
      );
    }
    if (new Date() > new Date(tender.dateLimite)) {
      throw new BadRequestException(
        'La date limite de soumission est dépassée',
      );
    }
    if (tender.lanceurId.toString() === userId) {
      throw new BadRequestException(
        'Vous ne pouvez pas soumissionner à votre propre appel d\'offres',
      );
    }

    const existingBid = await this.bidModel.findOne({
      appelOffreId: new Types.ObjectId(dto.appelOffreId),
      soumissionnaireId: new Types.ObjectId(userId),
    });
    if (existingBid) {
      throw new BadRequestException('Vous avez déjà soumis une offre pour cet appel d\'offres');
    }

    let documentPieces = '';
    if (file) {
      documentPieces = await this.uploadService.saveFile(file, 'bids');
    }

    const prixTotal = dto.quantite * dto.prixUnitaire;

    const bid = await this.bidModel.create({
      appelOffreId: new Types.ObjectId(dto.appelOffreId),
      soumissionnaireId: new Types.ObjectId(userId),
      prixUnitaire: dto.prixUnitaire,
      prixTotal,
      quantite: dto.quantite,
      delaiLivraison: dto.delaiLivraison || '',
      observations: dto.observations || '',
      documentPieces,
      statut: BidStatus.EN_ATTENTE,
    });

    // Notification au lanceur
    const fullTender = await this.tenderModel
      .findById(dto.appelOffreId)
      .populate('lanceurId', 'userEmail userNickName')
      .exec();

    const bidder = await (bid as any)
      .populate('soumissionnaireId', 'userNickName')
      .execPopulate?.() || await this.bidModel.findById(bid._id).populate('soumissionnaireId', 'userNickName');

    if (fullTender && fullTender.lanceurId && bidder) {
      const lanceur: any = fullTender.lanceurId;
      const bidderInfo: any = bidder.soumissionnaireId;
      
      this.mailService.sendTenderBidNotification(
        lanceur.userEmail,
        fullTender.titre,
        bidderInfo.userNickName || 'Un membre',
        prixTotal,
        `${process.env.FRONT_URL}/tenders/${fullTender._id}`,
      ).catch(err => console.error('Erreur envoi mail soumission:', err));
    }

    return bid;
  }

  async updateBid(
    userId: string,
    bidId: string,
    dto: UpdateBidDto,
    file?: Express.Multer.File,
  ): Promise<BidDocument> {
    const bid = await this.bidModel.findById(bidId);
    if (!bid) throw new NotFoundException('Soumission introuvable');
    if (bid.soumissionnaireId.toString() !== userId) {
      throw new BadRequestException('Seul le soumissionnaire peut modifier cette offre');
    }

    const tender = await this.tenderModel.findById(bid.appelOffreId);
    if (!tender) throw new NotFoundException('Appel d\'offres introuvable');
    if (tender.statut !== TenderStatus.OUVERT) {
      throw new BadRequestException('L\'appel d\'offres n\'est plus ouvert aux modifications');
    }
    if (new Date() > new Date(tender.dateLimite)) {
      throw new BadRequestException('La date limite est dépassée');
    }

    const updateData: any = { ...dto };
    if (file) {
      updateData.documentPieces = await this.uploadService.saveFile(file, 'bids');
    }
    if (dto.prixUnitaire || dto.quantite) {
      const pu = dto.prixUnitaire || bid.prixUnitaire;
      const q = dto.quantite || bid.quantite;
      updateData.prixTotal = pu * q;
    }

    const updatedBid = await this.bidModel.findByIdAndUpdate(bidId, updateData, { new: true }).exec();
    if (!updatedBid) throw new NotFoundException('Soumission introuvable');
    return updatedBid;
  }

  async withdrawBid(userId: string, bidId: string): Promise<void> {
    const bid = await this.bidModel.findById(bidId);
    if (!bid) throw new NotFoundException('Soumission introuvable');
    if (bid.soumissionnaireId.toString() !== userId) {
      throw new BadRequestException('Seul le soumissionnaire peut retirer cette offre');
    }

    const tender = await this.tenderModel.findById(bid.appelOffreId);
    if (!tender) throw new NotFoundException('Appel d\'offres introuvable');
    if (tender.statut !== TenderStatus.OUVERT) {
      throw new BadRequestException('L\'appel d\'offres n\'est plus ouvert');
    }

    await this.bidModel.findByIdAndDelete(bidId);
  }

  async getBidsForTender(
    tenderId: string,
    userId: string,
  ): Promise<BidDocument[]> {
    const tender = await this.tenderModel.findById(tenderId);
    if (!tender) {
      throw new NotFoundException('Appel d\'offres introuvable');
    }

    const bids = await this.bidModel
      .find({ appelOffreId: new Types.ObjectId(tenderId) })
      .populate('soumissionnaireId', 'userNickName userName raisonSocial userEmail userPhone')
      .populate('productId', 'productName codeCPC productImage')
      .sort({ prixTotal: 1 })
      .exec();

    return bids;
  }

  async getMyBids(
    userId: string,
    page = 1,
    limit = 20,
    search?: string,
  ): Promise<PaginationResult<BidDocument>> {
    const filter: any = { soumissionnaireId: new Types.ObjectId(userId) };
    const skip = (page - 1) * limit;

    if (search) {
      // Rechercher les appels d'offres correspondants pour filtrer par titre/description
      const matchingTenders = await this.tenderModel
        .find({
          $or: [
            { titre: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } },
          ],
        })
        .select('_id')
        .exec();

      const tenderIds = matchingTenders.map((t) => t._id);

      filter.$or = [
        { observations: { $regex: search, $options: 'i' } },
        { appelOffreId: { $in: tenderIds } },
      ];
    }

    const [data, total] = await Promise.all([
      this.bidModel
        .find(filter)
        .populate('appelOffreId', 'titre description dateLimite statut')
        .populate('soumissionnaireId', 'userNickName userName raisonSocial')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.bidModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Mes soumissions récupérées',
      data: data as any,
      total,
      page,
      limit,
    };
  }

  // ===================== DEPOUILLEMENT & ATTRIBUTION =====================

  async ouvrirDepouillement(userId: string, tenderId: string): Promise<TenderDocument> {
    const tender = await this.tenderModel.findById(tenderId);
    if (!tender) {
      throw new NotFoundException('Appel d\'offres introuvable');
    }
    if (tender.lanceurId.toString() !== userId) {
      throw new BadRequestException(
        'Seul le lanceur peut ouvrir le dépouillement',
      );
    }
    if (tender.statut !== TenderStatus.OUVERT) {
      throw new BadRequestException(
        'Le dépouillement ne peut être ouvert que pour un appel d\'offres en cours',
      );
    }

    tender.statut = TenderStatus.DEPOUILLE;
    tender.dateDepouillement = new Date();
    return tender.save();
  }

  async award(
    userId: string,
    tenderId: string,
    dto: AwardTenderDto,
  ): Promise<TenderDocument> {
    const tender = await this.tenderModel.findById(tenderId);
    if (!tender) {
      throw new NotFoundException('Appel d\'offres introuvable');
    }
    if (tender.lanceurId.toString() !== userId) {
      throw new BadRequestException(
        'Seul le lanceur peut attribuer le marché',
      );
    }
    if (tender.statut !== TenderStatus.DEPOUILLE) {
      throw new BadRequestException(
        'Le dépouillement doit être effectué avant l\'attribution',
      );
    }

    const bid = await this.bidModel.findById(dto.soumissionId);
    if (!bid) {
      throw new NotFoundException('Soumission introuvable');
    }
    if (bid.appelOffreId.toString() !== tenderId) {
      throw new BadRequestException(
        'Cette soumission ne correspond pas à cet appel d\'offres',
      );
    }

    const previousWinner = await this.bidModel.findOne({
      appelOffreId: new Types.ObjectId(tenderId),
      estAttribue: true,
    });
    if (previousWinner) {
      previousWinner.estAttribue = false;
      previousWinner.statut = BidStatus.REJETEE;
      await previousWinner.save();
    }

    bid.estAttribue = true;
    bid.statut = BidStatus.RETENUE;
    await bid.save();

    await this.bidModel.updateMany(
      {
        appelOffreId: new Types.ObjectId(tenderId),
        _id: { $ne: bid._id },
      },
      { statut: BidStatus.REJETEE },
    );

    tender.soumissionRetenue = bid._id;
    tender.commentaireAttribution = dto.commentaire || '';
    tender.statut = TenderStatus.ATTRIBUE;
    const savedTender = await tender.save();

    // Notifications
    try {
      // 1. Notifier le gagnant
      const winner = await (bid as any)
        .populate('soumissionnaireId', 'userEmail userNickName')
        .execPopulate?.() || await this.bidModel.findById(bid._id).populate('soumissionnaireId', 'userEmail userNickName');
      
      const winnerInfo: any = winner.soumissionnaireId;
      if (winnerInfo?.userEmail) {
        this.mailService.sendTenderAwardNotification(
          winnerInfo.userEmail,
          winnerInfo.userNickName,
          tender.titre,
          bid.quantite,
          tender.unite,
          bid.prixUnitaire,
          bid.prixTotal,
          `${process.env.FRONT_URL}/my-bids`,
        ).catch(e => console.error('Mail winner error:', e));
      }

      // 2. Notifier les perdants
      const losers = await this.bidModel
        .find({
          appelOffreId: new Types.ObjectId(tenderId),
          _id: { $ne: bid._id },
        })
        .populate('soumissionnaireId', 'userEmail userNickName')
        .exec();

      for (const loser of losers) {
        const loserInfo: any = loser.soumissionnaireId;
        if (loserInfo?.userEmail) {
          this.mailService.sendTenderRejectionNotification(
            loserInfo.userEmail,
            loserInfo.userNickName,
            tender.titre,
          ).catch(e => console.error('Mail loser error:', e));
        }
      }
    } catch (error) {
      console.error('Erreur notifications attribution:', error);
    }

    return savedTender;
  }
}
