import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * File upload information subdocument
 */
@Schema({ _id: false })
export class SubmissionFile {
  @Prop({ required: true })
  fieldId: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  mimetype: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  url: string;

  @Prop({ default: Date.now })
  uploadedAt: Date;

  @Prop()
  virusScanned?: boolean;

  @Prop()
  checksum?: string;
}

/**
 * Payment information subdocument
 */
@Schema({ _id: false })
export class SubmissionPayment {
  @Prop({
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  })
  status: 'pending' | 'completed' | 'failed' | 'refunded';

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop()
  transactionId?: string;

  @Prop({ required: true })
  gateway: string;

  @Prop()
  paidAt?: Date;

  @Prop({ type: Object })
  gatewayResponse?: Record<string, unknown>;
}

/**
 * Submitter information subdocument
 */
@Schema({ _id: false })
export class SubmitterInfo {
  @Prop({ type: Types.ObjectId })
  userId?: Types.ObjectId;

  @Prop()
  email?: string;

  @Prop()
  name?: string;

  @Prop({ required: true })
  ipAddress: string;

  @Prop({ required: true })
  userAgent: string;

  @Prop({
    type: {
      country: String,
      city: String,
      coordinates: [Number],
    },
  })
  location?: {
    country: string;
    city: string;
    coordinates: [number, number];
  };
}

/**
 * Processing status for integrations and notifications
 */
@Schema({ _id: false })
export class ProcessingStatus {
  @Prop({
    type: {
      sent: { type: Boolean, default: false },
      sentAt: Date,
      error: String,
    },
    default: () => ({ sent: false }),
  })
  notifications: {
    sent: boolean;
    sentAt?: Date;
    error?: string;
  };

  @Prop({
    type: [
      {
        type: String,
        processed: { type: Boolean, default: false },
        processedAt: Date,
        error: String,
      },
    ],
    default: [],
  })
  integrations: {
    type: string;
    processed: boolean;
    processedAt?: Date;
    error?: string;
  }[];
}

/**
 * Digital signature information
 */
@Schema({ _id: false })
export class DigitalSignature {
  @Prop({ required: true })
  fieldId: string;

  @Prop({ required: true })
  signatureData: string;

  @Prop({ default: Date.now })
  signedAt: Date;

  @Prop({
    type: {
      name: String,
      email: String,
      ipAddress: String,
    },
    required: true,
  })
  signerInfo: {
    name: string;
    email: string;
    ipAddress: string;
  };

  @Prop({
    type: [
      {
        timestamp: Date,
        action: String,
        details: String,
      },
    ],
    default: [],
  })
  auditTrail: {
    timestamp: Date;
    action: string;
    details: string;
  }[];
}

/**
 * Form Submission entity
 * Stores all submitted form data with comprehensive metadata
 */
@Schema({
  timestamps: true,
  collection: 'submissions',
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      delete ret.__v;
      return ret;
    },
  },
})
export class Submission {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Form', index: true })
  formId: Types.ObjectId;

  @Prop({ required: true, default: 1 })
  formVersion: number;

  @Prop({ type: Object, required: true })
  data: Record<string, unknown>;

  @Prop({ type: [SubmissionFile], default: [] })
  files: SubmissionFile[];

  @Prop({ type: SubmissionPayment })
  payment?: SubmissionPayment;

  @Prop({ required: true, unique: true })
  submissionId: string;

  @Prop({
    type: String,
    enum: ['draft', 'submitted', 'processed', 'archived'],
    default: 'submitted',
    index: true,
  })
  status: 'draft' | 'submitted' | 'processed' | 'archived';

  @Prop({
    type: String,
    enum: ['web', 'mobile', 'api', 'email', 'embed'],
    default: 'web',
  })
  source: 'web' | 'mobile' | 'api' | 'email' | 'embed';

  @Prop({ type: SubmitterInfo })
  submittedBy?: SubmitterInfo;

  @Prop({ type: ProcessingStatus, default: () => ({}) })
  processing: ProcessingStatus;

  @Prop({ type: [DigitalSignature], default: [] })
  signatures?: DigitalSignature[];

  @Prop({ default: Date.now, index: true })
  submittedAt: Date;

  @Prop({ index: true })
  deletedAt?: Date;

  // Virtual fields
}

export type SubmissionDocument = Submission & Document;
export const SubmissionSchema = SchemaFactory.createForClass(Submission);

// Indexes for optimal query performance
SubmissionSchema.index({ formId: 1, submittedAt: -1 });
SubmissionSchema.index({ formId: 1, status: 1, submittedAt: -1 });
SubmissionSchema.index({ submissionId: 1 }, { unique: true });
SubmissionSchema.index({ 'submittedBy.email': 1, formId: 1 });
SubmissionSchema.index({ 'payment.status': 1, 'payment.paidAt': -1 });
SubmissionSchema.index(
  { formId: 1, deletedAt: 1 },
  { partialFilterExpression: { deletedAt: { $exists: false } } },
);

// Pre-save middleware to generate unique submission ID
SubmissionSchema.pre('save', function (next) {
  if (!this.submissionId) {
    // Generate human-readable submission ID (SUB-YYYYMMDD-XXXXX)
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    this.submissionId = `SUB-${date}-${random}`;
  }
  next();
});
