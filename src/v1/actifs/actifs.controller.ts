import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ActifsService } from './actifs.service';
import { Auth } from '../auth';

@ApiTags('Actifs')
@Controller()
export class ActifsController {
  constructor(private readonly actifsService: ActifsService) {}

  @Get('get-by-id/:id')
  @Auth()
  @ApiOperation({ summary: 'Récupérer un actif spécifique' })
  findOne(@Param('id') id: string) {
    return this.actifsService.getActifDetails(id);
  }

  @Get('shop-available')
  @Auth()
  @ApiOperation({
    summary: 'Récupérer les produits disponibles pour le shop',
    description: 'Récupère les produits validés par un admin et actuellement en stock (Actifs avec quantité > 0).',
  })
  @ApiResponse({ status: 200, description: 'Liste des produits récupérée avec succès.' })
  @ApiResponse({ status: 400, description: 'Paramètres de requête invalides.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Numéro de la page (défaut: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Nombre de produits par page (défaut: 10)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Recherche par nom ou code CPC' })
  @ApiQuery({ name: 'fournisseurId', required: false, type: String, description: 'Filtrer par ID du vendeur (Ayant-droit)' })
  @ApiQuery({ name: 'sort', required: false, type: String, description: 'Champ pour le tri', example: 'prixUnitaire', enum: ['createdAt', 'productName', 'codeCPC', 'prixUnitaire'] })
  @ApiQuery({ name: 'order', required: false, type: Number, description: 'Ordre: 1 (Asc), -1 (Desc)', example: -1 })
  async getShopProducts(@Query() query: any) {
    return this.actifsService.getAvailableValidatedProducts(query);
  }
}
