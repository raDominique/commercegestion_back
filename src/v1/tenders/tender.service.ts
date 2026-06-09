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

  async findAll(
    page = 1,
    limit = 20,
    search?: string,
    statut?: TenderStatus,
    sortBy = 'createdAt',
    order: 'asc' | 'desc' = 'desc',
  ): Promise<PaginationResult<TenderDocument>> {
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

    return {
      status: 'success',
      message: 'Appels d\'offres récupérés',
      data: data as any,
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

  async findById(id: string): Promise<TenderDocument> {
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
    return tender;
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

    const prixTotal = dto.quantite * dto.prixUnitaire;

    return this.bidModel.create({
      appelOffreId: new Types.ObjectId(dto.appelOffreId),
      soumissionnaireId: new Types.ObjectId(userId),
      prixUnitaire: dto.prixUnitaire,
      prixTotal,
      quantite: dto.quantite,
      delaiLivraison: dto.delaiLivraison || '',
      observations: dto.observations || '',
      statut: BidStatus.EN_ATTENTE,
    });
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
  ): Promise<PaginationResult<BidDocument>> {
    const filter = { soumissionnaireId: new Types.ObjectId(userId) };
    const skip = (page - 1) * limit;

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
    tender.statut = TenderStatus.ATTRIBUE;
    return tender.save();
  }
}
