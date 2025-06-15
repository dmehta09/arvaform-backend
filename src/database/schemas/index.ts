/**
 * Database schemas index file
 * Centralized exports for all MongoDB schemas used in the ArvaForm application
 *
 * This file serves as the single point of import for all database schemas,
 * making it easier to manage and import schemas throughout the application.
 */

// Import types first for internal use
import type { UserDocument, UserProfile } from '../../modules/users/schemas/user.schema';

import type { FormDocument, FormElement } from './form.schema';

import type { FormSubmissionDocument } from './submission.schema';

import type {
  OrganizationDocument,
  PermissionDocument,
  RoleDocument,
  UserPermissionDocument,
} from './permission.schema';

// User-related schemas
export {
  OAuthProvider,
  User,
  UserDocument,
  UserProfile,
  UserSchema,
  UserSubscription,
} from '../../modules/users/schemas/user.schema';

// Form-related schemas
export {
  ConditionalRule,
  Form,
  FormDocument,
  FormElement,
  FormPage,
  FormSchema,
} from './form.schema';

export {
  DigitalSignature,
  FileUpload,
  FormSubmission,
  FormSubmissionDocument,
  FormSubmissionSchema,
  IntegrationStatus,
  PaymentInfo,
  ProcessingInfo,
  SubmitterInfo,
} from './submission.schema';

// Permission and access control schemas
export {
  Organization,
  OrganizationDocument,
  OrganizationSchema,
  Permission,
  PermissionDocument,
  PermissionSchema,
  Role,
  RoleDocument,
  RoleSchema,
  UserPermission,
  UserPermissionDocument,
  UserPermissionSchema,
} from './permission.schema';

// Integration schemas
// export { Integration, IntegrationSchema } from './integration.schema';
// export { Webhook, WebhookSchema } from './webhook.schema';

// Analytics and tracking schemas
// export { Analytics, AnalyticsSchema } from './analytics.schema';
// export { FormView, FormViewSchema } from './form-view.schema';

/**
 * Schema types for better TypeScript integration
 * These types can be used throughout the application for type safety
 */
export type DatabaseSchemas = {
  // User-related types
  User: UserDocument;
  UserProfile: UserProfile;

  // Form-related types
  Form: FormDocument;
  FormElement: FormElement;
  FormSubmission: FormSubmissionDocument;

  // Permission types
  Permission: PermissionDocument;
  Role: RoleDocument;
  UserPermission: UserPermissionDocument;
  Organization: OrganizationDocument;

  // Integration types - to be implemented
  Integration: unknown;
  Webhook: unknown;

  // Analytics types - to be implemented
  Analytics: unknown;
  FormView: unknown;
};

/**
 * Schema collection names
 * Centralized definition of MongoDB collection names
 */
export const COLLECTION_NAMES = {
  USERS: 'users',
  FORMS: 'forms',
  FORM_SUBMISSIONS: 'form_submissions',
  PERMISSIONS: 'permissions',
  ROLES: 'roles',
  USER_PERMISSIONS: 'user_permissions',
  ORGANIZATIONS: 'organizations',
  INTEGRATIONS: 'integrations',
  WEBHOOKS: 'webhooks',
  ANALYTICS: 'analytics',
  FORM_VIEWS: 'form_views',
} as const;

/**
 * Index definitions for MongoDB collections
 * Centralized index management for performance optimization
 */
export const SCHEMA_INDEXES = {
  // User indexes
  users: [
    { fields: { email: 1 }, options: { unique: true } },
    { fields: { status: 1 }, options: {} },
    { fields: { createdAt: -1 }, options: {} },
    { fields: { 'oauthProviders.provider': 1, 'oauthProviders.providerId': 1 }, options: {} },
    { fields: { 'subscription.plan': 1, 'subscription.status': 1 }, options: {} },
  ],

  // Form indexes
  forms: [
    { fields: { userId: 1, status: 1, updatedAt: -1 }, options: {} },
    { fields: { slug: 1 }, options: { unique: true } },
    { fields: { 'publishing.publicUrl': 1 }, options: { unique: true, sparse: true } },
    { fields: { organizationId: 1, updatedAt: -1 }, options: {} },
    { fields: { 'collaborators.userId': 1 }, options: {} },
    { fields: { 'analytics.submissions': -1, createdAt: -1 }, options: {} },
  ],

  // Form submission indexes
  form_submissions: [
    { fields: { formId: 1, submittedAt: -1 }, options: {} },
    { fields: { formId: 1, status: 1, submittedAt: -1 }, options: {} },
    { fields: { submissionId: 1 }, options: { unique: true } },
    { fields: { 'submittedBy.email': 1, formId: 1 }, options: {} },
    { fields: { 'submittedBy.userId': 1 }, options: { sparse: true } },
    { fields: { 'payment.status': 1, 'payment.paidAt': -1 }, options: { sparse: true } },
  ],

  // Permission indexes
  permissions: [
    { fields: { name: 1 }, options: { unique: true } },
    { fields: { category: 1, action: 1 }, options: {} },
    { fields: { tier: 1, isActive: 1 }, options: {} },
  ],

  // Role indexes
  roles: [
    { fields: { name: 1 }, options: { unique: true } },
    { fields: { type: 1, tier: 1, isActive: 1 }, options: {} },
  ],

  // User permission indexes
  user_permissions: [
    { fields: { userId: 1, type: 1, isActive: 1 }, options: {} },
    { fields: { userId: 1, 'context.resourceType': 1, 'context.resourceId': 1 }, options: {} },
    { fields: { expiresAt: 1 }, options: { sparse: true } },
  ],

  // Organization indexes
  organizations: [
    { fields: { slug: 1 }, options: { unique: true } },
    { fields: { ownerId: 1 }, options: {} },
    { fields: { 'members.userId': 1 }, options: {} },
    { fields: { status: 1 }, options: {} },
  ],

  // Analytics indexes
  analytics: [
    { fields: { formId: 1 }, options: {} },
    { fields: { timestamp: -1 }, options: {} },
    { fields: { eventType: 1 }, options: {} },
    { fields: { formId: 1, timestamp: -1 }, options: {} },
  ],
} as const;

/**
 * Schema validation patterns
 * Common validation patterns used across schemas
 */
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  URL: /^https?:\/\/.+/,
  SLUG: /^[a-z0-9-]+$/,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  MONGODB_OBJECT_ID: /^[0-9a-fA-F]{24}$/,
  SUBMISSION_ID: /^SUB-[A-Z0-9]{8}$/,
  PERMISSION_NAME: /^[A-Z_]+$/,
  ROLE_NAME: /^[a-z_]+$/,
} as const;

/**
 * Default schema options
 * Standard options applied to all schemas
 */
export const DEFAULT_SCHEMA_OPTIONS = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: (doc: unknown, ret: Record<string, unknown>) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
  toObject: {
    virtuals: true,
    transform: (doc: unknown, ret: Record<string, unknown>) => {
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
} as const;

/**
 * Schema middleware helpers
 * Common pre/post hooks that can be applied to schemas
 */
export const SCHEMA_MIDDLEWARE = {
  // Soft delete middleware
  softDelete: {
    find: function () {
      return this.where({ deletedAt: { $exists: false } });
    },
    findOne: function () {
      return this.where({ deletedAt: { $exists: false } });
    },
    findOneAndUpdate: function () {
      return this.where({ deletedAt: { $exists: false } });
    },
  },

  // Update timestamps
  updateTimestamp: function () {
    this.set({ updatedAt: new Date() });
  },

  // Generate slug from title
  generateSlug: function (title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  },
} as const;
