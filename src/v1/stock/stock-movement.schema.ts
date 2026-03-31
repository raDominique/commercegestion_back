import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockMovementDocument = StockMovement & Document;

export enum MovementType {
  DEPOT = 'DEPOT',
  RETRAIT = 'RETRAIT',
  TRANSFERT = 'TRANSFERT',
  VIREMENT = 'VIREMENT_PROPRIETE',
}

@Schema({ timestamps: true })
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  operatorId: Types.ObjectId;

  @Prop({
    enum: ['DEPOT', 'RETRAIT', 'TRANSFERT', 'VIREMENT_PROPRIETE'],
    required: true,
  })
  type: MovementType;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  quantite: number;

  @Prop({ type: Number, default: null })
  prixUnitaire: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  detentaire: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  ayant_droit: Types.ObjectId;

  // Tracer le mouvement physique (Détenteur)
  @Prop({ type: Types.ObjectId, ref: 'Site' })
  siteOrigineId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Site' })
  siteDestinationId: Types.ObjectId;


  // Validation du mouvement
  @Prop({ type: Boolean, default: false })
  isValide: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  flaggedBy: Types.ObjectId;

  @Prop({ type: String, default: null })
  flagReason: string;

  @Prop({ type: Date, default: null })
  flaggedAt: Date;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
