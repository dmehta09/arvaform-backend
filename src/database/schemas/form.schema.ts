import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

/**
 * Form Element subdocument schema
 * Represents individual form elements with their configuration
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
  description?: string;

  @Prop({ default: false })
  required: boolean;

  @Prop({
    type: {
      minLength: Number,
      maxLength: Number,
      pattern: String,
      customRules: [
        {
          rule: String,
          message: String,
        },
      ],
    },
    default: () => ({}),
  })
  validation: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    customRules?: Array<{
      rule: string;
      message: string;
    }>;
  };

  @Prop([
    {
      value: String,
      label: String,
      isDefault: Boolean,
    },
  ])
  options?: Array<{
    value: string;
    label: string;
    isDefault?: boolean;
  }>;

  @Prop({
    type: {
      widgetType: String,
      settings: MongooseSchema.Types.Mixed,
      customCSS: String,
    },
  })
  widgetConfig?: {
    widgetType: string;
    settings: Record<string, unknown>;
    customCSS?: string;
  };

  @Prop({
    type: {
      gateway: String,
      products: [
        {
          name: String,
          price: Number,
          description: String,
        },
      ],
      currency: String,
      settings: MongooseSchema.Types.Mixed,
    },
  })
  paymentConfig?: {
    gateway: string;
    products: Array<{
      name: string;
      price: number;
      description?: string;
    }>;
    currency: string;
    settings: Record<string, unknown>;
  };

  @Prop({
    type: {
      width: {
        type: String,
        enum: ['full', 'half', 'third', 'quarter'],
        default: 'full',
      },
      alignment: {
        type: String,
        enum: ['left', 'center', 'right'],
        default: 'left',
      },
      customCSS: String,
    },
    default: () => ({ width: 'full', alignment: 'left' }),
  })
  styling: {
    width: 'full' | 'half' | 'third' | 'quarter';
    alignment: 'left' | 'center' | 'right';
    customCSS?: string;
  };

  @Prop({ required: true })
  position: number;

  @Prop()
  pageId?: string;

  @Prop({
    type: {
      show: { type: Boolean, default: true },
      conditions: [String],
    },
    default: () => ({ show: true, conditions: [] }),
  })
  conditionalLogic: {
    show: boolean;
    conditions: string[];
  };
}

/**
 * Form Page subdocument schema
 * For multi-page forms organization
 */
@Schema({ _id: false })
export class FormPage {
  @Prop({ required: true })
  id: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop([String])
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
 * Conditional Logic Rule subdocument schema
 */
@Schema({ _id: false })
export class ConditionalRule {
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
    operator:
      | 'equals'
      | 'not_equals'
      | 'contains'
      | 'greater_than'
      | 'less_than'
      | 'is_empty'
      | 'is_not_empty';
    value: unknown;
  };

  @Prop([
    {
      type: {
        type: String,
        enum: ['show', 'hide', 'require', 'calculate', 'redirect', 'change_email', 'skip_page'],
      },
      targetId: String,
      value: MongooseSchema.Types.Mixed,
    },
  ])
  actions: Array<{
    type: 'show' | 'hide' | 'require' | 'calculate' | 'redirect' | 'change_email' | 'skip_page';
    targetId: string;
    value?: unknown;
  }>;

  @Prop({ default: true })
  isActive: boolean;
}

/**
 * Main Form document schema
 * Represents a complete form with all its configuration and elements
 */
@Schema({
  timestamps: true,
  collection: 'forms',
  versionKey: false,
})
export class Form extends Document {
  @Prop({
    required: true,
    minlength: 1,
    maxlength: 200,
    trim: true,
  })
  title: string;

  @Prop({
    maxlength: 1000,
    trim: true,
  })
  description?: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/,
  })
  slug: string;

  @Prop({
    required: true,
    enum: ['draft', 'published', 'archived', 'disabled'],
    default: 'draft',
    index: true,
  })
  status: 'draft' | 'published' | 'archived' | 'disabled';

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    index: true,
  })
  organizationId?: Types.ObjectId;

  @Prop([
    {
      userId: { type: MongooseSchema.Types.ObjectId, required: true },
      role: { type: String, enum: ['editor', 'viewer'], required: true },
      addedAt: { type: Date, default: Date.now },
      expiresAt: Date,
    },
  ])
  collaborators: Array<{
    userId: Types.ObjectId;
    role: 'editor' | 'viewer';
    addedAt: Date;
    expiresAt?: Date;
  }>;

  @Prop({
    type: {
      encryption: {
        enabled: { type: Boolean, default: false },
        algorithm: String,
      },
      layout: {
        type: String,
        enum: ['classic', 'card'],
        default: 'classic',
      },
      theme: {
        themeId: MongooseSchema.Types.ObjectId,
        customStyles: {
          css: String,
          variables: MongooseSchema.Types.Mixed,
        },
      },
      branding: {
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
    },
    default: () => ({
      encryption: { enabled: false },
      layout: 'classic',
    }),
  })
  settings: {
    encryption: {
      enabled: boolean;
      algorithm?: string;
    };
    layout: 'classic' | 'card';
    theme?: {
      themeId?: Types.ObjectId;
      customStyles?: {
        css: string;
        variables: Record<string, string>;
      };
    };
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
  };

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
    type: [ConditionalRule],
    default: [],
  })
  conditions: ConditionalRule[];

  @Prop({
    type: {
      thankYouPage: {
        type: { type: String, enum: ['default', 'custom', 'redirect'], default: 'default' },
        content: String,
        redirectUrl: String,
      },
      emails: {
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
    },
    default: () => ({
      thankYouPage: { type: 'default' },
      emails: {
        notifications: { enabled: false },
        autoresponder: { enabled: false },
      },
    }),
  })
  postSubmission: {
    thankYouPage: {
      type: 'default' | 'custom' | 'redirect';
      content?: string;
      redirectUrl?: string;
    };
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
  };

  @Prop([
    {
      type: {
        type: String,
        enum: ['webhook', 'email', 'google_sheets', 'salesforce', 'mailchimp', 'slack'],
      },
      config: MongooseSchema.Types.Mixed,
      isActive: { type: Boolean, default: true },
    },
  ])
  integrations: Array<{
    type: 'webhook' | 'email' | 'google_sheets' | 'salesforce' | 'mailchimp' | 'slack';
    config: Record<string, unknown>;
    isActive: boolean;
  }>;

  @Prop({
    type: {
      isPublished: { type: Boolean, default: false },
      publicUrl: { type: String, unique: true, sparse: true },
      embedCode: {
        script: String,
        iframe: String,
        wordpress: String,
      },
      sharing: {
        allowPublicAccess: { type: Boolean, default: true },
        requireLogin: { type: Boolean, default: false },
        expiresAt: Date,
      },
    },
    default: () => ({
      isPublished: false,
      sharing: {
        allowPublicAccess: true,
        requireLogin: false,
      },
    }),
  })
  publishing: {
    isPublished: boolean;
    publicUrl: string;
    embedCode: {
      script: string;
      iframe: string;
      wordpress: string;
    };
    sharing: {
      allowPublicAccess: boolean;
      requireLogin: boolean;
      expiresAt?: Date;
    };
  };

  @Prop({
    type: {
      views: { type: Number, default: 0 },
      submissions: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
      lastSubmissionAt: Date,
    },
    default: () => ({
      views: 0,
      submissions: 0,
      conversionRate: 0,
    }),
  })
  analytics: {
    views: number;
    submissions: number;
    conversionRate: number;
    lastSubmissionAt?: Date;
  };

  @Prop()
  publishedAt?: Date;

  @Prop()
  deletedAt?: Date;
}

export type FormDocument = Form & Document;
export const FormSchema = SchemaFactory.createForClass(Form);

// Indexes for optimal query performance
FormSchema.index({ userId: 1, status: 1, updatedAt: -1 }); // User forms by status
FormSchema.index({ slug: 1 }); // Unique slug lookup
FormSchema.index({ 'publishing.publicUrl': 1 }); // Public form access
FormSchema.index({ organizationId: 1, updatedAt: -1 }); // Organization forms
FormSchema.index({ 'collaborators.userId': 1 }); // Collaborative forms
FormSchema.index({ 'analytics.submissions': -1, createdAt: -1 }); // Popular forms
FormSchema.index({ title: 'text', description: 'text' }); // Text search

// Virtual for full public URL
FormSchema.virtual('fullPublicUrl').get(function () {
  return this.publishing?.publicUrl
    ? `${process.env.APP_URL}/f/${this.publishing.publicUrl}`
    : null;
});

// Method to calculate conversion rate
FormSchema.methods.updateConversionRate = function () {
  if (this.analytics.views > 0) {
    this.analytics.conversionRate = (this.analytics.submissions / this.analytics.views) * 100;
  }
  return this.analytics.conversionRate;
};
