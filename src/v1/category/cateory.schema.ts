import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  readonly _id: string;

  @Prop({ required: true })
  catName: string;

  @Prop({})
  catMiniatureUrl?: string;

  @Prop()
  catDescription?: string;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
