import { Controller, Post, Body, Req, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Auth } from '../auth';
import { CreateMovementDto } from './dto/create-movement.dto';
import { MovementType } from './stock-movement.schema';
import { StockService } from './stock.service';
import { ActifsService } from '../actifs/actifs.service';
import { PassifsService } from '../passifs/passifs.service';

@ApiTags('Stocks & Mouvements')
@Controller()
export class StockController {
  constructor(
    private readonly stockService: StockService,
    private readonly actifsService: ActifsService,
    private readonly passifsService: PassifsService,
  ) {}

  // ==========================================
  // ÉTAPES DE MOUVEMENTS (FLUX 0 À 12)
  // ==========================================

  @Post('deposit')
  @Auth()
  @ApiOperation({
    summary: 'Étape 0 : Déposer un produit (Initialisation Actif/Passif)',
  })
  async deposit(@Body() dto: CreateMovementDto, @Req() req: any) {
    return this.stockService.createMovement(
      dto,
      req.user.userId,
      MovementType.DEPOT,
    );
  }

  @Post('withdraw')
  @Auth()
  @ApiOperation({ summary: 'Retirer un produit (Sortie de stock physique)' })
  async withdraw(@Body() dto: CreateMovementDto, @Req() req: any) {
    return this.stockService.createMovement(
      dto,
      req.user.userId,
      MovementType.RETRAIT,
    );
  }

  @Post('transfer')
  @Auth()
  @ApiOperation({
    summary:
      'Étape 10 : Transférer physiquement un produit (Changement de détenteur)',
  })
  async transfer(@Body() dto: CreateMovementDto, @Req() req: any) {
    return this.stockService.createMovement(
      dto,
      req.user.userId,
      MovementType.TRANSFERT,
    );
  }

  @Post('virement')
  @Auth()
  @ApiOperation({
    summary:
      'Étape 4c : Virement de propriété (Changement d’Ayant-droit sans mouvement physique)',
  })
  async virement(@Body() dto: CreateMovementDto, @Req() req: any) {
    return this.stockService.createMovement(
      dto,
      req.user.userId,
      MovementType.VIREMENT,
    );
  }

  // ==========================================
  // RÉCUPÉRATION DES ACTIFS (CE QUE JE POSSÈDE)
  // ==========================================

  @Get('my-actifs')
  @Auth()
  @ApiOperation({ summary: 'Liste globale de mes actifs (Bilan de propriété)' })
  async getMyAssets(@Req() req: any, @Query() query: any) {
    return this.stockService.getMyAssets(req.user.userId, query);
  }

  @Get('actif/:id')
  @Auth()
  @ApiOperation({
    summary: 'Détails d’un actif spécifique (Populate Ayant-droit/Détenteur)',
  })
  async getActifDetails(@Param('id') id: string) {
    return this.actifsService.getActifDetails(id);
  }

  @Get('site-actifs/:siteId')
  @Auth()
  @ApiOperation({ summary: 'Voir les actifs stockés sur un site spécifique' })
  async getSiteActifs(@Req() req: any, @Param('siteId') siteId: string) {
    return this.stockService.getSiteActifs(req.user.userId, siteId);
  }

  // ==========================================
  // RÉCUPÉRATION DES PASSIFS (CE QUE JE DOIS)
  // ==========================================

  @Get('my-passifs')
  @Auth()
  @ApiOperation({
    summary: 'Liste de mes passifs (Dettes de marchandises envers des tiers)',
  })
  async getMyPassifs(@Req() req: any, @Query() query: any) {
    return this.stockService.getMyPassifs(req.user.userId, query);
  }

  @Get('passif/:id')
  @Auth()
  @ApiOperation({
    summary: 'Détails d’un passif spécifique (Populate Créancier)',
  })
  async getPassifDetails(@Param('id') id: string) {
    return this.passifsService.getPassifDetails(id);
  }

  @Get('site-passifs/:siteId')
  @Auth()
  @ApiOperation({
    summary: 'Voir les dettes de marchandises pour un site spécifique',
  })
  async getSitePassifs(@Req() req: any, @Param('siteId') siteId: string) {
    return this.stockService.getSitePassifs(req.user.userId, siteId);
  }

  // ==========================================
  // HISTORIQUE DES MOUVEMENTS
  // ==========================================

  @Get('history')
  @Auth()
  @ApiOperation({ summary: 'Journal complet des mouvements de l’utilisateur' })
  async getHistory(@Req() req: any) {
    return this.stockService.getHistory(req.user.userId);
  }

  // GET: /stock/deposits
  @Get('deposits')
  @Auth()
  @ApiOperation({ summary: 'Liste de tous les dépôts effectués (Entrées)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getDeposits(@Req() req: any, @Query() query: any) {
    return this.stockService.getDepositList(req.user.userId, query);
  }

  // GET: /stock/withdrawals
  @Get('withdrawals')
  @Auth()
  @ApiOperation({ summary: 'Liste de tous les retraits effectués (Sorties)' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getWithdrawals(@Req() req: any, @Query() query: any) {
    return this.stockService.getWithdrawList(req.user.userId, query);
  }
}
