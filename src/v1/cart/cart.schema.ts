import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ _id: false })
export class CartItem {
  @Prop({ type: Types.ObjectId, ref: 'ShopAvailable', required: true })
  shopItemId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  vendeurId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Site', required: true })
  siteId: Types.ObjectId;

  @Prop({ required: true })
  productName: string;

  @Prop()
  productImage: string;

  @Prop({ required: true, min: 1 })
  quantite: number;

  @Prop({ required: true, min: 0 })
  prixUnitaire: number;

  @Prop({ default: Date.now })
  addedAt: Date;
}

export type CartDocument = Cart & Document;

@Schema({ timestamps: true })
export class Cart {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: [CartItem], default: [] })
  items: CartItem[];
}

export const CartSchema = SchemaFactory.createForClass(Cart);

export enum OrderStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: [CartItem], default: [] })
  items: CartItem[];

  @Prop({ required: true, min: 0 })
  total: number;

  @Prop({ type: String, enum: Object.values(OrderStatus), default: OrderStatus.PENDING })
  status: OrderStatus;

  @Prop({ type: [Types.ObjectId], ref: 'Transaction', default: [] })
  transactionIds: Types.ObjectId[];
}

export const OrderSchema = SchemaFactory.createForClass(Order);
