import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document;

export enum UserType {
  PARTICULIER = 'Particulier',
  PROFESSIONNEL = 'Professionnel',
  ENTREPRISE = 'Entreprise',
}

export enum UserAccess {
  UTILISATEUR = 'Utilisateur',
  ADMIN = 'Admin',
}

export enum DocumentType {
  CIN = 'cin',
  PASSPORT = 'passport',
  PERMIS_DE_CONDUIRE = 'permis-de-conduire',
}

@Schema({ timestamps: true })
export class User {
  readonly _id?: any;

  // ==================== IDENTITÉ PERSONNELLE ====================
  @Prop({ required: true })
  userNickName: string;

  @Prop({ required: true })
  userName: string;

  @Prop({ required: true })
  userFirstname: string;

  @Prop({ required: true, select: false })
  userPassword: string;

  @Prop({ required: true, unique: true, lowercase: true, index: true })
  userEmail: string;

  @Prop()
  userPhone: string;

  @Prop({ default: 'Particulier' })
  userType: string;

  @Prop({ default: 'Utilisateur' })
  userAccess: string;

  @Prop({ default: 0 })
  userTotalSolde: number;

  @Prop()
  userAddress: string;

  @Prop({ default: false })
  userValidated: boolean;

  @Prop({ default: false })
  userEmailVerified: boolean;

  // ==================== LOCALISATION ====================
  @Prop()
  userMainLat?: number;

  @Prop()
  userMainLng?: number;

  // ==================== PROFILE ====================
  @Prop({ unique: true, sparse: true })
  userId: string;

  @Prop()
  userImage: string;

  @Prop()
  userDateOfBirth?: Date;

  // ==================== DOCUMENTS D'IDENTITÉ ====================
  @Prop()
  identityCardNumber?: string;

  @Prop({ type: [String], default: [] })
  identityDocument?: string[];

  @Prop()
  documentType?: string;

  // ==================== INFORMATIONS PROFESSIONNELLES ====================
  @Prop()
  raisonSocial?: string;

  @Prop()
  nif?: string;

  @Prop()
  rcs?: string;

  @Prop()
  type?: string;

  @Prop()
  managerName?: string;

  @Prop()
  managerEmail?: string;

  @Prop()
  logo?: string;

  @Prop()
  carteStat?: string;

  @Prop({ type: [String], default: [] })
  carteFiscal?: string[]; // Array of file names

  // ==================== PASSWORD RESET ====================
  @Prop({ default: null })
  resetPasswordToken?: string;

  @Prop({ default: null })
  resetPasswordExpires?: Date;

  // ==================== PARRAINAGE ====================
  @Prop()
  parrain1ID?: string;

  @Prop()
  parrain2ID?: string;

  // ==================== SOFT DELETE CREATE UPDATE ====================
  @Prop({ default: null })
  deletedAt?: Date;

  @Prop({ default: null })
  createdAt?: Date;

  @Prop({ default: null })
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

/**
 * Hash password avant sauvegarde
 */
UserSchema.pre<UserDocument>('save', async function () {
  if (!this.isModified('userPassword')) return;
  const salt = await bcrypt.genSalt(10);
  this.userPassword = await bcrypt.hash(this.userPassword, salt);
});

/**
 * Index partiel (soft delete friendly)
 */
UserSchema.index(
  { userEmail: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

UserSchema.index({ userId: 1 }, { unique: true, sparse: true });
