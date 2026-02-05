import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document;

export enum UserType {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
  CARRIER = 'CARRIER',
  WAREHOUSE_MANAGER = 'WAREHOUSE_MANAGER',
  ADMIN = 'ADMIN',
}

@Schema({ timestamps: true })
export class User {

  readonly _id?: any;


  @Prop({ required: true, unique: true, lowercase: true, index: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({
    enum: UserType,
    default: UserType.BUYER,
  })
  userType: UserType;

  @Prop()
  companyName: string;

  @Prop()
  contactPerson: string;

  @Prop()
  phone: string;

  @Prop()
  address: string;

  @Prop()
  taxId: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ default: false })
  isActive: boolean;

  @Prop({ type: Number, default: 0 })
  balance: number;

  @Prop()
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

/**
 * Hash password avant sauvegarde
 */
UserSchema.pre<UserDocument>('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});


/**
 * Index partiel (soft delete friendly)
 */
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
