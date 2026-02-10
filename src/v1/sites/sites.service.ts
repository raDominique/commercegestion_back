import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Site, SiteDocument } from './sites.schema';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, EntityType } from '../audit/audit-log.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';

@Injectable()
export class SiteService {
  constructor(
    @InjectModel(Site.name)
    private readonly siteModel: Model<SiteDocument>,
    private readonly userService: UsersService,
    private readonly auditService: AuditService,
  ) {}

  /* ===================== CREATE ===================== */
  async create(
    dto: CreateSiteDto,
    userId: string,
  ): Promise<PaginationResult<Site>> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID utilisateur invalide');
    }

    const userExists = await this.userService.existsById(userId);
    if (!userExists) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    const siteData = {
      ...dto,
      siteUserID: userId,
      location: { type: 'Point', coordinates: [dto.siteLng, dto.siteLat] },
    };

    const site = new this.siteModel(siteData);
    await site.save();

    // 🔹 Audit log
    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: EntityType.SITE,
      entityId: site._id.toString(),
      userId,
      newState: site.toObject(),
    });

    return {
      status: 'success',
      message: 'Site créé avec succès',
      data: [site],
    };
  }

  /* ===================== FIND ALL ===================== */
  async findAll(
    page: number,
    limit: number,
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
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID invalide');

    const site = await this.siteModel
      .findById(id)
      .populate('siteUserID')
      .exec();
    if (!site) throw new NotFoundException('Site non trouvé');

    return site;
  }

  /* ===================== UPDATE ===================== */
  async update(
    id: string,
    dto: UpdateSiteDto,
    userId: string,
  ): Promise<PaginationResult<Site>> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID invalide');

    const oldSite = await this.siteModel.findById(id).exec();
    if (!oldSite) throw new NotFoundException('Site non trouvé');

    const updateData: any = { ...dto };
    if (dto.siteLat !== undefined && dto.siteLng !== undefined) {
      updateData.location = {
        type: 'Point',
        coordinates: [dto.siteLng, dto.siteLat],
      };
    }

    const updatedSite = await this.siteModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .exec();

    if (!updatedSite) {
      throw new NotFoundException('Site non trouvé');
    }

    // 🔹 Audit log
    await this.auditService.log({
      action: AuditAction.UPDATE,
      entityType: EntityType.SITE,
      entityId: id,
      userId,
      previousState: oldSite.toObject(),
      newState: updatedSite.toObject(),
    });

    return {
      status: 'success',
      message: 'Site mis à jour avec succès',
      data: [updatedSite],
    };
  }

  /* ===================== DELETE ===================== */
  async remove(id: string, userId: string): Promise<PaginationResult<null>> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestException('ID invalide');

    const site = await this.siteModel.findByIdAndDelete(id).exec();
    if (!site) throw new NotFoundException('Site non trouvé');

    // 🔹 Audit log
    await this.auditService.log({
      action: AuditAction.DELETE,
      entityType: EntityType.SITE,
      entityId: id,
      userId,
      previousState: site.toObject(),
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
    page: number,
    limit: number,
    search = '',
  ): Promise<PaginationResult<Site>> {
    const query: any = { siteUserID: userId };
    if (search) query.siteName = { $regex: search, $options: 'i' };

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

    const total = await this.siteModel.countDocuments({
      location: {
        $nearSphere: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: radiusInMeters,
        },
      },
    });

    const sites = await this.siteModel
      .find({
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: radiusInMeters,
          },
        },
      })
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
}
