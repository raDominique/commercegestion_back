import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  REFRESH_TOKEN = 'REFRESH_TOKEN',
  VERIFY_EMAIL = 'VERIFY_EMAIL',
  ACTIVATE_ACCOUNT = 'ACTIVATE_ACCOUNT',
  CHANGE_ROLE = 'CHANGE_ROLE',
}

export enum EntityType {
  USER = 'USER',
  SITE = 'SITE',
  PRODUCT = 'PRODUCT',
  CPC = 'CPC',
}

@Schema({ timestamps: { createdAt: 'timestamp', updatedAt: false } })
export class AuditLog {
  @Prop({ required: true, enum: AuditAction })
  action: AuditAction;

  @Prop({ required: true, enum: EntityType })
  entityType: EntityType;

  @Prop({ type: Types.ObjectId })
  entityId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId: Types.ObjectId | null;

  @Prop({ type: Object })
  previousState?: Record<string, any>;

  @Prop({ type: Object })
  newState?: Record<string, any>;

  @Prop()
  ipAddress: string;

  @Prop()
  userAgent: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
