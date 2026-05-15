import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

import { SiteService } from './sites.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { Site } from './sites.schema';
import { PaginationResult } from 'src/shared/interfaces/pagination.interface';
import { Auth } from '../auth';
import { LoggerService } from 'src/common/logger/logger.service';

@ApiTags('Sites')
@Controller()
export class SiteController {
  constructor(
    private readonly siteService: SiteService,
    private readonly loggerService: LoggerService,
  ) {}

  /* ===================== CREATE ===================== */
  @Post()
  @ApiOperation({ summary: 'Créer un site' })
  @ApiResponse({ status: 201, description: 'Site créé avec succès' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  @Auth()
  async create(
    @Req() req: any,
    @Body() createSiteDto: CreateSiteDto,
  ): Promise<PaginationResult<Site>> {
    const userId = req.user.userId;
    return this.siteService.create(createSiteDto, userId);
  }

  /* ===================== FIND ALL ===================== */
  @Get()
  @ApiOperation({ summary: 'Lister les sites avec pagination' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'Antananarivo' })
  @ApiResponse({ status: 200, description: 'Liste paginée des sites' })
  async findAll(
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Query('search') search = '',
  ): Promise<PaginationResult<Site>> {
    return this.siteService.findAll(page, limit, search);
  }

  /* ===================== FIND ONE ===================== */
  @Get('get-by-id/:id')
  @ApiOperation({ summary: 'Récupérer un site par ID' })
  @ApiParam({ name: 'id', description: 'ID du site (MongoDB)' })
  @ApiResponse({ status: 200, description: 'Site trouvé' })
  @ApiResponse({ status: 404, description: 'Site non trouvé' })
  async findOne(@Param('id') id: string): Promise<Site> {
    return this.siteService.findOne(id);
  }

  /* ===================== UPDATE ===================== */
  @Patch('update/:id')
  @ApiOperation({ summary: 'Mettre à jour un site' })
  @ApiParam({ name: 'id', description: 'ID du site' })
  @ApiResponse({ status: 200, description: 'Site mis à jour avec succès' })
  @ApiResponse({ status: 404, description: 'Site non trouvé' })
  @Auth()
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateSiteDto: UpdateSiteDto,
  ): Promise<PaginationResult<Site>> {
    const userId = req.user.userId;
    return this.siteService.update(id, updateSiteDto, userId);
  }

  /* ===================== DELETE ===================== */
  @Delete('delete/:id')
  @ApiOperation({ summary: 'Supprimer un site' })
  @ApiParam({ name: 'id', description: 'ID du site' })
  @ApiResponse({ status: 200, description: 'Site supprimé avec succès' })
  @Auth()
  async remove(
    @Req() req: any,
    @Param('id') id: string,
  ): Promise<PaginationResult<null>> {
    const userId = req.user.userId;
    return this.siteService.remove(id, userId);
  }

  /* ===================== FIND ALL BY USER ===================== */
  @Get('me')
  @ApiOperation({ summary: 'Lister mes sites' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'search', required: false, example: 'Antananarivo' })
  @ApiResponse({
    status: 200,
    description: 'Liste des sites de l’utilisateur connecté',
  })
  @Auth()
  async findMySites(
    @Req() req: any,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
    @Query('search') search = '',
  ): Promise<PaginationResult<Site>> {
    const userId = req.user.userId;
    this.loggerService.log(
      'DEBUG',
      `User ${userId} is fetching their sites with search: "${search}"`,
    );
    return this.siteService.findAllByUser(userId, page, limit, search);
  }

  /* ===================== FIND BY LOCATION ===================== */
  @Get('nearby')
  @ApiOperation({ summary: 'Rechercher les sites proches d’une localisation' })
  @ApiQuery({ name: 'lat', required: true, example: -18.8792 })
  @ApiQuery({ name: 'lng', required: true, example: 47.5079 })
  @ApiQuery({ name: 'radiusKm', required: false, example: 5 })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiResponse({ status: 200, description: 'Liste des sites proches' })
  async findByLocation(
    @Query('lat') lat: number,
    @Query('lng') lng: number,
    @Query('radiusKm') radiusKm = 5,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ): Promise<PaginationResult<Site>> {
    return this.siteService.findByLocation(lat, lng, radiusKm, page, limit);
  }

  @Get('select/all')
  @ApiOperation({ summary: 'Récupérer tous les sites (sans pagination)' })
  @ApiResponse({ status: 200, description: 'Liste de tous les sites' })
  async findAllSelect() {
    const sites = await this.siteService.findAllSelect();
    return sites;
  }

  /* ===================== FIND ALL BY USER ID ===================== */
  @Get('by-user/:userId')
  @ApiOperation({ summary: 'Récupérer tous les sites d\'un utilisateur' })
  @ApiParam({ name: 'userId', description: 'ID de l\'utilisateur' })
  @ApiResponse({
    status: 200,
    description: 'Liste des sites de l\'utilisateur',
    schema: {
      example: {
        status: 'success',
        message: 'Sites de l\'utilisateur récupérés',
        data: [
          {
            _id: '507f1f77bcf86cd799439100',
            siteName: 'Dépôt Principal',
            siteAddress: 'Rue de la Paix, Antananarivo',
          },
          {
            _id: '507f1f77bcf86cd799439101',
            siteName: 'Hangar Secondaire',
            siteAddress: 'Rue du Commerce, Antsirabe',
          },
        ],
      },
    },
  })
  @ApiResponse({ status: 400, description: 'ID utilisateur invalide' })
  @ApiResponse({ status: 404, description: 'Utilisateur non trouvé' })
  async getAllSitesByUserId(@Param('userId') userId: string) {
    return this.siteService.getAllSitesByUserId(userId);
  }

  @Get('export')
  @Auth()
  @ApiOperation({ summary: 'Exporter les données en Excel ou PDF' })
  @ApiQuery({ name: 'format', required: true, enum: ['excel', 'pdf'], description: "Format d'export: excel ou pdf" })
  @ApiResponse({ status: 200, description: 'URL du fichier généré' })
  async exportAll(
    @Query('format') format: 'excel' | 'pdf',
    @Req() req: any,
  ) {
    if (!format || !['excel', 'pdf'].includes(format)) {
      throw new BadRequestException('Format invalide. Utilisez "excel" ou "pdf".');
    }
    const userId = req.user?.userId || 'system';
    const fileUrl = await this.siteService.exportAll(format, userId);
    return { status: 'success', file: fileUrl };
  }
}
