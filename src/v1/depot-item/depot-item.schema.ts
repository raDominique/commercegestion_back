import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class DepotItem extends Document {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  currentOwnerId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Site', required: true, index: true })
  currentDepotId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: Number, default: 0, min: 0 })
  stock: number;

  @Prop({ type: Number, default: 0 })
  prix: number;

  @Prop({ type: Date, default: Date.now })
  lastUpdate: Date;
}

export const DepotItemSchema = SchemaFactory.createForClass(DepotItem);

// Empêche les doublons : Un propriétaire ne peut avoir qu'une ligne par produit/site
DepotItemSchema.index(
  { currentOwnerId: 1, currentDepotId: 1, productId: 1 },
  { unique: true },
);
