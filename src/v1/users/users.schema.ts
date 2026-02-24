import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

export type UserDocument = User & Document;

// ==================== ENUMS ====================
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

  @Prop({ default: UserType.PARTICULIER })
  userType: string;

  @Prop({ default: UserAccess.UTILISATEUR })
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

  // ==================== PROFILE & PARRAINAGE ====================
  @Prop({ unique: true, sparse: true, index: true })
  userId: string; // ID de 8 caractères pour le parrainage

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
  carteFiscal?: string[];

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

  // ==================== SOFT DELETE & TIMESTAMPS ====================
  @Prop({ default: null })
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

/**
 * Générateur d'ID court (8 caractères)
 */
function generateShortId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Pas de 0, O, I, 1, L
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Middleware Pre-Save : Hashage et ID Unique
 */
UserSchema.pre<UserDocument>('save', async function () {
  const user = this;

  // 1. Hashage du mot de passe
  if (user.isModified('userPassword')) {
    const salt = await bcrypt.genSalt(10);
    user.userPassword = await bcrypt.hash(user.userPassword, salt);
  }

  // 2. Génération/Correction du userId (8 chars)
  // On génère si c'est nouveau OU si l'ID existant n'est pas au format 8 caractères (ex: UUID)
  if (user.isNew || (user.userId && user.userId.length !== 8)) {
    let isUnique = false;
    let attempts = 0;
    const userModel = user.constructor as Model<UserDocument>;

    while (!isUnique && attempts < 15) {
      const candidateId = generateShortId();
      const existing = await userModel
        .findOne({ userId: candidateId })
        .select('_id')
        .lean()
        .exec();

      if (!existing) {
        user.userId = candidateId;
        isUnique = true;
      }
      attempts++;
    }
  }
});

UserSchema.index(
  { userEmail: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);
UserSchema.index({ userId: 1 }, { unique: true, sparse: true });
