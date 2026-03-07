import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockMovementDocument = StockMovement & Document;

export enum MovementType {
  DEPOT = 'Depot',
  RETRAIT = 'Retrait',
  TRANSFERT = 'Transfert',
  VIREMENT = 'Virement',
}

@Schema({ timestamps: true })
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  operatorId: Types.ObjectId; // Qui a validé (Admin, Vendeur, Hangar)

  @Prop({
    enum: ['DEPOT', 'RETRAIT', 'TRANSFERT', 'VIREMENT_PROPRIETE'],
    required: true,
  })
  type: MovementType;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  quantite: number;

  // Tracer le mouvement de propriété (Ayant-droit)
  @Prop({ type: Types.ObjectId, ref: 'User' })
  detentaire: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  nouveau_ayant_droit: Types.ObjectId;

  // Tracer le mouvement physique (Détenteur)
  @Prop({ type: Types.ObjectId, ref: 'Site' })
  siteOrigineId: Types.ObjectId;
  
  @Prop({ type: Types.ObjectId, ref: 'Site' })
  siteDestinationId: Types.ObjectId;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
