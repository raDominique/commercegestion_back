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
    summary: 'Lancer un nouvel appel d\'offres',
    description: `Permet à un membre de lancer un appel d'offres pour l'acquisition d'un produit spécifique. 
L'appel d'offres sera visible par tous les membres de la plateforme qui pourront soumettre leurs offres jusqu'à la date limite de soumission.`,
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['productId', 'titre', 'description', 'quantite', 'dateLimite'],
      properties: {
        productId: { type: 'string', example: '64b8f0c2e1d3f2a5c6b7d8e9', description: 'ID technique du produit recherché' },
        titre: { type: 'string', example: "Fourniture de 100 tonnes de Maïs jaune", description: "Titre explicite de l'appel d'offres" },
        description: { type: 'string', example: 'Nous recherchons un fournisseur pour 100 tonnes de maïs jaune de qualité supérieure...', description: 'Cahier des charges ou description détaillée du besoin' },
        quantite: { type: 'number', example: 100, description: 'Quantité totale souhaitée' },
        unite: { type: 'string', example: 'tonnes', description: "Unité de mesure (kg, tonnes, pièces, etc.)" },
        dateLimite: { type: 'string', example: '2023-12-31T23:59:59Z', format: 'date-time', description: 'Date et heure limite pour la réception des offres (Format ISO 8601)' },
        siteLivraison: { type: 'string', example: '64b8f0c2e1d3f2a5c6b7d8e9', description: 'ID du site géographique de livraison' },
        conditionsPaiement: { type: 'string', example: 'Paiement à la livraison après contrôle qualité', description: 'Modalités de règlement souhaitées' },
        delaiLivraisonSouhaite: { type: 'string', example: 'Maximum 15 jours après commande', description: 'Délai maximal de livraison acceptable' },
        documentPieces: {
          type: 'string',
          format: 'binary',
          description: 'Document TDR ou pièces jointes complémentaires (PDF, images, etc.)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'L\'appel d\'offres a été créé avec succès' })
  async create(
    @Req() req: any,
    @Body() dto: CreateTenderDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    const tender = await this.tenderService.create(userId, dto, file);
    return { status: 'success', message: 'Appel d\'offres créé avec succès', data: [tender] };
  }

  @Get('tenders')
  @Auth()
  @ApiOperation({
    summary: 'Consulter la liste des appels d\'offres',
    description: 'Récupère la liste de tous les appels d\'offres publics. Possibilité de filtrer par statut (OUVERT, ATTRIBUE, etc.) et de rechercher par mots-clés.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1, description: 'Numéro de la page' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20, description: 'Nombre d\'éléments par page' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Recherche par titre ou description' })
  @ApiQuery({ name: 'statut', required: false, enum: TenderStatus, description: 'Filtrer par état de l\'appel d\'offres' })
  @ApiQuery({ name: 'sortBy', required: false, type: String, example: 'createdAt', description: 'Champ de tri' })
  @ApiQuery({ name: 'order', required: false, enum: ['asc', 'desc'], example: 'desc', description: 'Sens du tri' })
  @ApiResponse({ status: 200, description: 'Liste des appels d\'offres récupérée avec succès' })
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
    summary: 'Lister mes propres appels d\'offres',
    description: 'Récupère uniquement les appels d\'offres que vous avez personnellement lancés.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Liste de vos appels d\'offres' })
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
    summary: 'Obtenir les détails d\'un appel d\'offres',
    description: 'Récupère toutes les informations détaillées d\'un appel d\'offres spécifique via son ID.',
  })
  @ApiParam({ name: 'id', description: 'Identifiant unique de l\'appel d\'offres' })
  @ApiResponse({ status: 200, description: 'Informations détaillées de l\'appel d\'offres' })
  @ApiResponse({ status: 404, description: 'Appel d\'offres introuvable' })
  async findById(@Param('id') id: string) {
    if (!id) throw new BadRequestException('ID requis');
    const tender = await this.tenderService.findById(id);
    return { status: 'success', data: [tender] };
  }

  @Delete('tenders/:id')
  @Auth()
  @ApiOperation({
    summary: 'Annuler un appel d\'offres',
    description: 'Permet au lanceur d\'annuler un appel d\'offres. Cette action n\'est possible que si l\'appel d\'offres est encore au statut OUVERT.',
  })
  @ApiParam({ name: 'id', description: 'ID de l\'appel d\'offres à annuler' })
  @ApiResponse({ status: 200, description: 'L\'appel d\'offres a été annulé avec succès' })
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
    summary: 'Soumettre une offre (Bid)',
    description: `Permet à un membre de soumissionner à un appel d'offres. 
Note : Un lanceur ne peut pas soumissionner à son propre appel d'offres. L'offre doit être soumise avant la date limite.`,
  })
  @ApiParam({ name: 'tenderId', description: 'ID de l\'appel d\'offres concerné' })
  @ApiBody({ type: SubmitBidDto })
  @ApiResponse({ status: 201, description: 'Votre offre a été soumise avec succès' })
  async submitBid(
    @Req() req: any,
    @Param('tenderId') tenderId: string,
    @Body() dto: SubmitBidDto,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    dto.appelOffreId = tenderId;
    const bid = await this.tenderService.submitBid(userId, dto);
    return { status: 'success', message: 'Soumission envoyée avec succès', data: [bid] };
  }

  @Get('tenders/:tenderId/bids')
  @Auth()
  @ApiOperation({
    summary: 'Consulter les offres reçues pour un appel d\'offres',
    description: 'Liste toutes les soumissions effectuées pour un appel d\'offres donné. Les offres sont triées par prix (du moins cher au plus cher).',
  })
  @ApiParam({ name: 'tenderId', description: 'ID de l\'appel d\'offres' })
  @ApiResponse({ status: 200, description: 'Liste des soumissions récupérée' })
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
    summary: 'Lister mes propres soumissions',
    description: 'Récupère la liste de toutes les offres (bids) que vous avez soumises sur différents appels d\'offres.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Liste de vos soumissions' })
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
    description: `Une fois la date limite dépassée, le lanceur déclenche l'ouverture du dépouillement. 
C'est à cette étape que les soumissions deviennent officiellement visibles pour le lanceur pour analyse.`,
  })
  @ApiParam({ name: 'tenderId', description: 'ID de l\'appel d\'offres' })
  @ApiResponse({ status: 200, description: 'Dépouillement ouvert avec succès' })
  async openSealed(@Req() req: any, @Param('tenderId') tenderId: string) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    const tender = await this.tenderService.ouvrirDepouillement(userId, tenderId);
    return { status: 'success', message: 'Dépouillement ouvert avec succès', data: [tender] };
  }

  @Patch('tenders/:tenderId/award')
  @Auth()
  @ApiOperation({
    summary: 'Valider et Attribuer le marché (Gagnant)',
    description: `Étape finale de l'appel d'offres : le lanceur sélectionne l'offre retenue (gagnante). 
L'attribution du marché entraîne automatiquement le rejet de toutes les autres soumissions non retenues.`,
  })
  @ApiParam({ name: 'tenderId', description: 'ID de l\'appel d\'offres' })
  @ApiBody({ type: AwardTenderDto })
  @ApiResponse({ status: 200, description: 'Le marché a été attribué avec succès' })
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
