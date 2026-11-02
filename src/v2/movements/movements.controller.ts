import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MovementsService } from './movements.service';
import { Auth } from '../../v1/auth/decorators/auth.decorator';

const depositSchema = {
  type: 'object',
  required: [
    'ayantDroitId',
    'detentaireId',
    'depotId',
    'productId',
    'quantite',
    'prixUnitaire',
  ],
  properties: {
    ayantDroitId: { type: 'string', example: '507f1f77bcf86cd799439011' },
    detentaireId: { type: 'string', example: '507f1f77bcf86cd799439012' },
    depotId: { type: 'string', example: '507f1f77bcf86cd799439013' },
    productId: { type: 'string', example: '507f1f77bcf86cd799439014' },
    quantite: { type: 'number', example: 250 },
    prixUnitaire: { type: 'number', example: 1000 },
    siteOrigineId: { type: 'string', example: '507f1f77bcf86cd799439015' },
  },
};

const transferSchema = {
  type: 'object',
  required: [
    'detentaireId',
    'depotId',
    'productId',
    'fromAyantDroitId',
    'toAyantDroitId',
    'quantite',
    'prixUnitaire',
  ],
  properties: {
    detentaireId: { type: 'string', example: '507f1f77bcf86cd799439012' },
    depotId: { type: 'string', example: '507f1f77bcf86cd799439013' },
    productId: { type: 'string', example: '507f1f77bcf86cd799439014' },
    fromAyantDroitId: { type: 'string', example: '507f1f77bcf86cd799439011' },
    toAyantDroitId: { type: 'string', example: '507f1f77bcf86cd799439016' },
    quantite: { type: 'number', example: 100 },
    prixUnitaire: { type: 'number', example: 1000 },
  },
};

const exchangeSchema = {
  type: 'object',
  required: [
    'acheteurId',
    'vendeurId',
    'productAId',
    'productBId',
    'quantiteA',
    'quantiteB',
    'detentaireAId',
    'depotAId',
    'detentaireBId',
    'depotBId',
  ],
  properties: {
    acheteurId: { type: 'string', example: '507f1f77bcf86cd799439016' },
    vendeurId: { type: 'string', example: '507f1f77bcf86cd799439011' },
    productAId: { type: 'string', example: '507f1f77bcf86cd799439014' },
    productBId: { type: 'string', example: '507f1f77bcf86cd799439017' },
    quantiteA: { type: 'number', example: 10 },
    quantiteB: { type: 'number', example: 20 },
    detentaireAId: { type: 'string', example: '507f1f77bcf86cd799439012' },
    depotAId: { type: 'string', example: '507f1f77bcf86cd799439013' },
    detentaireBId: { type: 'string', example: '507f1f77bcf86cd799439018' },
    depotBId: { type: 'string', example: '507f1f77bcf86cd799439019' },
  },
};

const withdrawSchema = {
  type: 'object',
  required: [
    'detentaireId',
    'ayantDroitId',
    'productId',
    'siteOrigineId',
    'siteDestinationId',
    'quantite',
    'prixUnitaire',
  ],
  properties: {
    detentaireId: { type: 'string', example: '507f1f77bcf86cd799439012' },
    ayantDroitId: { type: 'string', example: '507f1f77bcf86cd799439011' },
    productId: { type: 'string', example: '507f1f77bcf86cd799439014' },
    siteOrigineId: { type: 'string', example: '507f1f77bcf86cd799439013' },
    siteDestinationId: { type: 'string', example: '507f1f77bcf86cd799439015' },
    quantite: { type: 'number', example: 50 },
    prixUnitaire: { type: 'number', example: 1000 },
  },
};

@ApiTags('Mouvements (V2)')
@Auth()
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Post('deposit')
  @ApiOperation({ summary: 'Appliquer un dépôt (V2)' })
  @ApiBody({ schema: depositSchema })
  @ApiResponse({ status: 201, description: 'Dépôt appliqué' })
  @ApiResponse({ status: 400, description: 'Quantité invalide' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  deposit(@Body() body: any) {
    return this.movementsService.deposit(body);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Appliquer un virement de droit (V2)' })
  @ApiBody({ schema: transferSchema })
  @ApiResponse({ status: 201, description: 'Virement appliqué' })
  @ApiResponse({ status: 400, description: 'Quantité invalide' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  transfer(@Body() body: any) {
    return this.movementsService.transferRight(body);
  }

  @Post('exchange')
  @ApiOperation({ summary: 'Appliquer un échange d’actifs (V2)' })
  @ApiBody({ schema: exchangeSchema })
  @ApiResponse({ status: 201, description: 'Échange appliqué' })
  @ApiResponse({ status: 400, description: 'Quantité invalide' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  exchange(@Body() body: any) {
    return this.movementsService.exchange(body);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Appliquer un retrait (V2)' })
  @ApiBody({ schema: withdrawSchema })
  @ApiResponse({ status: 201, description: 'Retrait appliqué' })
  @ApiResponse({ status: 400, description: 'Quantité invalide' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  withdraw(@Body() body: any) {
    return this.movementsService.withdraw(body);
  }
}
