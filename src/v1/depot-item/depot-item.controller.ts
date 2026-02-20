import { Controller, Post, Get, Body, Param, Req } from '@nestjs/common';
import { DepotItemService } from './depot-item.service';
import { AdjustStockDto, TransferStockDto } from './dto/inventory.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { Auth } from '../auth';

@ApiTags('Dépôt & Stocks')
@Controller()
export class DepotItemController {
  constructor(private readonly service: DepotItemService) {}

  @Post('adjust')
  @ApiOperation({ summary: 'Entrée ou sortie de stock' })
  @ApiResponse({
    status: 201,
    description: 'Stock ajusté avec succès',
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @Auth()
  async adjust(@Body() dto: AdjustStockDto, @Req() req: any) {
    return this.service.adjustStock(req.user.userId, dto);
  }

  @Get('site/:siteId')
  @ApiOperation({ summary: "Voir l'inventaire d'un site" })
  @ApiParam({ name: 'siteId', description: 'ID du site' })
  @ApiResponse({
    status: 200,
    description: 'Inventaire récupéré',
  })
  @ApiResponse({ status: 404, description: 'Site non trouvé' })
  @Auth()
  async getBySite(@Param('siteId') siteId: string, @Req() req: any) {
    return this.service.getInventoryBySite(siteId, req.user.userId);
  }

  @Post('transfer')
  @ApiOperation({ summary: 'Transférer entre deux dépôts' })
  @ApiResponse({
    status: 201,
    description: 'Stock transféré avec succès',
  })
  @ApiResponse({ status: 400, description: 'Transfert invalide' })
  @Auth()
  async transfer(@Body() dto: TransferStockDto, @Req() req: any) {
    return this.service.transfer(req.user.userId, dto);
  }
}
