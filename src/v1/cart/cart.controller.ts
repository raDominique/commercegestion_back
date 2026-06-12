import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { Auth } from '../auth';

@ApiTags('Panier')
@Controller()
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @Auth()
  @ApiOperation({ summary: 'Voir mon panier' })
  @ApiResponse({ status: 200, description: 'Panier récupéré.' })
  async getCart(@Req() req: any) {
    return this.cartService.getCart(req.user.userId);
  }

  @Post('add')
  @Auth()
  @ApiOperation({ summary: 'Ajouter un article au panier' })
  @ApiBody({ type: AddCartItemDto })
  @ApiResponse({ status: 201, description: 'Article ajouté.' })
  async addItem(@Body() dto: AddCartItemDto, @Req() req: any) {
    return this.cartService.addItem(req.user.userId, dto);
  }

  @Patch('item/:shopItemId')
  @Auth()
  @ApiOperation({ summary: 'Modifier la quantité d\'un article' })
  @ApiParam({ name: 'shopItemId', description: 'ID du ShopAvailable' })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiResponse({ status: 200, description: 'Quantité mise à jour.' })
  async updateItem(
    @Param('shopItemId') shopItemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: any,
  ) {
    return this.cartService.updateItemQuantity(req.user.userId, shopItemId, dto);
  }

  @Delete('item/:shopItemId')
  @Auth()
  @ApiOperation({ summary: 'Retirer un article du panier' })
  @ApiParam({ name: 'shopItemId', description: 'ID du ShopAvailable' })
  @ApiResponse({ status: 200, description: 'Article retiré.' })
  async removeItem(@Param('shopItemId') shopItemId: string, @Req() req: any) {
    return this.cartService.removeItem(req.user.userId, shopItemId);
  }

  @Delete()
  @Auth()
  @ApiOperation({ summary: 'Vider le panier' })
  @ApiResponse({ status: 200, description: 'Panier vidé.' })
  async clearCart(@Req() req: any) {
    return this.cartService.clearCart(req.user.userId);
  }

  @Post('checkout')
  @Auth()
  @ApiOperation({
    summary: 'Valider le panier et créer les transactions d\'achat',
    description:
      'Crée une transaction VENTE par article dans le panier, regroupe dans une commande, puis vide le panier.',
  })
  @ApiBody({ type: CheckoutDto })
  @ApiResponse({ status: 201, description: 'Commande créée.' })
  async checkout(@Body() dto: CheckoutDto, @Req() req: any) {
    return this.cartService.checkout(req.user.userId, dto);
  }

  @Get('orders')
  @Auth()
  @ApiOperation({ summary: 'Historique de mes commandes' })
  @ApiResponse({ status: 200, description: 'Liste des commandes.' })
  async getOrders(@Req() req: any) {
    return this.cartService.getOrders(req.user.userId);
  }

  @Get('orders/:orderId')
  @Auth()
  @ApiOperation({ summary: 'Détail d\'une commande' })
  @ApiParam({ name: 'orderId', description: 'ID de la commande' })
  @ApiResponse({ status: 200, description: 'Commande trouvée.' })
  async getOrderById(@Param('orderId') orderId: string, @Req() req: any) {
    return this.cartService.getOrderById(req.user.userId, orderId);
  }
}
