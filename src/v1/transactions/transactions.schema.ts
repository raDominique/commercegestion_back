import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TransactionDocument = Transaction & Document;

export enum TransactionType {
  DEPOT = 'DÉPÔT',
  RETOUR = 'RETOUR',
  INITIALISATION = 'INITIALISATION',
  VENTE = 'VENTE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',     // En attente de validation
  APPROVED = 'APPROVED',   // Approuvée
  REJECTED = 'REJECTED',   // Rejetée
}

export enum MovementType {
  ACTIF = 'ACTIF',         // Mouvement d'actif
  PASSIF = 'PASSIF',       // Mouvement de passif
}

/**
 * Représente un mouvement dans le grand livre des transactions.
 * Chaque transaction peut créer plusieurs mouvements (actifs et passifs).
 */
@Schema({ timestamps: true })
export class Transaction {
  readonly _id?: any;

  // Identifiants de base
  @Prop({ required: true, unique: true, index: true })
  transactionNumber: string; // YYYY-MM-DD-HH-MM-SS-XXXX

  @Prop({
    type: String,
    enum: Object.values(TransactionType),
    required: true,
    index: true,
  })
  type: TransactionType; // DÉPÔT, RETOUR, INITIALISATION, VENTE

  @Prop({
    type: String,
    enum: Object.values(TransactionStatus),
    default: TransactionStatus.PENDING,
    index: true,
  })
  status: TransactionStatus; // PENDING, APPROVED, REJECTED

  // Acteurs
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  initiatorId: Types.ObjectId; // Qui a initié la transaction (Déposant ou Recevant)

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  recipientId: Types.ObjectId; // Destinataire (Recevant dans un dépôt)

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  approverUserId: Types.ObjectId; // Qui a approuvé/rejeté

  // Détails du mouvement
  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId; // Le produit concerné

  @Prop({ type: Types.ObjectId, ref: 'Site', required: true, index: true })
  originSiteId: Types.ObjectId; // Site d'origine (où on prend)

  @Prop({ type: Types.ObjectId, ref: 'Site', default: null })
  destinationSiteId: Types.ObjectId; // Site de destination (où on met)

  @Prop({ required: true, min: 0 })
  quantity: number; // Quantité transférée

  @Prop({ type: Number, default: null })
  unitPrice: number; // Prix unitaire au moment de la transaction

  // Pour les dépôts: qui détient et qui possède
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  detentaire: Types.ObjectId; // Qui garde physiquement l'actif (hangar ou utilisateur)

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  ayant_droit: Types.ObjectId; // Qui possède légalement l'actif

  // Validation et dates
  @Prop({ type: Date, default: null })
  approvedAt: Date; // Date d'approbation

  @Prop({ type: String, default: null })
  rejectionReason: string; // Raison du rejet (si rejetée)

  // Métadonnées
  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>; // Données additionnelles (notes, pièces jointes, etc.)

  @Prop({ default: true, index: true })
  isActive: boolean; // Marque si la transaction est active/valide
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Indexes composés pour les recherches efficaces
TransactionSchema.index({ transactionNumber: 1, status: 1 });
TransactionSchema.index({ initiatorId: 1, type: 1 });
TransactionSchema.index({ recipientId: 1, type: 1 });
TransactionSchema.index({ createdAt: -1, status: 1 });
