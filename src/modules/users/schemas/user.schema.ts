import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type UserDocument = User & Document;

/**
 * OAuth Provider Information subdocument schema
 */
@Schema({ _id: false })
export class OAuthProvider {
  @Prop({
    required: true,
    enum: ['google', 'github', 'facebook', 'microsoft'],
  })
  provider: 'google' | 'github' | 'facebook' | 'microsoft';

  @Prop({ required: true })
  providerId: string;

  @Prop({ required: true })
  email: string;

  @Prop()
  name?: string;

  @Prop()
  avatar?: string;

  @Prop({ required: true, default: Date.now })
  connectedAt: Date;

  @Prop()
  accessToken?: string; // Encrypted

  @Prop()
  refreshToken?: string; // Encrypted

  @Prop()
  expiresAt?: Date;
}

/**
 * User Profile Information subdocument schema
 */
@Schema({ _id: false })
export class UserProfile {
  @Prop()
  avatar?: string;

  @Prop()
  bio?: string;

  @Prop()
  company?: string;

  @Prop()
  jobTitle?: string;

  @Prop()
  website?: string;

  @Prop()
  phoneNumber?: string;

  @Prop({
    type: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
  })
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };

  @Prop()
  timezone?: string;

  @Prop()
  language?: string;

  @Prop({
    type: {
      marketing: { type: Boolean, default: false },
      security: { type: Boolean, default: true },
      updates: { type: Boolean, default: true },
    },
    default: () => ({
      marketing: false,
      security: true,
      updates: true,
    }),
  })
  notifications: {
    marketing: boolean;
    security: boolean;
    updates: boolean;
  };
}

/**
 * User Subscription Information subdocument schema
 */
@Schema({ _id: false })
export class UserSubscription {
  @Prop({
    required: true,
    enum: ['free', 'basic', 'premium', 'enterprise'],
    default: 'free',
  })
  plan: 'free' | 'basic' | 'premium' | 'enterprise';

  @Prop({
    required: true,
    enum: ['active', 'canceled', 'past_due', 'trial', 'expired'],
    default: 'active',
  })
  status: 'active' | 'canceled' | 'past_due' | 'trial' | 'expired';

  @Prop()
  stripeCustomerId?: string;

  @Prop()
  stripeSubscriptionId?: string;

  @Prop()
  currentPeriodStart?: Date;

  @Prop()
  currentPeriodEnd?: Date;

  @Prop()
  trialEnd?: Date;

  @Prop({
    type: {
      forms: { type: Number, default: 5 },
      submissions: { type: Number, default: 100 },
      storage: { type: Number, default: 100 }, // MB
      integrations: { type: Number, default: 2 },
    },
    default: () => ({
      forms: 5,
      submissions: 100,
      storage: 100,
      integrations: 2,
    }),
  })
  limits: {
    forms: number;
    submissions: number;
    storage: number;
    integrations: number;
  };

  @Prop({
    type: {
      forms: { type: Number, default: 0 },
      submissions: { type: Number, default: 0 },
      storage: { type: Number, default: 0 }, // MB
      integrations: { type: Number, default: 0 },
    },
    default: () => ({
      forms: 0,
      submissions: 0,
      storage: 0,
      integrations: 0,
    }),
  })
  usage: {
    forms: number;
    submissions: number;
    storage: number;
    integrations: number;
  };
}

/**
 * Enhanced User document schema
 * Represents a complete user with authentication, profile, and subscription information
 */
@Schema({
  timestamps: true,
  collection: 'users',
  versionKey: false,
})
export class User extends Document {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  })
  email: string;

  @Prop({
    required: true,
    minlength: 8,
    select: false, // Exclude from queries by default
  })
  password: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 50,
  })
  firstName: string;

  @Prop({
    required: true,
    trim: true,
    maxlength: 50,
  })
  lastName: string;

  @Prop({
    type: UserProfile,
    default: () => ({
      notifications: {
        marketing: false,
        security: true,
        updates: true,
      },
    }),
  })
  profile: UserProfile;

  @Prop({
    type: [OAuthProvider],
    default: [],
  })
  oauthProviders: OAuthProvider[];

  @Prop({
    type: UserSubscription,
    default: () => ({
      plan: 'free',
      status: 'active',
      limits: {
        forms: 5,
        submissions: 100,
        storage: 100,
        integrations: 2,
      },
      usage: {
        forms: 0,
        submissions: 0,
        storage: 0,
        integrations: 0,
      },
    }),
  })
  subscription: UserSubscription;

  @Prop({
    required: true,
    enum: ['active', 'inactive', 'suspended', 'pending_verification'],
    default: 'pending_verification',
    index: true,
  })
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';

  @Prop({
    default: 0,
    max: 5,
  })
  loginAttempts: number;

  @Prop({ default: null, type: Date })
  lockUntil?: Date | null;

  @Prop({ default: null, type: Date })
  lastLoginAt?: Date | null;

  @Prop()
  lastActiveAt?: Date;

  // Refresh token storage (hashed)
  @Prop({
    type: [String],
    select: false,
    default: [],
  })
  refreshTokens: string[];

  // Email verification
  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ select: false })
  emailVerificationToken?: string;

  @Prop({ select: false })
  emailVerificationExpires?: Date;

  // Password reset
  @Prop({ select: false })
  passwordResetToken?: string;

  @Prop({ select: false })
  passwordResetExpires?: Date;

  // Two-factor authentication
  @Prop({ default: false })
  twoFactorEnabled: boolean;

  @Prop({ select: false })
  twoFactorSecret?: string;

  @Prop({
    type: [String],
    select: false,
    default: [],
  })
  twoFactorBackupCodes: string[];

  // Organization memberships (populated separately)
  @Prop([
    {
      type: MongooseSchema.Types.ObjectId,
      ref: 'Organization',
    },
  ])
  organizations: Types.ObjectId[];

  // GDPR and compliance
  @Prop()
  privacyPolicyAcceptedAt?: Date;

  @Prop()
  termsOfServiceAcceptedAt?: Date;

  @Prop()
  marketingOptIn?: boolean;

  @Prop()
  dataRetentionOptOut?: boolean;

  // Soft delete
  @Prop()
  deletedAt?: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
  })
  deletedBy?: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for optimal query performance (removed duplicates for email and status)
// Note: email index is already created by unique: true in @Prop decorator
// Note: status index is already created by index: true in @Prop decorator
UserSchema.index({ 'oauthProviders.provider': 1, 'oauthProviders.providerId': 1 }); // OAuth lookup
UserSchema.index({ 'subscription.plan': 1, 'subscription.status': 1 }); // Subscription queries
UserSchema.index({ organizations: 1 }); // Organization membership
UserSchema.index({ createdAt: -1 }); // Recent users
UserSchema.index({ lastActiveAt: -1 }, { sparse: true }); // User activity

// Text search index for user discovery
UserSchema.index({
  firstName: 'text',
  lastName: 'text',
  email: 'text',
  'profile.company': 'text',
});

// Virtual for full name
UserSchema.virtual('fullName').get(function (this: UserDocument) {
  return `${this.firstName} ${this.lastName}`.trim();
});

// Virtual for account lock status
UserSchema.virtual('isLocked').get(function (this: UserDocument) {
  return !!(this.lockUntil && this.lockUntil.getTime() > Date.now());
});

// Virtual for subscription status
UserSchema.virtual('isSubscriptionActive').get(function (this: UserDocument) {
  return this.subscription.status === 'active' || this.subscription.status === 'trial';
});

// Method to check OAuth provider connection
UserSchema.methods.hasOAuthProvider = function (this: UserDocument, provider: string): boolean {
  return this.oauthProviders.some(p => p.provider === provider);
};

// Method to check usage limits
UserSchema.methods.hasReachedLimit = function (
  this: UserDocument,
  resource: keyof UserSubscription['limits'],
): boolean {
  return this.subscription.usage[resource] >= this.subscription.limits[resource];
};

// Method to increment usage
UserSchema.methods.incrementUsage = function (
  this: UserDocument,
  resource: keyof UserSubscription['usage'],
  amount: number = 1,
) {
  this.subscription.usage[resource] += amount;
  return this.save();
};

// Method to check if user can perform action based on subscription
UserSchema.methods.canAccess = function (this: UserDocument, feature: string): boolean {
  const featureMap = {
    advanced_integrations: ['premium', 'enterprise'],
    custom_branding: ['premium', 'enterprise'],
    api_access: ['premium', 'enterprise'],
    white_label: ['enterprise'],
  };

  const requiredPlans = featureMap[feature];
  return requiredPlans ? requiredPlans.includes(this.subscription.plan) : true;
};

// Method to update subscription details
UserSchema.methods.updateSubscription = function (
  this: UserDocument,
  plan: 'basic' | 'premium' | 'enterprise',
) {
  try {
    if (this.subscription.plan === plan) {
      return this;
    }
    // Logic to update subscription, limits, features, etc.
    this.subscription.plan = plan;
    return this.save();
  } catch (error: unknown) {
    return error instanceof Error && error.message.includes('Invalid plan');
  }
};

// Pre-save hook for validation and data consistency
UserSchema.pre<UserDocument>('save', function (next) {
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase();
  }
  // Add other pre-save logic here
  next();
});

// Post-save hook for logging or event emission
UserSchema.post<UserDocument>('save', function (doc) {
  console.log(`User ${doc.email} saved.`);
});
