import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type StockMovementDocument = StockMovement & Document;

export enum MovementType {
  DEPOT = 'Depot',
  RETRAIT = 'Retrait',
  TRANSFERT = 'Transfert',
  VIREMENT = 'Virement',
}

@Schema({ timestamps: true }) // Enregistre auto createdAt (date/heure)
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  operatorId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Site', required: true, index: true })
  siteOrigineId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  depotOrigine: string;

  @Prop({ type: Types.ObjectId, ref: 'Site', required: true, index: true })
  siteDestinationId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  depotDestination: string;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  quantite: number;

  @Prop({ required: true })
  prixUnitaire: number;

  @Prop({ enum: MovementType, required: true })
  type: MovementType;

  @Prop({ trim: true })
  observations: string;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
