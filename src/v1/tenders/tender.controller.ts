import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { TenderService } from './tender.service';
import { CreateTenderDto } from './dto/create-tender.dto';
import { SubmitBidDto } from './dto/submit-bid.dto';
import { AwardTenderDto } from './dto/award-tender.dto';
import { TenderStatus } from './tender.schema';
import { Auth } from '../auth';

@ApiTags('Appels d\'offres')
@Controller()
export class TenderController {
  constructor(private readonly tenderService: TenderService) {}

  // ===================== TENDERS =====================

  @Post('tenders')
  @Auth()
  @UseInterceptors(FileInterceptor('documentPieces'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Lancer un appel d\'offres',
    description: `Un membre lance un appel d'offres pour la fourniture d'un produit.
Tous les membres peuvent voir et soumissionner jusqu'à la date limite définie.`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['productId', 'titre', 'description', 'quantite', 'dateLimite'],
      properties: {
        productId: { type: 'string', example: '64b8f0c2e1d3f2a5c6b7d8e9', description: 'ID du produit concerné' },
        titre: { type: 'string', example: "Appel d'offres pour la livraison de produits", description: "Titre de l'appel d'offres" },
        description: { type: 'string', example: 'Description détaillée du besoin (incluant les TDR)', description: 'Description détaillée du besoin (incluant les TDR)' },
        quantite: { type: 'number', example: 100, description: 'Quantité totale recherchée' },
        unite: { type: 'string', example: 'kg', description: "Unité de mesure (kg, tonne, pièce...)" },
        dateLimite: { type: 'string', example: '2023-12-31T23:59:59Z', format: 'date-time', description: 'Date limite de soumission (ISO 8601)' },
        siteLivraison: { type: 'string', example: '64b8f0c2e1d3f2a5c6b7d8e9', description: 'ID du site de livraison' },
        conditionsPaiement: { type: 'string', example: 'Conditions de paiement', description: 'Conditions de paiement' },
        delaiLivraisonSouhaite: { type: 'string', example: 'Délai de livraison souhaité', description: 'Délai de livraison souhaité' },
        documentPieces: {
          type: 'string',
          format: 'binary',
          description: 'Pièces jointes / documents TDR (PDF, DOC, XLS...)',
          example: 'tdr_mais_export.pdf',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Appel d\'offres créé' })
  async create(
    @Req() req: any,
    @Body() dto: CreateTenderDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    const tender = await this.tenderService.create(userId, dto, file);
    return { status: 'success', message: 'Appel d\'offres créé', data: [tender] };
  }

  @Get('tenders')
  @Auth()
  @ApiOperation({
    summary: 'Lister les appels d\'offres',
    description: 'Liste paginée des appels d\'offres avec filtres par statut et recherche.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'statut', required: false, enum: TenderStatus })
  @ApiQuery({ name: 'sortBy', required: false, type: String, example: 'createdAt' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], example: 'desc' })
  @ApiResponse({ status: 200, description: 'Liste des appels d\'offres' })
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('statut') statut?: TenderStatus,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return this.tenderService.findAll(
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(limit) || 20)),
      search,
      statut,
      sortBy,
      order,
    );
  }

  @Get('tenders/mine')
  @Auth()
  @ApiOperation({
    summary: 'Mes appels d\'offres',
    description: 'Liste paginée de mes propres appels d\'offres.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Mes appels d\'offres' })
  async findMine(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    return this.tenderService.findMine(
      userId,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(limit) || 20)),
    );
  }

  @Get('tenders/:id')
  @Auth()
  @ApiOperation({
    summary: 'Détail d\'un appel d\'offres',
    description: 'Récupère les informations complètes d\'un appel d\'offres.',
  })
  @ApiParam({ name: 'id', description: 'ID de l\'appel d\'offres' })
  @ApiResponse({ status: 200, description: 'Appel d\'offres trouvé' })
  @ApiResponse({ status: 404, description: 'Introuvable' })
  async findById(@Param('id') id: string) {
    if (!id) throw new BadRequestException('ID requis');
    const tender = await this.tenderService.findById(id);
    return { status: 'success', data: [tender] };
  }

  @Delete('tenders/:id')
  @Auth()
  @ApiOperation({
    summary: 'Annuler un appel d\'offres',
    description: 'Seul le lanceur peut annuler son appel d\'offres et seulement s\'il est encore ouvert.',
  })
  @ApiParam({ name: 'id', description: 'ID de l\'appel d\'offres' })
  @ApiResponse({ status: 200, description: 'Appel d\'offres annulé' })
  async cancel(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    if (!id) throw new BadRequestException('ID requis');
    const tender = await this.tenderService.cancel(userId, id);
    return { status: 'success', message: 'Appel d\'offres annulé', data: [tender] };
  }

  // ===================== BIDS =====================

  @Post('tenders/:tenderId/bids')
  @Auth()
  @ApiOperation({
    summary: 'Soumissionner à un appel d\'offres',
    description: `Un membre soumet son offre pour un appel d'offres.
Le lanceur ne peut pas soumissionner à son propre appel d'offres.
La date limite doit être respectée.`,
  })
  @ApiParam({ name: 'tenderId', description: 'ID de l\'appel d\'offres' })
  @ApiBody({ type: SubmitBidDto })
  @ApiResponse({ status: 201, description: 'Soumission envoyée' })
  async submitBid(
    @Req() req: any,
    @Param('tenderId') tenderId: string,
    @Body() dto: SubmitBidDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    dto.appelOffreId = tenderId;
    const bid = await this.tenderService.submitBid(userId, dto);
    return { status: 'success', message: 'Soumission envoyée', data: [bid] };
  }

  @Get('tenders/:tenderId/bids')
  @Auth()
  @ApiOperation({
    summary: 'Voir les soumissions d\'un appel d\'offres',
    description: 'Liste toutes les soumissions pour un appel d\'offres, triées par prix croissant.',
  })
  @ApiParam({ name: 'tenderId', description: 'ID de l\'appel d\'offres' })
  @ApiResponse({ status: 200, description: 'Soumissions récupérées' })
  async getBids(@Req() req: any, @Param('tenderId') tenderId: string) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    if (!tenderId) throw new BadRequestException('ID requis');
    const bids = await this.tenderService.getBidsForTender(tenderId, userId);
    return { status: 'success', data: bids };
  }

  @Get('my-bids')
  @Auth()
  @ApiOperation({
    summary: 'Mes soumissions',
    description: 'Liste paginée de mes soumissions à des appels d\'offres.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Mes soumissions' })
  async getMyBids(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    return this.tenderService.getMyBids(
      userId,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(limit) || 20)),
    );
  }

  // ===================== DEPOUILLEMENT & ATTRIBUTION =====================

  @Patch('tenders/:tenderId/open-sealed')
  @Auth()
  @ApiOperation({
    summary: 'Ouvrir le dépouillement des offres',
    description: `Une fois la date limite dépassée, le lanceur ouvre le dépouillement.
Les soumissions deviennent alors visibles pour le lanceur.`,
  })
  @ApiParam({ name: 'tenderId', description: 'ID de l\'appel d\'offres' })
  @ApiResponse({ status: 200, description: 'Dépouillement ouvert' })
  async openSealed(@Req() req: any, @Param('tenderId') tenderId: string) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    const tender = await this.tenderService.ouvrirDepouillement(userId, tenderId);
    return { status: 'success', message: 'Dépouillement ouvert', data: [tender] };
  }

  @Patch('tenders/:tenderId/award')
  @Auth()
  @ApiOperation({
    summary: 'Attribuer le marché',
    description: `Le lanceur sélectionne la meilleure offre et attribue le marché.
Les autres soumissions sont automatiquement rejetées.`,
  })
  @ApiParam({ name: 'tenderId', description: 'ID de l\'appel d\'offres' })
  @ApiBody({ type: AwardTenderDto })
  @ApiResponse({ status: 200, description: 'Marché attribué' })
  async award(
    @Req() req: any,
    @Param('tenderId') tenderId: string,
    @Body() dto: AwardTenderDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    const tender = await this.tenderService.award(userId, tenderId, dto);
    return { status: 'success', message: 'Marché attribué avec succès', data: [tender] };
  }
}
