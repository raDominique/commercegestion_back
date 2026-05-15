import {
  Injectable,
  NotFoundException,
  BadRequestException,
  forwardRef,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Site, SiteDocument } from './sites.schema';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

import { AuditAction, EntityType } from '../audit/audit-log.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';
import { NotifyHelper } from 'src/shared/helpers/notify.helper';
import { UsersService } from 'src/v1/users/users.service';
import { ExportService } from '../../shared/export/export.service';

@Injectable()
export class SiteService {
  constructor(
    @InjectModel(Site.name)
    private readonly siteModel: Model<SiteDocument>,

    @Inject(forwardRef(() => UsersService))
    private readonly userService: UsersService,

    private readonly notifyHelper: NotifyHelper,
    private readonly exportService: ExportService,
  ) {}

  /* ===================== CREATE ===================== */
  async create(
    dto: CreateSiteDto,
    userId: string,
    isInscription = false,
  ): Promise<PaginationResult<Site>> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID utilisateur invalide');
    }

    const user = await this.userService.getById(userId);
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const site = await this.siteModel.create({
      ...dto,
      siteUserID: userId,
      location: {
        type: 'Point',
        coordinates: [dto.siteLng, dto.siteLat],
      },
    });

    if (isInscription === false) {
      // 🔔 Audit + Notification (via Helper)
      await this.notifyHelper.notify({
        action: AuditAction.CREATE,
        entityType: EntityType.SITE,
        entityId: site._id.toString(),
        userId,
        newState: site.toObject(),
        emailData: {
          type: 'CREATE',
          siteName: site.siteName,
        },
      });
    }

    return {
      status: 'success',
      message: 'Site créé avec succès',
      data: [site],
    };
  }

  /* ===================== FIND ALL ===================== */
  async findAll(
    page = 1,
    limit = 10,
    search = '',
  ): Promise<PaginationResult<Site>> {
    const query = search ? { siteName: { $regex: search, $options: 'i' } } : {};

    const total = await this.siteModel.countDocuments(query);
    const sites = await this.siteModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('siteUserID')
      .exec();

    return {
      status: 'success',
      message: 'Liste des sites récupérée',
      data: sites,
      page,
      limit,
      total,
      search,
    };
  }

  /* ===================== FIND ONE ===================== */
  async findOne(id: string): Promise<Site> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID invalide');
    }

    const site = await this.siteModel
      .findById(id)
      .populate('siteUserID')
      .exec();

    if (!site) {
      throw new NotFoundException('Site non trouvé');
    }

    return site;
  }

  /* ===================== UPDATE ===================== */
  async update(
    id: string,
    dto: UpdateSiteDto,
    userId: string,
  ): Promise<PaginationResult<Site>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID du site invalide');
    }

    const oldSite = await this.siteModel.findById(id).exec();
    if (!oldSite) {
      throw new NotFoundException('Site non trouvé');
    }

    const updateData: any = { ...dto };

    if (dto.siteLat !== undefined && dto.siteLng !== undefined) {
      updateData.location = {
        type: 'Point',
        coordinates: [dto.siteLng, dto.siteLat],
      };
    }

    const updatedSite = await this.siteModel
      .findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      })
      .exec();

    if (!updatedSite) {
      throw new NotFoundException('Site non trouvé');
    }

    // 🔔 Audit + Notification
    await this.notifyHelper.notify({
      action: AuditAction.UPDATE,
      entityType: EntityType.SITE,
      entityId: id,
      userId,
      previousState: oldSite.toObject(),
      newState: updatedSite.toObject(),
      emailData: {
        type: 'UPDATE',
        siteName: updatedSite.siteName,
      },
    });

    return {
      status: 'success',
      message: 'Site mis à jour avec succès',
      data: [updatedSite],
    };
  }

  /* ===================== DELETE ===================== */
  async remove(id: string, userId: string): Promise<PaginationResult<null>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID invalide');
    }

    const site = await this.siteModel.findByIdAndDelete(id).exec();
    if (!site) {
      throw new NotFoundException('Site non trouvé');
    }

    // 🔔 Audit + Notification
    await this.notifyHelper.notify({
      action: AuditAction.DELETE,
      entityType: EntityType.SITE,
      entityId: id,
      userId,
      previousState: site.toObject(),
      emailData: {
        type: 'DELETE',
        siteName: site.siteName,
      },
    });

    return {
      status: 'success',
      message: 'Site supprimé avec succès',
      data: null,
    };
  }

  /* ===================== FIND ALL BY USER ===================== */
  async findAllByUser(
    userId: string,
    page = 1,
    limit = 10,
    search = '',
  ): Promise<PaginationResult<Site>> {
    const query: any = { siteUserID: userId };
    if (search) {
      query.siteName = { $regex: search, $options: 'i' };
    }

    const total = await this.siteModel.countDocuments(query);
    const sites = await this.siteModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      status: 'success',
      message: 'Liste des sites récupérée',
      data: sites,
      page,
      limit,
      total,
      search,
    };
  }

  /* ===================== FIND BY LOCATION ===================== */
  async findByLocation(
    lat: number,
    lng: number,
    radiusKm = 5,
    page = 1,
    limit = 10,
  ): Promise<PaginationResult<Site>> {
    const radiusInMeters = radiusKm * 1000;

    const geoQuery = {
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusInMeters,
        },
      },
    };

    const total = await this.siteModel.countDocuments(geoQuery);
    const sites = await this.siteModel
      .find(geoQuery)
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      status: 'success',
      message: 'Sites proches récupérés',
      data: sites,
      page,
      limit,
      total,
    };
  }

  /**
   * recuperer la liste site avec Nom du site et leur propriétaire (user)
   */
  async findAllSelect(): Promise<PaginationResult<any>> {
    const sites = await this.siteModel
      .find({}, { siteName: 1, siteUserID: 1 })
      .populate('siteUserID', 'userNickName userName')
      .exec();

    const formattedData = sites
      .filter((site) => site.siteUserID !== null)
      .map((site) => ({
        _id: site._id,
        siteName: site.siteName,
        siteUserID: (site.siteUserID as any)?._id,
        userNickName:
          (site.siteUserID as any)?.userNickName +
          ' ' +
          (site.siteUserID as any)?.userName,
      }));

    return {
      status: 'success',
      message: 'Liste des sites récupérée',
      data: formattedData,
    };
  }

  /**
   * Récupère tous les sites d'un utilisateur donné avec gestion des erreurs
   */
  async getAllSitesByUserId(userId: string): Promise<any> {
    // 1. Validation de base (optionnel si géré par un Pipe)
    if (!userId) {
      throw new BadRequestException("L'ID de l'utilisateur est requis");
    }

    try {
      const sites = await this.siteModel
        .find({ siteUserID: userId })
        .select('siteName siteAddress _id')
        .lean() // Utilisation de .lean() pour de meilleures performances (retourne du JSON pur)
        .exec();

      // 2. Cas où aucun site n'est trouvé (dépend de votre logique métier)
      if (!sites || sites.length === 0) {
        return {
          status: 'success',
          message: 'Aucun site trouvé pour cet utilisateur',
          data: [],
        };
      }

      return {
        status: 'success',
        message: "Sites de l'utilisateur récupérés avec succès",
        data: sites,
      };
    } catch (error: any) {
      // 3. Gestion des erreurs de format d'ID Mongoose (CastError)
      if (error.name === 'CastError') {
        throw new BadRequestException(
          `Format de l'ID utilisateur invalide : ${userId}`,
        );
      }

      // 4. Erreur générique (Problème de connexion DB, etc.)
      throw new InternalServerErrorException(
        'Une erreur est survenue lors de la récupération des sites',
      );
    }
  }

  async exportAll(format: 'excel' | 'pdf', userId?: string): Promise<string> {
    const items = await this.siteModel.find().sort({ createdAt: -1 }).lean().exec();

    if (!items.length) {
      throw new NotFoundException('Aucune donnée à exporter');
    }

    const subfolder = 'sites-export';
    const columns = [
      { header: 'ID', key: '_id' },
      { header: 'Nom', key: 'siteName' },
      { header: 'Adresse', key: 'siteAddress' },
      { header: 'Créé le', key: 'createdAt' },
    ];

    if (format === 'excel') {
      return this.exportService.exportExcel(items, columns, 'Sites', subfolder);
    }
    return this.exportService.exportPDF(
      'Liste des Sites',
      columns.map(c => c.header),
      items.map(item => columns.map(c => item[c.key] ?? '')),
      subfolder,
    );
  }
}
