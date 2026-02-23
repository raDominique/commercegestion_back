import { Controller, Post, Body, Req, Get, Query, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
} from '@nestjs/swagger';
import { Auth } from '../auth';
import { CreateMovementDto } from './dto/create-movement.dto';
import { MovementType } from './stock-movement.schema';
import { StockService } from './stock.service';

@ApiTags('Stocks & Mouvements')
@ApiBearerAuth()
@Controller()
export class StockController {
  constructor(private readonly stockService: StockService) {}

  // POST: /stock/deposit -> Pour déposer un produit dans un site
  @Post('deposit')
  @Auth()
  @ApiOperation({ summary: 'Déposer un produit dans un site de destination' })
  async deposit(@Body() dto: CreateMovementDto, @Req() req: any) {
    return this.stockService.createMovement(
      dto,
      req.user.userId,
      MovementType.DEPOT,
    );
  }

  // POST: /stock/withdraw -> Pour retirer un produit d'un site
  @Post('withdraw')
  @Auth()
  @ApiOperation({ summary: "Retirer un produit d'un site (Opération inverse)" })
  async withdraw(@Body() dto: CreateMovementDto, @Req() req: any) {
    return this.stockService.createMovement(
      dto,
      req.user.userId,
      MovementType.RETRAIT,
    );
  }

  // GET: /stock/site-actifs -> Actifs pour un site spécifique de l'utilisateur
  @Get('site-actifs/:siteId')
  @Auth()
  @ApiOperation({ summary: 'Voir les actifs pour un site spécifique' })
  async getSiteActifs(@Req() req: any, @Param('siteId') siteId: string) {
    return this.stockService.getSiteActifs(req.user.userId, siteId);
  }

  // GET: /stock/site-passifs -> Passifs pour un site spécifique de l'utilisateur
  @Get('site-passifs/:siteId')
  @Auth()
  @ApiOperation({ summary: 'Voir les passifs pour un site spécifique' })
  async getSitePassifs(@Req() req: any, @Param('siteId') siteId: string) {
    return this.stockService.getSitePassifs(req.user.userId, siteId);
  }

  // GET: /stock/my-assets -> Liste des produits validés et stockés
  @Get('my-actifs')
  @Auth()
  @ApiOperation({ summary: 'Voir mes actifs (Produits validés et en stock)' })
  @ApiQuery({
    name: 'siteId',
    required: false,
    description: 'Filtrer par site (optionnel)',
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    description: 'Filtrer par produit (optionnel)',
  })
  @ApiQuery({
    name: 'movementType',
    required: false,
    enum: MovementType,
    description: 'Filtrer par type de mouvement (optionnel)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filtrer par date de début (optionnel)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filtrer par date de fin (optionnel)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Numéro de page pour la pagination (optionnel)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'éléments par page pour la pagination (optionnel)",
  })
  async getMyAssets(@Req() req: any, @Query() query: any) {
    // On peut utiliser le findAll du productService avec isStocker=true
    return this.stockService.getMyAssets(req.user.userId, query);
  }

  // GET: /stock/my-passifs -> Liste de tous les passifs de l'utilisateur
  @Get('my-passifs')
  @Auth()
  @ApiQuery({
    name: 'siteId',
    required: false,
    description: 'Filtrer par site (optionnel)',
  })
  @ApiQuery({
    name: 'productId',
    required: false,
    description: 'Filtrer par produit (optionnel)',
  })
  @ApiQuery({
    name: 'movementType',
    required: false,
    enum: MovementType,
    description: 'Filtrer par type de mouvement (optionnel)',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: 'Filtrer par date de début (optionnel)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: 'Filtrer par date de fin (optionnel)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Numéro de page pour la pagination (optionnel)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: "Nombre d'éléments par page pour la pagination (optionnel)",
  })
  @ApiOperation({ summary: 'Voir mes passifs (Produits retraitées)' })
  async getMyPassifs(@Req() req: any, @Query() query: any) {
    return this.stockService.getMyPassifs(req.user.userId, query);
  }
}
