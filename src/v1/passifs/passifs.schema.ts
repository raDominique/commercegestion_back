import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PassifDocument = Passif & Document;

@Schema({ timestamps: true })
export class Passif {
  readonly _id?: any;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Site', required: true, index: true })
  depotId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  quantite: number;

  @Prop({ enum: ['Retrait', 'Vente', 'Perte', 'Autre'], default: 'Retrait' })
  reason: string; // Raison du passif (retrait, vente, perte, etc.)

  @Prop({ default: true, index: true })
  isActive: boolean; // Marque si le passif est actif

  @Prop({ type: Date, default: null })
  closedAt?: Date; // Date de clôture du passif (quand il est résolu)
}

export const PassifSchema = SchemaFactory.createForClass(Passif);
