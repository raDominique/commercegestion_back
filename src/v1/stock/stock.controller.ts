import { Controller, Post, Body, Req, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
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
    dto.type = MovementType.DEPOT; // Force le type en dépôt
    return this.stockService.createMovement(dto, req.user.userId);
  }

  // POST: /stock/withdraw -> Pour retirer un produit d'un site
  @Post('withdraw')
  @Auth()
  @ApiOperation({ summary: "Retirer un produit d'un site (Opération inverse)" })
  async withdraw(@Body() dto: CreateMovementDto, @Req() req: any) {
    dto.type = MovementType.RETRAIT; // Force le type en retrait
    return this.stockService.createMovement(dto, req.user.userId);
  }

  // GET: /stock/my-assets -> Liste des produits validés et stockés
  @Get('my-assets')
  @Auth()
  @ApiOperation({ summary: 'Voir mes actifs (Produits validés et en stock)' })
  @ApiQuery({ name: 'siteId', required: false, description: 'Filtrer par site (optionnel)' })
  @ApiQuery({ name: 'productId', required: false, description: 'Filtrer par produit (optionnel)' })
  @ApiQuery({ name: 'movementType', required: false, enum: MovementType, description: 'Filtrer par type de mouvement (optionnel)' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Filtrer par date de début (optionnel)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Filtrer par date de fin (optionnel)' })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page pour la pagination (optionnel)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Nombre d\'éléments par page pour la pagination (optionnel)' })
  async getMyAssets(@Req() req: any,@Query() query: any) {
    // On peut utiliser le findAll du productService avec isStocker=true
    return this.stockService.getMyAssets(req.user.userId, query);
  }
}
