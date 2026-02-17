import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ProductDocument = Product & Document;

@Schema({ timestamps: true })
export class Product {
  readonly _id: string;

  @Prop({ 
    required: true, 
    unique: true, 
    index: true,
    description: 'Code à 5 chiffres selon la nomenclature CPC (ex: 01110 pour le blé)' 
  })
  codeCPC: string;

  @Prop({ required: true })
  productName: string;

  @Prop()
  productDescription: string;

  // Référence vers la catégorie (qui correspond souvent au Groupe ou à la Division CPC)
  @Prop({ type: Types.ObjectId, ref: 'Category', required: true, index: true })
  categoryId: string;

  @Prop({ 
    type: String, 
    enum: ['Brut', 'Transformé', 'Conditionné'], 
    default: 'Brut' 
  })
  productState: string;

  @Prop({ type: [String] })
  productImage: string[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  productOwnerId: string;

  @Prop({ default: false })
  productValidation: boolean;

  // --- Dimensions et Logistique ---
  @Prop()
  productVolume: string; // Ex: "10 m3"

  @Prop()
  productPoids: string; // Ex: "50 kg"

  @Prop({ type: Object })
  dimensions: {
    hauteur: string;
    largeur: string;
    longueur: string;
  };

  @Prop({ default: false })
  isStocker: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);