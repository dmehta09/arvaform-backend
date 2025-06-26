import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Email Template Version
 * Represents a specific version of an email template for change management
 */
export interface EmailTemplateVersion {
  /** Version number (semantic versioning) */
  version: string;
  /** Template content for this version */
  content: string;
  /** MJML source for responsive design */
  mjmlSource?: string;
  /** Template variables for this version */
  variables: string[];
  /** Creation timestamp */
  createdAt: Date;
  /** User who created this version */
  createdBy: string;
  /** Change description */
  changeDescription?: string;
  /** Whether this version is active */
  isActive: boolean;
}

/**
 * Template Variable Definition
 * Defines available variables for template personalization
 */
export interface TemplateVariable {
  /** Variable name (used in template) */
  name: string;
  /** Variable type for validation */
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  /** Human-readable description */
  description: string;
  /** Whether this variable is required */
  required: boolean;
  /** Default value if not provided */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValue?: any;
  /** Validation pattern for string types */
  pattern?: string;
  /** Possible values for enum-like variables */
  enumValues?: string[];
}

/**
 * Template Analytics Data
 * Tracks template usage and performance metrics
 */
export interface TemplateAnalytics {
  /** Total number of times sent */
  sendCount: number;
  /** Last sent timestamp */
  lastSent?: Date;
  /** Success rate percentage */
  successRate: number;
  /** Open rate percentage */
  openRate: number;
  /** Click rate percentage */
  clickRate: number;
  /** Bounce rate percentage */
  bounceRate: number;
  /** Monthly sending stats */
  monthlyStats: Array<{
    month: string;
    sendCount: number;
    successRate: number;
  }>;
}

/**
 * Email Template Document
 * MongoDB document for storing email templates with versioning and analytics
 */
@Schema({
  collection: 'email_templates',
  timestamps: true,
  versionKey: false,
})
export class EmailTemplate {
  /** Unique template identifier */
  @Prop({
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: /^[a-z0-9-_]+$/,
    maxlength: 100,
  })
  templateId: string;

  /** Human-readable template name */
  @Prop({
    required: true,
    trim: true,
    maxlength: 200,
  })
  name: string;

  /** Template description */
  @Prop({
    trim: true,
    maxlength: 1000,
  })
  description?: string;

  /** Template category for organization */
  @Prop({
    required: true,
    enum: [
      'form-submission',
      'welcome',
      'password-reset',
      'notification',
      'marketing',
      'transactional',
      'system',
      'custom',
    ],
  })
  category: string;

  /** Template subject line with variable support */
  @Prop({
    required: true,
    trim: true,
    maxlength: 300,
  })
  subject: string;

  /** Current active template content (compiled HTML) */
  @Prop({
    required: true,
  })
  content: string;

  /** MJML source for responsive design */
  @Prop()
  mjmlSource?: string;

  /** Handlebars template source */
  @Prop({
    required: true,
  })
  handlebarsSource: string;

  /** Available template variables */
  @Prop({
    type: [Object],
    default: [],
  })
  variables: TemplateVariable[];

  /** Template versions for change management */
  @Prop({
    type: [Object],
    default: [],
  })
  versions: EmailTemplateVersion[];

  /** Current version identifier */
  @Prop({
    required: true,
    default: '1.0.0',
  })
  currentVersion: string;

  /** Template language for i18n support */
  @Prop({
    required: true,
    default: 'en',
    enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
  })
  language: string;

  /** Template localization data */
  @Prop({
    type: Map,
    of: String,
    default: {},
  })
  localizations: Map<string, string>;

  /** Whether template is active */
  @Prop({
    required: true,
    default: true,
  })
  isActive: boolean;

  /** Whether template is system-managed (cannot be deleted) */
  @Prop({
    required: true,
    default: false,
  })
  isSystem: boolean;

  /** Template owner (user ID) */
  @Prop({
    required: true,
    type: Types.ObjectId,
    ref: 'User',
  })
  ownerId: Types.ObjectId;

  /** Template tags for categorization */
  @Prop({
    type: [String],
    default: [],
    validate: {
      validator: (tags: string[]) => tags.length <= 10,
      message: 'Maximum 10 tags allowed',
    },
  })
  tags: string[];

  /** Template usage analytics */
  @Prop({
    type: Object,
    default: () => ({
      sendCount: 0,
      successRate: 0,
      openRate: 0,
      clickRate: 0,
      bounceRate: 0,
      monthlyStats: [],
    }),
  })
  analytics: TemplateAnalytics;

  /** Template compilation cache */
  @Prop()
  compiledTemplate?: string;

  /** Last compilation timestamp */
  @Prop()
  lastCompiled?: Date;

  /** Template validation errors */
  @Prop({
    type: [String],
    default: [],
  })
  validationErrors: string[];

  /** Template security scan results */
  @Prop({
    type: Object,
    default: () => ({
      lastScanned: null,
      isSecure: true,
      securityIssues: [],
    }),
  })
  securityScan: {
    lastScanned?: Date;
    isSecure: boolean;
    securityIssues: string[];
  };

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

export type EmailTemplateDocument = EmailTemplate & Document;

export const EmailTemplateSchema = SchemaFactory.createForClass(EmailTemplate);

// Add indexes for performance
EmailTemplateSchema.index({ templateId: 1 }, { unique: true });
EmailTemplateSchema.index({ ownerId: 1 });
EmailTemplateSchema.index({ category: 1 });
EmailTemplateSchema.index({ language: 1 });
EmailTemplateSchema.index({ tags: 1 });
EmailTemplateSchema.index({ isActive: 1 });
EmailTemplateSchema.index({ createdAt: -1 });

// Add compound indexes
EmailTemplateSchema.index({ ownerId: 1, category: 1 });
EmailTemplateSchema.index({ ownerId: 1, isActive: 1 });

// Pre-save middleware for validation
EmailTemplateSchema.pre('save', function (next) {
  // Ensure templateId is URL-safe
  if (this.templateId) {
    this.templateId = this.templateId
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Update compilation timestamp
  if (this.isModified('handlebarsSource') || this.isModified('mjmlSource')) {
    this.lastCompiled = new Date();
  }

  next();
});

// Virtual for template age
EmailTemplateSchema.virtual('age').get(function () {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for usage frequency
EmailTemplateSchema.virtual('usageFrequency').get(function () {
  const ageInDays =
    Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24)) || 1;
  return this.analytics.sendCount / ageInDays;
});
