import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShopAvailableDocument = ShopAvailable & Document;

export enum ShopAvailableStatus {
  ACTIVE = 'ACTIVE',
  SOLD = 'SOLD',
  CANCELLED = 'CANCELLED',
}

@Schema({ timestamps: true })
export class ShopAvailable {
  readonly _id?: any;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  vendeurId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Site', required: true })
  siteId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Actif', default: null })
  actifId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  quantite: number;

  @Prop({ required: true, min: 0 })
  quantiteOriginale: number;

  @Prop({ required: true, min: 0 })
  prixUnitaire: number;

  @Prop({ type: String, enum: Object.values(ShopAvailableStatus), default: ShopAvailableStatus.ACTIVE, index: true })
  statut: ShopAvailableStatus;

  @Prop({ default: '' })
  description: string;
}

export const ShopAvailableSchema = SchemaFactory.createForClass(ShopAvailable);
