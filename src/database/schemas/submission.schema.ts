import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

/**
 * File Upload subdocument schema
 * Stores information about uploaded files in form submissions
 */
@Schema({ _id: false })
export class FileUpload {
  @Prop({ required: true })
  fieldId: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  mimetype: string;

  @Prop({ required: true, min: 0 })
  size: number;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true, default: Date.now })
  uploadedAt: Date;
}

/**
 * Payment Information subdocument schema
 * Stores payment-related data for form submissions with payment elements
 */
@Schema({ _id: false })
export class PaymentInfo {
  @Prop({
    required: true,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending',
  })
  status: 'pending' | 'completed' | 'failed' | 'refunded';

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, length: 3 })
  currency: string;

  @Prop({ required: true })
  transactionId: string;

  @Prop({ required: true })
  gateway: string;

  @Prop()
  paidAt?: Date;
}

/**
 * Submission Source Information subdocument schema
 * Captures information about who submitted the form and from where
 */
@Schema({ _id: false })
export class SubmitterInfo {
  @Prop({ type: MongooseSchema.Types.ObjectId })
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
 * Integration Processing Status subdocument schema
 * Tracks the processing status of various integrations for this submission
 */
@Schema({ _id: false })
export class IntegrationStatus {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true, default: false })
  processed: boolean;

  @Prop()
  processedAt?: Date;

  @Prop()
  error?: string;
}

/**
 * Processing Information subdocument schema
 * Tracks various processing steps for the submission
 */
@Schema({ _id: false })
export class ProcessingInfo {
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
    type: [IntegrationStatus],
    default: [],
  })
  integrations: IntegrationStatus[];
}

/**
 * E-Signature subdocument schema
 * Stores digital signature information for forms with signature fields
 */
@Schema({ _id: false })
export class DigitalSignature {
  @Prop({ required: true })
  fieldId: string;

  @Prop({ required: true })
  signatureData: string; // Base64 encoded signature image

  @Prop({ required: true, default: Date.now })
  signedAt: Date;

  @Prop({
    type: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      ipAddress: { type: String, required: true },
    },
    required: true,
  })
  signerInfo: {
    name: string;
    email: string;
    ipAddress: string;
  };

  @Prop([
    {
      timestamp: { type: Date, required: true },
      action: { type: String, required: true },
      details: { type: String, required: true },
    },
  ])
  auditTrail: Array<{
    timestamp: Date;
    action: string;
    details: string;
  }>;
}

/**
 * Main Form Submission document schema
 * Represents a complete form submission with all associated data and metadata
 */
@Schema({
  timestamps: true,
  collection: 'form_submissions',
  versionKey: false,
})
export class FormSubmission extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'Form',
  })
  formId: Types.ObjectId;

  @Prop({ required: true, default: 1, min: 1 })
  formVersion: number;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: true,
  })
  data: Record<string, unknown>; // Dynamic form field data

  @Prop({
    type: [FileUpload],
    default: [],
  })
  files: FileUpload[];

  @Prop({
    type: PaymentInfo,
  })
  payment?: PaymentInfo;

  @Prop({
    required: true,
    unique: true,
    match: /^SUB-[A-Z0-9]{8}$/,
  })
  submissionId: string; // Human-readable ID like SUB-AB12CD34

  @Prop({
    required: true,
    enum: ['draft', 'submitted', 'processed', 'archived'],
    default: 'submitted',
    index: true,
  })
  status: 'draft' | 'submitted' | 'processed' | 'archived';

  @Prop({
    required: true,
    enum: ['web', 'mobile', 'api', 'email', 'embed'],
    default: 'web',
  })
  source: 'web' | 'mobile' | 'api' | 'email' | 'embed';

  @Prop({
    type: SubmitterInfo,
  })
  submittedBy?: SubmitterInfo;

  @Prop({
    type: ProcessingInfo,
    default: () => ({
      notifications: { sent: false },
      integrations: [],
    }),
  })
  processing: ProcessingInfo;

  @Prop({
    type: [DigitalSignature],
    default: [],
  })
  signatures: DigitalSignature[];

  @Prop({ required: true, default: Date.now, index: true })
  submittedAt: Date;

  @Prop()
  deletedAt?: Date;
}

export type FormSubmissionDocument = FormSubmission & Document;
export const FormSubmissionSchema = SchemaFactory.createForClass(FormSubmission);

// Indexes for optimal query performance
FormSubmissionSchema.index({ formId: 1, submittedAt: -1 }); // Form submissions by date
FormSubmissionSchema.index({ formId: 1, status: 1, submittedAt: -1 }); // Form submissions by status
FormSubmissionSchema.index({ submissionId: 1 }); // Unique submission lookup
FormSubmissionSchema.index({ 'submittedBy.email': 1, formId: 1 }); // User submissions
FormSubmissionSchema.index({ 'submittedBy.userId': 1 }, { sparse: true }); // Authenticated user submissions
FormSubmissionSchema.index({ createdAt: 1 }); // Time-based analytics
FormSubmissionSchema.index({ 'payment.status': 1, 'payment.paidAt': -1 }, { sparse: true }); // Payment analytics

// Partial index for non-deleted submissions (performance optimization)
FormSubmissionSchema.index(
  { formId: 1, deletedAt: 1 },
  { partialFilterExpression: { deletedAt: { $exists: false } } },
);

// Method to generate human-readable submission ID
FormSubmissionSchema.statics.generateSubmissionId = function (): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'SUB-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Virtual for submission age in days
FormSubmissionSchema.virtual('ageInDays').get(function () {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - this.submittedAt.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to mark submission as processed
FormSubmissionSchema.methods.markAsProcessed = function () {
  this.status = 'processed';
  this.processing.notifications.sent = true;
  this.processing.notifications.sentAt = new Date();
  return this.save();
};
