import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type FormVersionDocument = FormVersion & Document;

/**
 * Change metadata tracking for form versions
 */
@Schema({ _id: false })
export class FormChangeMetadata {
  @Prop({ required: true })
  field: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  oldValue?: Record<string, unknown>;

  @Prop({ type: MongooseSchema.Types.Mixed })
  newValue?: Record<string, unknown>;

  @Prop({
    required: true,
    enum: ['created', 'updated', 'deleted', 'added'],
  })
  changeType: 'created' | 'updated' | 'deleted' | 'added';
}

/**
 * Form Version entity
 * Tracks all changes made to forms with complete history
 */
@Schema({
  timestamps: true,
  collection: 'formversions',
})
export class FormVersion extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Form',
    required: true,
    index: true,
  })
  formId: Types.ObjectId;

  @Prop({
    required: true,
    index: true,
  })
  version: number;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  createdBy: Types.ObjectId;

  @Prop({
    trim: true,
    maxlength: 500,
  })
  changeDescription?: string;

  @Prop({
    type: [FormChangeMetadata],
    default: [],
  })
  changes: FormChangeMetadata[];

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
  })
  formData: Record<string, unknown>; // Complete form snapshot at this version

  @Prop({
    enum: ['auto', 'manual'],
    default: 'auto',
  })
  versionType: 'auto' | 'manual';

  @Prop({
    type: {
      userAgent: String,
      ipAddress: String,
      location: String,
    },
  })
  metadata?: {
    userAgent?: string;
    ipAddress?: string;
    location?: string;
  };

  @Prop({
    default: false,
  })
  isRevertPoint: boolean;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'FormVersion',
  })
  parentVersion?: Types.ObjectId;

  @Prop()
  tags?: string[];

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

export const FormVersionSchema = SchemaFactory.createForClass(FormVersion);

// Compound indexes for optimal querying performance
FormVersionSchema.index({ formId: 1, version: -1 });
FormVersionSchema.index({ formId: 1, createdAt: -1 });
FormVersionSchema.index({ createdBy: 1, createdAt: -1 });
