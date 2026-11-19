import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { BulkAddCartItemDto } from './dto/bulk-add-cart-item.dto';
import {
  bulkDescription,
  BULK_RESPONSE_OK,
  BULK_RESPONSE_400,
} from '../../shared/bulk';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { Auth } from '../auth';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-user.interface';

@ApiTags('Panier')
@Controller()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Voir mon panier' })
  @ApiResponse({
    status: 200,
    description: "Panier récupéré avec le total et le nombre d'articles.",
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  async getCart(@Req() req: AuthenticatedRequest) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post('add')
  @Auth()
  @ApiOperation({ summary: 'Ajouter un article au panier' })
  @ApiBody({ type: AddCartItemDto })
  @ApiResponse({
    status: 201,
    description: 'Article ajouté. Retourne le panier mis à jour.',
  })
  @ApiResponse({
    status: 400,
    description: 'Quantité insuffisante ou annonce inactive.',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 404, description: 'Annonce introuvable.' })
  async addItem(@Body() dto: AddCartItemDto, @Req() req: AuthenticatedRequest) {
    return this.cartService.addItem(req.user.userId, dto);
  }

  @Post('add/bulk')
  @Auth()
  @ApiOperation({
    summary: 'Ajouter plusieurs articles au panier',
    description: bulkDescription(
      'Body `{ items: [...] }`. La réponse contient aussi `cart` : le panier final',
      'POST /cart/add',
    ),
  })
  @ApiBody({ type: BulkAddCartItemDto })
  @ApiResponse({ status: 201, ...BULK_RESPONSE_OK })
  @ApiResponse(BULK_RESPONSE_400)
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  async addItemsBulk(
    @Body() dto: BulkAddCartItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cartService.addItemsBulk(req.user.userId, dto);
  }

  @Patch('item/:shopItemId')
  @Auth()
  @ApiOperation({ summary: "Modifier la quantité d'un article" })
  @ApiParam({ name: 'shopItemId', description: 'ID du ShopAvailable' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({
    status: 200,
    description: 'Quantité mise à jour. Retourne le panier.',
  })
  @ApiResponse({
    status: 400,
    description: 'Quantité insuffisante ou annonce inactive.',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({
    status: 404,
    description: 'Article introuvable dans le panier.',
  })
  async updateItem(
    @Param('shopItemId') shopItemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cartService.updateItemQuantity(
      req.user.userId,
      shopItemId,
      dto,
    );
  }

  @Delete('item/:shopItemId')
  @Auth()
  @ApiOperation({ summary: 'Retirer un article du panier' })
  @ApiParam({ name: 'shopItemId', description: 'ID du ShopAvailable' })
  @ApiResponse({
    status: 200,
    description: 'Article retiré. Retourne le panier mis à jour.',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({
    status: 404,
    description: 'Article introuvable dans le panier.',
  })
  async removeItem(
    @Param('shopItemId') shopItemId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cartService.removeItem(req.user.userId, shopItemId);
  }

  @Delete()
  @Auth()
  @ApiOperation({ summary: 'Vider le panier' })
  @ApiResponse({ status: 200, description: 'Panier vidé avec succès.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  async clearCart(@Req() req: AuthenticatedRequest) {
    return this.cartService.clearCart(req.user.userId);
  }

  @Post('checkout')
  @Auth()
  @ApiOperation({
    summary: "Valider le panier et créer les transactions d'achat",
    description:
      'Crée une transaction VENTE par article dans le panier, regroupe dans une commande, puis vide le panier.',
  })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({ status: 201, description: 'Commande créée avec succès.' })
  @ApiResponse({
    status: 400,
    description: 'Panier vide ou échec de création des transactions.',
  })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  async checkout(@Body() dto: CheckoutDto, @Req() req: AuthenticatedRequest) {
    return this.cartService.checkout(req.user.userId, dto);
  }

  @Get('orders')
  @Auth()
  @ApiOperation({ summary: 'Historique de mes commandes avec pagination' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    example: 1,
    description: 'Numéro de la page',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    example: 10,
    description: "Nombre d'éléments par page",
  })
  @ApiResponse({ status: 200, description: 'Liste paginée des commandes.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  async getOrders(
    @Req() req: AuthenticatedRequest,
    @Query('page', new ParseIntPipe({ optional: true })) page = 1,
    @Query('limit', new ParseIntPipe({ optional: true })) limit = 10,
  ) {
    return this.cartService.getOrders(req.user.userId, page, limit);
  }

  @Get('orders/:orderId')
  @Auth()
  @ApiOperation({ summary: "Détail d'une commande" })
  @ApiParam({ name: 'orderId', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Commande trouvée.' })
  @ApiResponse({ status: 401, description: 'Non authentifié.' })
  @ApiResponse({ status: 404, description: 'Commande introuvable.' })
  async getOrderById(
    @Param('orderId') orderId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.cartService.getOrderById(req.user.userId, orderId);
  }
}
