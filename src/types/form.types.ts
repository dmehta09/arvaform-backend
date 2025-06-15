/**
 * Shared TypeScript type definitions for Form-related entities
 * These types can be used across the backend and shared with the frontend
 */

import { Types } from 'mongoose';

/**
 * Form Element Type definitions
 */
export type FormElementType =
  | 'text'
  | 'email'
  | 'number'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio'
  | 'file'
  | 'date'
  | 'address'
  | 'payment'
  | 'signature'
  | 'widget'
  | 'heading'
  | 'paragraph'
  | 'page_break';

export type FormStatus = 'draft' | 'published' | 'archived' | 'disabled';

export type FormLayout = 'classic' | 'card';

export type ConditionalOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export type ConditionalActionType =
  | 'show'
  | 'hide'
  | 'require'
  | 'calculate'
  | 'redirect'
  | 'change_email'
  | 'skip_page';

export type ThankYouPageType = 'default' | 'custom' | 'redirect';

export type IntegrationType =
  | 'webhook'
  | 'email'
  | 'google_sheets'
  | 'salesforce'
  | 'mailchimp'
  | 'slack';

export type ElementWidth = 'full' | 'half' | 'third' | 'quarter';

export type ElementAlignment = 'left' | 'center' | 'right';

export type CollaboratorRole = 'editor' | 'viewer';

/**
 * Form Element Validation Rules
 */
export interface ElementValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  customRules?: Array<{
    rule: string;
    message: string;
  }>;
}

/**
 * Form Element Option (for select, radio, checkbox)
 */
export interface ElementOption {
  value: string;
  label: string;
  isDefault?: boolean;
}

/**
 * Widget Configuration
 */
export interface WidgetConfig {
  widgetType: string;
  settings: Record<string, unknown>;
  customCSS?: string;
}

/**
 * Payment Configuration
 */
export interface PaymentConfig {
  gateway: string;
  products: Array<{
    name: string;
    price: number;
    description?: string;
  }>;
  currency: string;
  settings: Record<string, unknown>;
}

/**
 * Element Styling Configuration
 */
export interface ElementStyling {
  width: ElementWidth;
  alignment: ElementAlignment;
  customCSS?: string;
}

/**
 * Conditional Logic Configuration
 */
export interface ConditionalLogic {
  show: boolean;
  conditions: string[];
}

/**
 * Form Element Interface
 */
export interface IFormElement {
  id: string;
  type: FormElementType;
  label: string;
  placeholder?: string;
  description?: string;
  required: boolean;
  validation: ElementValidation;
  options?: ElementOption[];
  widgetConfig?: WidgetConfig;
  paymentConfig?: PaymentConfig;
  styling: ElementStyling;
  position: number;
  pageId?: string;
  conditionalLogic: ConditionalLogic;
}

/**
 * Form Page Navigation
 */
export interface PageNavigation {
  nextButton: {
    text: string;
    style?: string;
  };
  backButton: {
    text: string;
    style?: string;
  };
}

/**
 * Form Page Interface
 */
export interface IFormPage {
  id: string;
  title: string;
  description?: string;
  elements: string[];
  navigation: PageNavigation;
}

/**
 * Conditional Rule Trigger
 */
export interface ConditionalTrigger {
  elementId: string;
  operator: ConditionalOperator;
  value: unknown;
}

/**
 * Conditional Rule Action
 */
export interface ConditionalAction {
  type: ConditionalActionType;
  targetId: string;
  value?: unknown;
}

/**
 * Conditional Rule Interface
 */
export interface IConditionalRule {
  id: string;
  name: string;
  trigger: ConditionalTrigger;
  actions: ConditionalAction[];
  isActive: boolean;
}

/**
 * Form Collaborator
 */
export interface FormCollaborator {
  userId: Types.ObjectId;
  role: CollaboratorRole;
  addedAt: Date;
  expiresAt?: Date;
}

/**
 * Form Encryption Settings
 */
export interface EncryptionSettings {
  enabled: boolean;
  algorithm?: string;
}

/**
 * Form Theme Configuration
 */
export interface ThemeConfig {
  themeId?: Types.ObjectId;
  customStyles?: {
    css: string;
    variables: Record<string, string>;
  };
}

/**
 * Form Branding Configuration
 */
export interface BrandingConfig {
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
}

/**
 * Form Settings Interface
 */
export interface FormSettings {
  encryption: EncryptionSettings;
  layout: FormLayout;
  theme?: ThemeConfig;
  branding?: BrandingConfig;
}

/**
 * Email Configuration
 */
export interface EmailConfig {
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
}

/**
 * Thank You Page Configuration
 */
export interface ThankYouPageConfig {
  type: ThankYouPageType;
  content?: string;
  redirectUrl?: string;
}

/**
 * Post Submission Configuration
 */
export interface PostSubmissionConfig {
  thankYouPage: ThankYouPageConfig;
  emails: EmailConfig;
}

/**
 * Integration Configuration
 */
export interface IntegrationConfig {
  type: IntegrationType;
  config: Record<string, unknown>;
  isActive: boolean;
}

/**
 * Form Sharing Configuration
 */
export interface SharingConfig {
  allowPublicAccess: boolean;
  requireLogin: boolean;
  expiresAt?: Date;
}

/**
 * Form Embed Code
 */
export interface EmbedCode {
  script: string;
  iframe: string;
  wordpress: string;
}

/**
 * Form Publishing Configuration
 */
export interface PublishingConfig {
  isPublished: boolean;
  publicUrl: string;
  embedCode: EmbedCode;
  sharing: SharingConfig;
}

/**
 * Form Analytics
 */
export interface FormAnalytics {
  views: number;
  submissions: number;
  conversionRate: number;
  lastSubmissionAt?: Date;
}

/**
 * Main Form Interface
 */
export interface IForm {
  _id?: Types.ObjectId;
  title: string;
  description?: string;
  slug: string;
  status: FormStatus;
  userId: Types.ObjectId;
  organizationId?: Types.ObjectId;
  collaborators: FormCollaborator[];
  settings: FormSettings;
  elements: IFormElement[];
  pages: IFormPage[];
  conditions: IConditionalRule[];
  postSubmission: PostSubmissionConfig;
  integrations: IntegrationConfig[];
  publishing: PublishingConfig;
  analytics: FormAnalytics;
  publishedAt?: Date;
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Form Creation Data Transfer Object
 */
export interface CreateFormDto {
  title: string;
  description?: string;
  slug?: string;
  organizationId?: string;
}

/**
 * Form Update Data Transfer Object
 */
export interface UpdateFormDto {
  title?: string;
  description?: string;
  slug?: string;
  status?: FormStatus;
  settings?: Partial<FormSettings>;
  elements?: IFormElement[];
  pages?: IFormPage[];
  conditions?: IConditionalRule[];
  postSubmission?: Partial<PostSubmissionConfig>;
  integrations?: IntegrationConfig[];
  publishing?: Partial<PublishingConfig>;
}

/**
 * Form Query Parameters
 */
export interface FormQueryParams {
  status?: FormStatus;
  userId?: string;
  organizationId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Form Analytics Query Parameters
 */
export interface FormAnalyticsParams {
  formId: string;
  startDate?: Date;
  endDate?: Date;
  granularity?: 'hour' | 'day' | 'week' | 'month';
}
