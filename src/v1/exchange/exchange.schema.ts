import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ExchangeOfferDocument = ExchangeOffer & Document;

@Schema({ timestamps: true })
export class ExchangeOffer {
  readonly _id?: any;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  vendeurId: Types.ObjectId;

  // Produit A vendu
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productAId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  quantiteA: number;

  // Détenteur W + site où le produit A est déposé
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  detentaireAId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Site', required: true, index: true })
  depotAId: Types.ObjectId;

  // Produit B de contrepartie demandé
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productBId: Types.ObjectId;

  // Quantité de B pour 1 unité de A
  @Prop({ type: Number, required: true, min: 0 })
  tauxEchange: number;

  // Liste des détenteurs Y acceptés pour le produit B
  @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
  acceptedDetenteurBIds: Types.ObjectId[];

  @Prop({ type: Boolean, default: true, index: true })
  isActive: boolean;
}

export const ExchangeOfferSchema = SchemaFactory.createForClass(ExchangeOffer);

ExchangeOfferSchema.index({ productAId: 1, isActive: 1, createdAt: -1 });
ExchangeOfferSchema.index({ vendeurId: 1, isActive: 1, createdAt: -1 });
