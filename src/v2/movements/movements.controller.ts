import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MovementsService } from './movements.service';
import { Auth } from '../../v1/auth/decorators/auth.decorator';

@ApiTags('Mouvements (V2)')
@Auth()
@Controller('movements')
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Post('deposit')
  @ApiOperation({ summary: 'Appliquer un dépôt (V2)' })
  @ApiBody({
    schema: {
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
        ayantDroitId: { type: 'string' },
        detentaireId: { type: 'string' },
        depotId: { type: 'string' },
        productId: { type: 'string' },
        quantite: { type: 'number' },
        prixUnitaire: { type: 'number' },
        siteOrigineId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Dépôt appliqué' })
  deposit(@Body() body: any) {
    return this.movementsService.deposit(body);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Appliquer un virement de droit (V2)' })
  @ApiResponse({ status: 201, description: 'Virement appliqué' })
  transfer(@Body() body: any) {
    return this.movementsService.transferRight(body);
  }

  @Post('exchange')
  @ApiOperation({ summary: 'Appliquer un échange d’actifs (V2)' })
  @ApiResponse({ status: 201, description: 'Échange appliqué' })
  exchange(@Body() body: any) {
    return this.movementsService.exchange(body);
  }

  @Post('withdraw')
  @ApiOperation({ summary: 'Appliquer un retrait (V2)' })
  @ApiResponse({ status: 201, description: 'Retrait appliqué' })
  withdraw(@Body() body: any) {
    return this.movementsService.withdraw(body);
  }
}
