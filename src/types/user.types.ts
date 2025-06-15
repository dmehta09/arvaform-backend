/**
 * Shared TypeScript type definitions for User-related entities
 * These types can be used across the backend and shared with the frontend
 */

import { Types } from 'mongoose';

/**
 * User Status definitions
 */
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

/**
 * OAuth Provider definitions
 */
export type OAuthProviderType = 'google' | 'github' | 'facebook' | 'microsoft';

/**
 * Subscription Plan definitions
 */
export type SubscriptionPlan = 'free' | 'basic' | 'premium' | 'enterprise';

/**
 * Subscription Status definitions
 */
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trial' | 'expired';

/**
 * Organization Role definitions
 */
export type OrganizationRole = 'admin' | 'member';

/**
 * Permission Category definitions
 */
export type PermissionCategory =
  | 'form'
  | 'submission'
  | 'user'
  | 'integration'
  | 'analytics'
  | 'system';

/**
 * Permission Action definitions
 */
export type PermissionAction = 'create' | 'read' | 'update' | 'delete' | 'admin';

/**
 * Role Type definitions
 */
export type RoleType = 'system' | 'organization' | 'custom';

/**
 * Permission Tier definitions
 */
export type PermissionTier = 'basic' | 'premium' | 'enterprise';

/**
 * Resource Type definitions for permissions
 */
export type ResourceType = 'form' | 'organization' | 'global';

/**
 * User Address Interface
 */
export interface UserAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

/**
 * User Notification Preferences
 */
export interface NotificationPreferences {
  marketing: boolean;
  security: boolean;
  updates: boolean;
}

/**
 * User Profile Interface
 */
export interface IUserProfile {
  avatar?: string;
  bio?: string;
  company?: string;
  jobTitle?: string;
  website?: string;
  phoneNumber?: string;
  address?: UserAddress;
  timezone?: string;
  language?: string;
  notifications: NotificationPreferences;
}

/**
 * OAuth Provider Information
 */
export interface IOAuthProvider {
  provider: OAuthProviderType;
  providerId: string;
  email: string;
  name?: string;
  avatar?: string;
  connectedAt: Date;
  accessToken?: string; // Encrypted in storage
  refreshToken?: string; // Encrypted in storage
  expiresAt?: Date;
}

/**
 * Subscription Limits
 */
export interface SubscriptionLimits {
  forms: number;
  submissions: number;
  storage: number; // MB
  integrations: number;
}

/**
 * Subscription Usage
 */
export interface SubscriptionUsage {
  forms: number;
  submissions: number;
  storage: number; // MB
  integrations: number;
}

/**
 * User Subscription Interface
 */
export interface IUserSubscription {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  trialEnd?: Date;
  limits: SubscriptionLimits;
  usage: SubscriptionUsage;
}

/**
 * Main User Interface
 */
export interface IUser {
  _id?: Types.ObjectId;
  email: string;
  password?: string; // Excluded in most responses
  firstName: string;
  lastName: string;
  profile: IUserProfile;
  oauthProviders: IOAuthProvider[];
  subscription: IUserSubscription;
  status: UserStatus;
  loginAttempts: number;
  lockUntil?: Date;
  lastLoginAt?: Date;
  lastActiveAt?: Date;
  refreshTokens?: string[]; // Excluded in responses
  isEmailVerified: boolean;
  emailVerificationToken?: string; // Excluded in responses
  emailVerificationExpires?: Date; // Excluded in responses
  passwordResetToken?: string; // Excluded in responses
  passwordResetExpires?: Date; // Excluded in responses
  twoFactorEnabled: boolean;
  twoFactorSecret?: string; // Excluded in responses
  twoFactorBackupCodes?: string[]; // Excluded in responses
  organizations: Types.ObjectId[];
  privacyPolicyAcceptedAt?: Date;
  termsOfServiceAcceptedAt?: Date;
  marketingOptIn?: boolean;
  dataRetentionOptOut?: boolean;
  deletedAt?: Date;
  deletedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * User Registration Data Transfer Object
 */
export interface RegisterUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  marketingOptIn?: boolean;
}

/**
 * User Login Data Transfer Object
 */
export interface LoginUserDto {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * User Profile Update Data Transfer Object
 */
export interface UpdateUserProfileDto {
  firstName?: string;
  lastName?: string;
  profile?: Partial<IUserProfile>;
  marketingOptIn?: boolean;
  dataRetentionOptOut?: boolean;
}

/**
 * Password Change Data Transfer Object
 */
export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Email Verification Data Transfer Object
 */
export interface VerifyEmailDto {
  token: string;
}

/**
 * Password Reset Request Data Transfer Object
 */
export interface RequestPasswordResetDto {
  email: string;
}

/**
 * Password Reset Data Transfer Object
 */
export interface ResetPasswordDto {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/**
 * Two-Factor Authentication Setup Data Transfer Object
 */
export interface Setup2FADto {
  secret: string;
  token: string;
}

/**
 * Two-Factor Authentication Verification Data Transfer Object
 */
export interface Verify2FADto {
  token: string;
}

/**
 * OAuth Connection Data Transfer Object
 */
export interface ConnectOAuthDto {
  provider: OAuthProviderType;
  code: string;
  state?: string;
}

/**
 * Permission Interface
 */
export interface IPermission {
  _id?: Types.ObjectId;
  name: string;
  description: string;
  category: PermissionCategory;
  action: PermissionAction;
  tier: PermissionTier;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Role Interface
 */
export interface IRole {
  _id?: Types.ObjectId;
  name: string;
  displayName: string;
  description?: string;
  permissions: Types.ObjectId[];
  type: RoleType;
  tier: PermissionTier;
  isActive: boolean;
  createdBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Permission Context Interface
 */
export interface PermissionContext {
  resourceType: ResourceType;
  resourceId?: Types.ObjectId;
}

/**
 * User Permission Assignment Interface
 */
export interface IUserPermission {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  roleId?: Types.ObjectId;
  permissionId?: Types.ObjectId;
  type: 'role' | 'permission';
  context?: PermissionContext;
  grantedBy: Types.ObjectId;
  expiresAt?: Date;
  isActive: boolean;
  revokedAt?: Date;
  revokedBy?: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Organization Profile Interface
 */
export interface OrganizationProfile {
  logo?: string;
  website?: string;
  address?: UserAddress;
}

/**
 * Organization Subscription Interface
 */
export interface OrganizationSubscription {
  plan: SubscriptionPlan;
  limits: SubscriptionLimits;
  features: string[];
}

/**
 * Organization Member Interface
 */
export interface OrganizationMember {
  userId: Types.ObjectId;
  role: OrganizationRole;
  joinedAt: Date;
  invitedBy?: Types.ObjectId;
}

/**
 * Organization Interface
 */
export interface IOrganization {
  _id?: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  profile?: OrganizationProfile;
  subscription: OrganizationSubscription;
  ownerId: Types.ObjectId;
  members: OrganizationMember[];
  status: 'active' | 'suspended' | 'deleted';
  deletedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Organization Creation Data Transfer Object
 */
export interface CreateOrganizationDto {
  name: string;
  slug?: string;
  description?: string;
}

/**
 * Organization Update Data Transfer Object
 */
export interface UpdateOrganizationDto {
  name?: string;
  slug?: string;
  description?: string;
  profile?: Partial<OrganizationProfile>;
}

/**
 * Organization Invitation Data Transfer Object
 */
export interface InviteOrganizationMemberDto {
  email: string;
  role: OrganizationRole;
  message?: string;
}

/**
 * User Query Parameters
 */
export interface UserQueryParams {
  status?: UserStatus;
  plan?: SubscriptionPlan;
  search?: string;
  organizationId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Public User Profile (safe for external use)
 */
export interface PublicUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  company?: string;
  jobTitle?: string;
  bio?: string;
}

/**
 * Authentication Response
 */
export interface AuthResponse {
  user: Omit<
    IUser,
    | 'password'
    | 'refreshTokens'
    | 'emailVerificationToken'
    | 'passwordResetToken'
    | 'twoFactorSecret'
    | 'twoFactorBackupCodes'
  >;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
