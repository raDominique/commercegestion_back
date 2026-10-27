import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EmailOtpDocument = EmailOtp & Document;

@Schema({ timestamps: true })
export class EmailOtp {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  codeHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  used: boolean;

  @Prop({ default: 0 })
  attempts: number;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;
}

export const EmailOtpSchema = SchemaFactory.createForClass(EmailOtp);
EmailOtpSchema.index({ userId: 1, createdAt: -1 });
EmailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
