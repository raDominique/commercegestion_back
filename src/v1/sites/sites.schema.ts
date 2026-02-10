import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SiteDocument = Site & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Site {
  readonly _id?: Types.ObjectId;

  /* ===================== METIER ===================== */

  @Prop({ required: true, trim: true })
  siteName: string;

  @Prop({ required: true, trim: true })
  siteAddress: string;

  // 👉 Latitude métier
  @Prop({
    required: true,
    min: -90,
    max: 90,
  })
  siteLat: number;

  // 👉 Longitude métier
  @Prop({
    required: true,
    min: -180,
    max: 180,
  })
  siteLng: number;

  /* ===================== TECHNIQUE (GEO) ===================== */

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      index: '2dsphere',
    },
  })
  location: {
    type: 'Point';
    coordinates: [number, number];
  };

  /* ===================== RELATION ===================== */

  @Prop({ required: true, ref: 'User', index: true })
  siteUserID: Types.ObjectId;
}

export const SiteSchema = SchemaFactory.createForClass(Site);

// pre-save -> document middleware
SiteSchema.pre<SiteDocument>('save', function () {
  this.location = {
    type: 'Point',
    coordinates: [this.siteLng, this.siteLat],
  };
});

// pre-findOneAndUpdate -> query middleware
SiteSchema.pre('findOneAndUpdate', function () {
  const update: any = this.getUpdate();

  if (update.siteLat !== undefined || update.siteLng !== undefined) {
    const lat = update.siteLat ?? this.getQuery().siteLat;
    const lng = update.siteLng ?? this.getQuery().siteLng;

    if (lat !== undefined && lng !== undefined) {
      update.location = {
        type: 'Point',
        coordinates: [lng, lat],
      };
    }
  }
});
