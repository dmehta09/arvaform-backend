import { Types } from 'mongoose';

/**
 * Form element validation configuration
 */
export interface FormElementValidation {
  min?: number;
  max?: number;
  pattern?: string;
  required?: boolean;
  email?: boolean;
  url?: boolean;
  minLength?: number;
  maxLength?: number;
  minValue?: number;
  maxValue?: number;
  acceptedFormats?: string[];
  customRule?: {
    expression: string;
    message: string;
  };
}

/**
 * Form element properties specific to element types
 */
export interface FormElementProperties {
  // Text input properties
  multiline?: boolean;
  autoComplete?: string;

  // Select/dropdown properties
  allowMultiple?: boolean;
  searchable?: boolean;
  allowCustom?: boolean;

  // File upload properties
  allowMultipleFiles?: boolean;
  maxFileSize?: number;
  acceptedTypes?: string[];

  // Number input properties
  step?: number;

  // Date properties
  format?: string;
  minDate?: string;
  maxDate?: string;

  // Address properties
  includeCountry?: boolean;
  includeState?: boolean;
  includeZip?: boolean;

  // Payment and currency properties
  currency?: string;
  allowTip?: boolean;

  // Generic properties
  [key: string]: unknown;
}

/**
 * Form element styling configuration
 */
export interface FormElementStyles {
  width?: string;
  height?: string;
  margin?: string;
  padding?: string;
  borderRadius?: string;
  borderColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontSize?: string;
  fontWeight?: string;
  fontFamily?: string;
  alignment?: 'left' | 'center' | 'right';
  display?: 'block' | 'inline' | 'inline-block' | 'flex';
  [key: string]: unknown;
}

/**
 * Form condition trigger value types
 */
export type FormConditionValue = string | number | boolean | string[] | null;

/**
 * Form condition action value types
 */
export type FormConditionActionValue = string | number | boolean | Record<string, unknown> | null;

/**
 * Form integration configuration types
 */
export interface WebhookIntegrationConfig {
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  authentication?: {
    type: 'bearer' | 'basic' | 'api_key';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    headerName?: string;
  };
  mapping?: Record<string, string>;
}

export interface EmailIntegrationConfig {
  provider: 'smtp' | 'sendgrid' | 'mailgun' | 'ses';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  apiKey?: string;
  fromEmail: string;
  fromName: string;
  template: string;
}

export interface GoogleSheetsIntegrationConfig {
  spreadsheetId: string;
  worksheetName: string;
  credentials: Record<string, unknown>;
  mapping: Record<string, string>;
}

export interface SalesforceIntegrationConfig {
  instanceUrl: string;
  accessToken: string;
  objectType: string;
  fieldMapping: Record<string, string>;
}

export interface MailchimpIntegrationConfig {
  apiKey: string;
  listId: string;
  tags?: string[];
  fieldMapping: Record<string, string>;
}

export interface SlackIntegrationConfig {
  webhookUrl: string;
  channel: string;
  username?: string;
  iconEmoji?: string;
  template: string;
}

/**
 * Union type for all integration configurations
 */
export type FormIntegrationConfig =
  | WebhookIntegrationConfig
  | EmailIntegrationConfig
  | GoogleSheetsIntegrationConfig
  | SalesforceIntegrationConfig
  | MailchimpIntegrationConfig
  | SlackIntegrationConfig;

/**
 * Request interface for authenticated endpoints
 */
export interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    role?: string;
  };
}

/**
 * MongoDB ObjectId type
 */
export type ObjectId = Types.ObjectId;
