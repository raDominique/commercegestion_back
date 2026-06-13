import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cart, CartDocument, Order, OrderDocument } from './cart.schema';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { ShopAvailableService } from '../shop-available/shop-available.service';
import { TransactionsService } from '../transactions/transactions.service';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly shopAvailableService: ShopAvailableService,
    private readonly transactionsService: TransactionsService,
  ) {}

  private async findOrCreateCart(userId: string): Promise<CartDocument> {
    let cart = await this.cartModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();
    if (!cart) {
      cart = await this.cartModel.create({
        userId: new Types.ObjectId(userId),
        items: [],
      });
    }
    return cart;
  }

  async getCart(userId: string) {
    const cart = await this.findOrCreateCart(userId);
    return {
      status: 'success',
      data: cart,
      totalItems: cart.items.length,
      totalPrice: cart.items.reduce(
        (sum, item) => sum + item.prixUnitaire * item.quantite,
        0,
      ),
    };
  }

  async addItem(userId: string, dto: AddCartItemDto) {
    const shopItem = await this.shopAvailableService.findById(dto.shopItemId);
    if (!shopItem) {
      throw new NotFoundException('Annonce introuvable.');
    }
    if (shopItem.statut !== 'ACTIVE') {
      throw new BadRequestException('Cette annonce n\'est plus active.');
    }
    if (dto.quantite > shopItem.quantite) {
      throw new BadRequestException(
        `Quantité insuffisante. Disponible: ${shopItem.quantite}`,
      );
    }

    const cart = await this.findOrCreateCart(userId);
    const existing = cart.items.find(
      (i) => i.shopItemId.toString() === dto.shopItemId,
    );

    if (existing) {
      const newQty = existing.quantite + dto.quantite;
      if (newQty > shopItem.quantite) {
        throw new BadRequestException(
          `Quantité totale (${newQty}) dépasse le disponible (${shopItem.quantite}).`,
        );
      }
      existing.quantite = newQty;
    } else {
      cart.items.push({
        shopItemId: new Types.ObjectId(dto.shopItemId),
        productId: shopItem.productId,
        vendeurId: shopItem.vendeurId,
        siteId: shopItem.siteId,
        productName: (shopItem.productId as any)?.productName || '',
        productImage: (shopItem.productId as any)?.productImage || '',
        quantite: dto.quantite,
        prixUnitaire: shopItem.prixUnitaire,
        addedAt: new Date(),
      } as any);
    }

    await cart.save();
    return this.getCart(userId);
  }

  async updateItemQuantity(userId: string, shopItemId: string, dto: UpdateCartItemDto) {
    const cart = await this.findOrCreateCart(userId);
    const item = cart.items.find(
      (i) => i.shopItemId.toString() === shopItemId,
    );
    if (!item) {
      throw new NotFoundException('Article introuvable dans le panier.');
    }

    const shopItem = await this.shopAvailableService.findById(shopItemId);
    if (!shopItem || shopItem.statut !== 'ACTIVE') {
      throw new BadRequestException('Cette annonce n\'est plus disponible.');
    }
    if (dto.quantite > shopItem.quantite) {
      throw new BadRequestException(
        `Quantité insuffisante. Disponible: ${shopItem.quantite}`,
      );
    }

    item.quantite = dto.quantite;
    await cart.save();
    return this.getCart(userId);
  }

  async removeItem(userId: string, shopItemId: string) {
    const cart = await this.findOrCreateCart(userId);
    const index = cart.items.findIndex(
      (i) => i.shopItemId.toString() === shopItemId,
    );
    if (index === -1) {
      throw new NotFoundException('Article introuvable dans le panier.');
    }
    cart.items.splice(index, 1);
    await cart.save();
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.findOrCreateCart(userId);
    cart.items = [];
    await cart.save();
    return { status: 'success', message: 'Panier vidé.' };
  }

  async checkout(userId: string, dto?: CheckoutDto) {
    const cart = await this.findOrCreateCart(userId);
    if (!cart.items.length) {
      throw new BadRequestException('Votre panier est vide.');
    }

    const total = cart.items.reduce(
      (sum, item) => sum + item.prixUnitaire * item.quantite,
      0,
    );

    const transactionIds: Types.ObjectId[] = [];
    const errors: Array<{ productName: string; reason: string }> = [];

    for (const item of cart.items) {
      try {
        const result = await this.transactionsService.createVente(
          {
            vendeurId: item.vendeurId.toString(),
            productId: item.productId.toString(),
            siteOrigineId: item.siteId.toString(),
            siteDestinationId: dto?.siteDestinationId || undefined,
            quantite: item.quantite,
            prixUnitaire: item.prixUnitaire,
            observations: dto?.observations || `Commande groupée depuis le panier`,
          },
          userId,
        );
        if (result.data?.[0]) {
          transactionIds.push(result.data[0]._id);
        }
      } catch (err) {
        errors.push({
          productName: item.productName,
          reason: err.message,
        });
      }
    }

    if (!transactionIds.length) {
      throw new BadRequestException(
        `Aucune transaction n'a pu être créée. ${errors.map((e) => `${e.productName}: ${e.reason}`).join('; ')}`,
      );
    }

    const order = await this.orderModel.create({
      userId: new Types.ObjectId(userId),
      items: cart.items,
      total,
      status: 'PENDING',
      transactionIds,
    });

    cart.items = [];
    await cart.save();

    return {
      status: errors.length === 0 ? 'success' : 'partial_success',
      message: `${transactionIds.length} transaction(s) créée(s).${errors.length ? ` ${errors.length} erreur(s).` : ''}`,
      data: {
        orderId: order._id,
        total,
        transactionIds,
        status: order.status,
      },
      ...(errors.length && { errors }),
    };
  }

  async getOrders(userId: string, page = 1, limit = 10) {
    const filter = { userId: new Types.ObjectId(userId) };
    const [orders, total] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.orderModel.countDocuments(filter),
    ]);
    return { status: 'success', data: orders, page, limit, total };
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await this.orderModel
      .findOne({
        _id: new Types.ObjectId(orderId),
        userId: new Types.ObjectId(userId),
      })
      .exec();
    if (!order) throw new NotFoundException('Commande introuvable.');
    return { status: 'success', data: order };
  }
}
