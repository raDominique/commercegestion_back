import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { ShopAvailableService } from './shop-available.service';
import { CreateShopItemDto } from './dto/create-shop-item.dto';
import { Auth } from '../auth';

@ApiTags('Shop Available')
@Controller()
export class ShopAvailableController {
  constructor(private readonly shopService: ShopAvailableService) {}

  @Post('shop-items')
  @Auth()
  @ApiOperation({
    summary: 'Mettre un actif en vente',
    description: `Crée une annonce de vente à partir d'un actif existant.
Le vendeur spécifie le produit, la quantité et le prix unitaire.
La quantité est vérifiée par rapport à l'actif détenu.`,
  })
  @ApiBody({ type: CreateShopItemDto })
  @ApiResponse({ status: 201, description: 'Annonce créée' })
  async create(@Req() req: any, @Body() dto: CreateShopItemDto) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    const item = await this.shopService.create(userId, dto);
    return { status: 'success', message: 'Annonce créée', data: [item] };
  }

  @Get('shop-items')
  @Auth()
  @ApiOperation({
    summary: 'Lister toutes les annonces actives',
    description:
      'Liste paginée des produits mis en vente par les utilisateurs.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiResponse({ status: 200, description: 'Liste des annonces' })
  async findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return this.shopService.findAll(
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(limit) || 20)),
      search,
      sortBy,
      order,
    );
  }

  @Get('shop-items/mine')
  @Auth()
  @ApiOperation({
    summary: 'Mes annonces de vente',
    description:
      'Liste paginée de mes propres annonces. Par défaut, seules les annonces actives sont retournées. Utilisez `statut=ALL` pour toutes.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    example: 'createdAt',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
  })
  @ApiQuery({
    name: 'statut',
    required: false,
    type: String,
    example: 'ACTIVE',
    description:
      'Filtrer par statut (ACTIVE, SOLD, CANCELLED, ou ALL pour tout voir)',
  })
  @ApiResponse({ status: 200, description: 'Mes annonces' })
  async findMine(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search?: string,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
    @Query('statut') statut?: string,
  ) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    return this.shopService.findByVendeur(
      userId,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(limit) || 20)),
      search,
      sortBy,
      order,
      statut,
    );
  }

  @Get('shop-items/:id')
  @Auth()
  @ApiOperation({
    summary: "Détail d'une annonce",
  })
  @ApiParam({ name: 'id', description: "ID de l'annonce" })
  @ApiResponse({ status: 200, description: 'Annonce trouvée' })
  @ApiResponse({ status: 404, description: 'Annonce introuvable' })
  async findById(@Param('id') id: string) {
    if (!id) throw new BadRequestException('ID requis');
    const item = await this.shopService.findById(id);
    return { status: 'success', data: [item] };
  }

  @Delete('shop-items/:id')
  @Auth()
  @ApiOperation({
    summary: 'Annuler une mise en vente',
    description:
      'Seul le vendeur peut annuler sa propre annonce et seulement si elle est encore active.',
  })
  @ApiParam({ name: 'id', description: "ID de l'annonce" })
  @ApiResponse({ status: 200, description: 'Annonce annulée' })
  async cancel(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.userId;
    if (!userId) throw new BadRequestException('Utilisateur non authentifié');
    if (!id) throw new BadRequestException('ID requis');
    const item = await this.shopService.cancel(userId, id);
    return { status: 'success', message: 'Annonce annulée', data: [item] };
  }
}
