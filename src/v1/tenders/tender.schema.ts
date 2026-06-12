import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TenderDocument = Tender & Document;
export type BidDocument = Bid & Document;

export enum TenderStatus {
  OUVERT = 'OUVERT',
  EN_ATTENTE = 'EN_ATTENTE',
  DEPOUILLE = 'DEPOUILLE',
  ATTRIBUE = 'ATTRIBUE',
  ANNULE = 'ANNULE',
}

export enum BidStatus {
  EN_ATTENTE = 'EN_ATTENTE',
  RETENUE = 'RETENUE',
  REJETEE = 'REJETEE',
}

@Schema({ timestamps: true })
export class Tender {
  readonly _id?: any;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  lanceurId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Product', required: true, index: true })
  productId: Types.ObjectId;

  @Prop({ type: String, required: true })
  titre: string;

  @Prop({ type: String, required: true })
  description: string;

  @Prop({ required: true, min: 0 })
  quantite: number;

  @Prop({ default: '' })
  unite: string;

  @Prop({ required: true })
  dateLimite: Date;

  @Prop({ default: null })
  dateDepouillement: Date;

  @Prop({ type: String, enum: Object.values(TenderStatus), default: TenderStatus.OUVERT, index: true })
  statut: TenderStatus;

  @Prop({ type: Types.ObjectId, ref: 'Site', default: null })
  siteLivraison: Types.ObjectId | null;

  @Prop({ default: '' })
  conditionsPaiement: string;

  @Prop({ default: '' })
  delaiLivraisonSouhaite: string;

  @Prop({ default: '' })
  documentPieces: string;

  @Prop({ type: Types.ObjectId, ref: 'Bid', default: null })
  soumissionRetenue: Types.ObjectId;

  @Prop({ default: '' })
  commentaireAttribution: string;
}

@Schema({ timestamps: true })
export class Bid {
  readonly _id?: any;

  @Prop({ type: Types.ObjectId, ref: 'Tender', required: true, index: true })
  appelOffreId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  soumissionnaireId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  prixUnitaire: number;

  @Prop({ required: true, min: 0 })
  prixTotal: number;

  @Prop({ required: true, min: 0 })
  quantite: number;

  @Prop({ default: '' })
  delaiLivraison: string;

  @Prop({ default: '' })
  observations: string;

  @Prop({ default: '' })
  documentPieces: string;

  @Prop({ type: String, enum: Object.values(BidStatus), default: BidStatus.EN_ATTENTE, index: true })
  statut: BidStatus;

  @Prop({ default: false })
  estAttribue: boolean;
}

export const TenderSchema = SchemaFactory.createForClass(Tender);
export const BidSchema = SchemaFactory.createForClass(Bid);
