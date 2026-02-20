import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { CpcProduct } from '../cpc/cpc.schema';

export type ProductDocument = Product & Document;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Product extends Document {
  @Prop({
    required: true,
    index: true,
    unique: false,
    trim: true,
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
    index: true,
  })
  categoryId: Types.ObjectId | CpcProduct;

  @Prop()
  productCategory: string;

  @Prop({ enum: ['Brut', 'Transformé', 'Conditionné'], default: 'Brut' })
  productState: string;

  @Prop({ type: [String] })
  productImage: string[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  productOwnerId: Types.ObjectId;

  @Prop({ default: false })
  productValidation: boolean;

  @Prop() productVolume: string;
  @Prop() productHauteur: string;
  @Prop() productLargeur: string;
  @Prop() productLongueur: string;
  @Prop() productPoids: string;

  @Prop({ default: false })
  isStocker: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
