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

  @Prop({ type: Number, default: null })
  prixUnitaire: number; // Prix unitaire du produit au moment du dépôt

  @Prop({ default: true, index: true })
  isActive: boolean; // Marque si l'actif est actif (quantité > 0)

  @Prop({ type: Date, default: null })
  archivedAt?: Date; // Date d'archivage (quand quantité devient 0)
  
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  detentaire: Types.ObjectId; // Localisation physique (Qui a le produit ?)

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  ayant_droit: Types.ObjectId; // Propriété légale (À qui appartient-il ?)
}

export const PassifSchema = SchemaFactory.createForClass(Passif);
