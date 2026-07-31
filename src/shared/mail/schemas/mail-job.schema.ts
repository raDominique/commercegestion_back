import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MailJobDocument = MailJob & Document;

export enum MailJobStatus {
  PENDING = 'pending',
  SENDING = 'sending',
  SENT = 'sent',
  FAILED = 'failed',
}

/**
 * Job d'email persistant dans MongoDB.
 * Permet de survivre aux redémarrages du process (file durable).
 */
@Schema({ timestamps: true, collection: 'mail_queue' })
export class MailJob {
  @Prop({ required: true, index: true })
  to: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  template: string;

  @Prop({ type: Object, default: {} })
  context: Record<string, any>;

  @Prop({
    type: String,
    enum: Object.values(MailJobStatus),
    default: MailJobStatus.PENDING,
    index: true,
  })
  status: MailJobStatus;

  @Prop({ default: 0 })
  attempts: number;

  @Prop({ default: 3 })
  maxRetries: number;

  @Prop({ type: String, default: null })
  lastError?: string;

  @Prop({ type: Date, default: null, index: true })
  nextAttemptAt: Date;

  @Prop({ type: Date, default: null })
  sentAt: Date;
}

export const MailJobSchema = SchemaFactory.createForClass(MailJob);
MailJobSchema.index({ status: 1, nextAttemptAt: 1 });
