import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import {
  FormConditionActionValue,
  FormConditionValue,
  FormElementProperties,
  FormElementStyles,
  FormElementValidation,
  FormIntegrationConfig,
} from '../types/form.types';

export type FormDocument = Form & Document;

/**
 * Form Element subdocument schema
 * Represents individual form elements (inputs, buttons, etc.)
 */
@Schema({ _id: false })
export class FormElement {
  @Prop({ required: true })
  id: string;

  @Prop({
    required: true,
    enum: [
      'text',
      'email',
      'number',
      'textarea',
      'select',
      'checkbox',
      'radio',
      'file',
      'date',
      'address',
      'payment',
      'signature',
      'widget',
      'heading',
      'paragraph',
      'page_break',
    ],
  })
  type: string;

  @Prop({ required: true })
  label: string;

  @Prop()
  placeholder?: string;

  @Prop()
  helpText?: string;

  @Prop({ default: false })
  required: boolean;

  @Prop({ type: MongooseSchema.Types.Mixed })
  validation?: FormElementValidation;

  @Prop({ type: MongooseSchema.Types.Mixed })
  properties?: FormElementProperties;

  @Prop({ type: MongooseSchema.Types.Mixed })
  styles?: FormElementStyles;

  @Prop({ type: [String], default: [] })
  options: string[];

  @Prop({ default: 0 })
  order: number;

  @Prop()
  parentId?: string;

  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;
}

/**
 * Form Page subdocument schema
 * For multi-page forms
 */
@Schema({ _id: false })
export class FormPage {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ type: [String], default: [] })
  elements: string[];

  @Prop({
    type: {
      nextButton: {
        text: { type: String, default: 'Next' },
        style: String,
      },
      backButton: {
        text: { type: String, default: 'Back' },
        style: String,
      },
    },
    default: () => ({
      nextButton: { text: 'Next' },
      backButton: { text: 'Back' },
    }),
  })
  navigation: {
    nextButton: {
      text: string;
      style?: string;
    };
    backButton: {
      text: string;
      style?: string;
    };
  };
}

/**
 * Form Condition subdocument schema
 * For conditional logic and form flow control
 */
@Schema({ _id: false })
export class FormCondition {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({
    type: {
      elementId: { type: String, required: true },
      operator: {
        type: String,
        required: true,
        enum: [
          'equals',
          'not_equals',
          'contains',
          'greater_than',
          'less_than',
          'is_empty',
          'is_not_empty',
        ],
      },
      value: MongooseSchema.Types.Mixed,
    },
    required: true,
  })
  trigger: {
    elementId: string;
    operator: string;
    value: FormConditionValue;
  };

  @Prop({
    type: [
      {
        type: {
          type: String,
          required: true,
          enum: ['show', 'hide', 'require', 'calculate', 'redirect', 'change_email', 'skip_page'],
        },
        targetId: { type: String, required: true },
        value: MongooseSchema.Types.Mixed,
      },
    ],
    default: [],
  })
  actions: {
    type: string;
    targetId: string;
    value?: FormConditionActionValue;
  }[];

  @Prop({ default: true })
  isActive: boolean;
}

/**
 * Collaborator subdocument schema
 * For form collaboration features
 */
@Schema({ _id: false })
export class FormCollaborator {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['editor', 'viewer'],
  })
  role: 'editor' | 'viewer';

  @Prop({ type: Date, default: Date.now })
  addedAt: Date;

  @Prop()
  expiresAt?: Date;
}

/**
 * Form Settings subdocument schema
 */
@Schema({ _id: false })
export class FormSettings {
  @Prop({
    type: {
      enabled: { type: Boolean, default: false },
      algorithm: String,
    },
    default: () => ({ enabled: false }),
  })
  encryption: {
    enabled: boolean;
    algorithm?: string;
  };

  @Prop({
    enum: ['classic', 'card'],
    default: 'classic',
  })
  layout: 'classic' | 'card';

  @Prop({
    type: {
      themeId: { type: MongooseSchema.Types.ObjectId, ref: 'Theme' },
      customStyles: {
        css: String,
        variables: { type: Map, of: String },
      },
    },
  })
  theme: {
    themeId?: Types.ObjectId;
    customStyles?: {
      css: string;
      variables: Map<string, string>;
    };
  };

  @Prop({
    type: {
      logo: {
        url: String,
        alt: String,
        width: Number,
        height: Number,
      },
      colors: {
        primary: String,
        secondary: String,
        accent: String,
      },
    },
  })
  branding?: {
    logo?: {
      url: string;
      alt: string;
      width?: number;
      height?: number;
    };
    colors?: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
}

/**
 * Post Submission Configuration subdocument schema
 */
@Schema({ _id: false })
export class PostSubmissionConfig {
  @Prop({
    type: {
      type: {
        type: String,
        enum: ['default', 'custom', 'redirect'],
        default: 'default',
      },
      content: String,
      redirectUrl: String,
    },
    default: () => ({ type: 'default' }),
  })
  thankYouPage: {
    type: 'default' | 'custom' | 'redirect';
    content?: string;
    redirectUrl?: string;
  };

  @Prop({
    type: {
      notifications: {
        enabled: { type: Boolean, default: false },
        recipients: [String],
        template: String,
        subject: String,
      },
      autoresponder: {
        enabled: { type: Boolean, default: false },
        template: String,
        subject: String,
        fromEmail: String,
        fromName: String,
      },
    },
    default: () => ({
      notifications: { enabled: false, recipients: [] },
      autoresponder: { enabled: false },
    }),
  })
  emails: {
    notifications: {
      enabled: boolean;
      recipients: string[];
      template: string;
      subject: string;
    };
    autoresponder: {
      enabled: boolean;
      template: string;
      subject: string;
      fromEmail: string;
      fromName: string;
    };
  };
}

/**
 * Form Integration subdocument schema
 */
@Schema({ _id: false })
export class FormIntegration {
  @Prop({
    required: true,
    enum: ['webhook', 'email', 'google_sheets', 'salesforce', 'mailchimp', 'slack'],
  })
  type: 'webhook' | 'email' | 'google_sheets' | 'salesforce' | 'mailchimp' | 'slack';

  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  config: FormIntegrationConfig;

  @Prop({ default: true })
  isActive: boolean;
}

/**
 * Form Publishing Configuration subdocument schema
 * Controls form publication and access settings
 */
@Schema({ _id: false })
export class FormPublishingConfig {
  @Prop({ default: false })
  isPublished: boolean;

  @Prop()
  publicUrl: string;

  @Prop({
    type: {
      script: String,
      iframe: String,
      wordpress: String,
    },
  })
  embedCode: {
    script: string;
    iframe: string;
    wordpress: string;
  };

  @Prop({
    type: {
      allowPublicAccess: { type: Boolean, default: true },
      requireLogin: { type: Boolean, default: false },
      expiresAt: Date,
    },
    default: () => ({
      allowPublicAccess: true,
      requireLogin: false,
    }),
  })
  sharing: {
    allowPublicAccess: boolean;
    requireLogin: boolean;
    expiresAt?: Date;
  };

  @Prop()
  metaTitle?: string;

  @Prop()
  metaDescription?: string;

  @Prop({ type: [String], default: [] })
  allowedDomains: string[];
}

/**
 * Form Analytics subdocument schema
 */
@Schema({ _id: false })
export class FormAnalytics {
  @Prop({ default: 0 })
  views: number;

  @Prop({ default: 0 })
  submissions: number;

  @Prop({ default: 0 })
  conversionRate: number;

  @Prop()
  lastSubmissionAt?: Date;
}

/**
 * Enhanced Form document schema
 * Represents a complete form with all its elements, configuration, and metadata
 */
@Schema({
  timestamps: true,
  collection: 'forms',
  versionKey: false,
})
export class Form extends Document {
  @Prop({
    required: true,
    trim: true,
    maxlength: 255,
  })
  title: string;

  @Prop({
    trim: true,
    maxlength: 1000,
  })
  description?: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    index: true,
  })
  slug: string;

  @Prop({
    required: true,
    enum: ['draft', 'published', 'archived', 'disabled'],
    default: 'draft',
    index: true,
  })
  status: 'draft' | 'published' | 'archived' | 'disabled';

  // Ownership and collaboration
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Organization',
    index: true,
  })
  organizationId?: Types.ObjectId;

  @Prop({
    type: [FormCollaborator],
    default: [],
  })
  collaborators: FormCollaborator[];

  // Form configuration and structure
  @Prop({
    type: FormSettings,
    default: () => ({
      encryption: { enabled: false },
      layout: 'classic',
    }),
  })
  settings: FormSettings;

  @Prop({
    type: [FormElement],
    default: [],
  })
  elements: FormElement[];

  @Prop({
    type: [FormPage],
    default: [],
  })
  pages: FormPage[];

  @Prop({
    type: [FormCondition],
    default: [],
  })
  conditions: FormCondition[];

  @Prop({
    type: PostSubmissionConfig,
    default: () => ({
      thankYouPage: { type: 'default' },
      emails: {
        notifications: { enabled: false, recipients: [] },
        autoresponder: { enabled: false },
      },
    }),
  })
  postSubmission: PostSubmissionConfig;

  @Prop({
    type: [FormIntegration],
    default: [],
  })
  integrations: FormIntegration[];

  @Prop({
    type: FormPublishingConfig,
    default: () => ({
      isPublished: false,
      sharing: {
        allowPublicAccess: true,
        requireLogin: false,
      },
    }),
  })
  publishing: FormPublishingConfig;

  @Prop({
    type: FormAnalytics,
    default: () => ({
      views: 0,
      submissions: 0,
      conversionRate: 0,
    }),
  })
  analytics: FormAnalytics;

  // Soft delete
  @Prop()
  deletedAt?: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
  })
  deletedBy?: Types.ObjectId;
}

// Create the schema
export const FormSchema = SchemaFactory.createForClass(Form);

// Add indexes for performance
FormSchema.index({ userId: 1, status: 1 });
FormSchema.index({ slug: 1 }, { unique: true });
FormSchema.index({ createdAt: -1 });
FormSchema.index({ updatedAt: -1 });
FormSchema.index({ 'publishing.isPublished': 1 });
FormSchema.index({ deletedAt: 1 });

// Text search index for form title and description
FormSchema.index({
  title: 'text',
  description: 'text',
});

// Compound index for efficient querying
FormSchema.index({
  userId: 1,
  status: 1,
  createdAt: -1,
});

// Pre-save middleware to update the updatedAt timestamp for embedded elements
FormSchema.pre('save', function (this: FormDocument, next) {
  if (this.isModified('elements')) {
    this.elements.forEach((element: FormElement) => {
      element.updatedAt = new Date();
    });
  }
  next();
});

// Virtual for public URL generation
FormSchema.virtual('publicUrl').get(function () {
  return this.publishing?.isPublished ? `/forms/${this.slug}` : null;
});

// Ensure virtual fields are serialized
FormSchema.set('toJSON', { virtuals: true });
FormSchema.set('toObject', { virtuals: true });
