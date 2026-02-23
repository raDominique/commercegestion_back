import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ActifDocument = Actif & Document;

@Schema({ timestamps: true })
export class Actif {
  readonly _id?: any;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Site', required: true, index: true })
  depotId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  quantite: number;

  @Prop({ default: true, index: true })
  isActive: boolean; // Marque si l'actif est actif (quantité > 0)

  @Prop({ type: Date, default: null })
  archivedAt?: Date; // Date d'archivage (quand quantité devient 0)
}

export const ActifSchema = SchemaFactory.createForClass(Actif);
