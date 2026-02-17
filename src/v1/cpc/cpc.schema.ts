import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class CpcProduct extends Document {
    @Prop({ required: true, unique: true, index: true })
    code: string;

    @Prop({ required: true })
    nom: string;

    @Prop({ required: true })
    niveau: string;

    @Prop({ index: true })
    parentCode: string;

    @Prop({ type: Object })
    correspondances: any;
}

export const CpcSchema = SchemaFactory.createForClass(CpcProduct);