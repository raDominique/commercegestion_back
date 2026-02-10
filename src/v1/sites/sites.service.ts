import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, Error as MongooseError } from 'mongoose';
import { Site, SiteDocument } from './sites.schema';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { UsersService } from '../users/users.service';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';
import { PipelineStage } from 'mongoose';

@Injectable()
export class SiteService {
  constructor(
    @InjectModel(Site.name)
    private readonly siteModel: Model<SiteDocument>,
    private readonly userService: UsersService,
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

    // Construire location explicitement
    const siteData = {
      ...dto,
      siteUserID: userId,
      location: {
        type: 'Point',
        coordinates: [dto.siteLng, dto.siteLat], // ⚠️ lng, lat
      },
    };

    const site = new this.siteModel(siteData);
    await site.save(); // maintenant la validation passera

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
    const skip = (page - 1) * limit;

    const filter = search
      ? { siteName: { $regex: search, $options: 'i' } }
      : {};

    const [data, total] = await Promise.all([
      this.siteModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .populate('siteUserID')
        .exec(),
      this.siteModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: 'Liste des sites',
      data,
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
    dto: UpdateSiteDto
  ): Promise<PaginationResult<Site>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID invalide');
    }

    const updateData: any = { ...dto };

    // Si lat/lng modifiés, mettre à jour location
    if (dto.siteLat !== undefined && dto.siteLng !== undefined) {
      updateData.location = {
        type: 'Point',
        coordinates: [dto.siteLng, dto.siteLat],
      };
    }

    const site = await this.siteModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!site) {
      throw new NotFoundException('Site non trouvé');
    }

    return {
      status: 'success',
      message: 'Site mis à jour avec succès',
      data: [site],
    };
  }

  /* ===================== DELETE ===================== */
  async remove(id: string, userId: string): Promise<PaginationResult<null>> {
    const userExists = await this.userService.existsById(userId);
    if (!userExists) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID invalide');
    }

    const result = await this.siteModel.findByIdAndDelete(id);

    if (!result) {
      throw new NotFoundException('Site non trouvé');
    }

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
    const userExists = await this.userService.existsById(userId);
    if (!userExists) {
      throw new NotFoundException(`Utilisateur introuvable: ${userId}`);
    }

    const skip = (page - 1) * limit;

    const filter: any = { siteUserID: userId };
    if (search) {
      filter.siteName = { $regex: search, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      this.siteModel
        .find(filter)
        .skip(skip)
        .limit(limit)
        .populate('siteUserID')
        .exec(),
      this.siteModel.countDocuments(filter),
    ]);

    return {
      status: 'success',
      message: "Liste des sites de l'utilisateur",
      data,
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
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new BadRequestException('Coordonnées GPS invalides');
    }

    try {
      const radiusMeters = radiusKm * 1000;
      const skip = (page - 1) * limit;

      const pipeline: PipelineStage[] = [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [lng, lat] },
            distanceField: 'distance',
            maxDistance: radiusMeters,
            spherical: true,
          },
        } as PipelineStage,
        { $skip: skip } as PipelineStage,
        { $limit: limit } as PipelineStage,
        {
          $lookup: {
            from: 'users',
            localField: 'siteUserID',
            foreignField: '_id',
            as: 'siteUserID',
          },
        } as PipelineStage,
        { $unwind: '$siteUserID' } as PipelineStage,
      ];

      const [data, totalCount] = await Promise.all([
        this.siteModel.aggregate(pipeline),
        this.siteModel.aggregate([
          {
            $geoNear: {
              near: { type: 'Point', coordinates: [lng, lat] },
              distanceField: 'distance',
              maxDistance: radiusMeters,
              spherical: true,
            },
          } as PipelineStage,
          { $count: 'count' } as PipelineStage,
        ]),
      ]);

      return {
        status: 'success',
        message: 'Sites trouvés par localisation',
        data,
        page,
        limit,
        total: totalCount[0]?.count ?? 0,
        filter: { latitude: lat, longitude: lng, radiusKm },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Erreur lors de la recherche par localisation',
      );
    }
  }
}
