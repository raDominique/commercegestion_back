import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CpcProduct } from '../cpc/cpc.schema'; // Import pour le typage TS

export type ProductDocument = Product & Document;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
})
export class Product extends Document {
  @Prop({
    required: true,
    unique: true,
    index: true,
    trim: true
  })
  codeCPC: string;

  @Prop({ required: true, trim: true })
  productName: string;

  @Prop()
  productDescription: string;

  @Prop({
    type: Types.ObjectId,
    ref: 'CpcProduct',
    required: true,
    index: true
  })
  categoryId: Types.ObjectId | CpcProduct;

  @Prop({
    type: String,
    enum: ['Brut', 'Transformé', 'Conditionné'],
    default: 'Brut'
  })
  productState: string;

  @Prop({ type: [String] })
  productImage: string[];

  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  })
  productOwnerId: Types.ObjectId;

  @Prop({ default: false })
  productValidation: boolean;

  @Prop({
    type: {
      hauteur: { type: String },
      largeur: { type: String },
      longueur: { type: String },
    },
    _id: false
  })
  dimensions: { hauteur: string; largeur: string; longueur: string };
}

export const ProductSchema = SchemaFactory.createForClass(Product);