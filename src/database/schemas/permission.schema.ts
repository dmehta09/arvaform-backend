import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

/**
 * Permission document schema
 * Defines individual permissions that can be assigned to users or roles
 */
@Schema({
  timestamps: true,
  collection: 'permissions',
  versionKey: false,
})
export class Permission extends Document {
  @Prop({
    required: true,
    unique: true,
    uppercase: true,
    match: /^[A-Z_]+$/,
  })
  name: string; // e.g., 'FORM_CREATE', 'FORM_EDIT', 'FORM_DELETE'

  @Prop({
    required: true,
    maxlength: 200,
  })
  description: string;

  @Prop({
    required: true,
    enum: ['form', 'submission', 'user', 'integration', 'analytics', 'system'],
    index: true,
  })
  category: 'form' | 'submission' | 'user' | 'integration' | 'analytics' | 'system';

  @Prop({
    required: true,
    enum: ['create', 'read', 'update', 'delete', 'admin'],
    index: true,
  })
  action: 'create' | 'read' | 'update' | 'delete' | 'admin';

  @Prop({
    required: true,
    enum: ['basic', 'premium', 'enterprise'],
    default: 'basic',
    index: true,
  })
  tier: 'basic' | 'premium' | 'enterprise';

  @Prop({
    default: true,
    index: true,
  })
  isActive: boolean;
}

/**
 * Role document schema
 * Defines user roles with associated permissions
 */
@Schema({
  timestamps: true,
  collection: 'roles',
  versionKey: false,
})
export class Role extends Document {
  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    match: /^[a-z_]+$/,
  })
  name: string; // e.g., 'admin', 'form_creator', 'viewer'

  @Prop({
    required: true,
    maxlength: 200,
  })
  displayName: string; // e.g., 'Form Creator', 'Viewer'

  @Prop({
    maxlength: 500,
  })
  description?: string;

  @Prop([
    {
      type: MongooseSchema.Types.ObjectId,
      ref: 'Permission',
    },
  ])
  permissions: Types.ObjectId[];

  @Prop({
    required: true,
    enum: ['system', 'organization', 'custom'],
    default: 'custom',
    index: true,
  })
  type: 'system' | 'organization' | 'custom';

  @Prop({
    required: true,
    enum: ['basic', 'premium', 'enterprise'],
    default: 'basic',
    index: true,
  })
  tier: 'basic' | 'premium' | 'enterprise';

  @Prop({
    default: true,
    index: true,
  })
  isActive: boolean;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
  })
  createdBy?: Types.ObjectId;
}

/**
 * User Permission Assignment document schema
 * Assigns specific permissions or roles to users with optional context
 */
@Schema({
  timestamps: true,
  collection: 'user_permissions',
  versionKey: false,
})
export class UserPermission extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    index: true,
    ref: 'User',
  })
  userId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Role',
  })
  roleId?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Permission',
  })
  permissionId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['role', 'permission'],
    index: true,
  })
  type: 'role' | 'permission'; // Whether this assigns a role or individual permission

  @Prop({
    type: {
      resourceType: {
        type: String,
        enum: ['form', 'organization', 'global'],
        required: true,
      },
      resourceId: MongooseSchema.Types.ObjectId,
    },
  })
  context?: {
    resourceType: 'form' | 'organization' | 'global';
    resourceId?: Types.ObjectId;
  };

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: 'User',
  })
  grantedBy: Types.ObjectId;

  @Prop()
  expiresAt?: Date;

  @Prop({
    default: true,
    index: true,
  })
  isActive: boolean;

  @Prop()
  revokedAt?: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
  })
  revokedBy?: Types.ObjectId;
}

/**
 * Organization document schema
 * Represents organizations that can have multiple users and forms
 */
@Schema({
  timestamps: true,
  collection: 'organizations',
  versionKey: false,
})
export class Organization extends Document {
  @Prop({
    required: true,
    maxlength: 100,
    trim: true,
  })
  name: string;

  @Prop({
    required: true,
    unique: true,
    lowercase: true,
    match: /^[a-z0-9-]+$/,
  })
  slug: string;

  @Prop({
    maxlength: 500,
  })
  description?: string;

  @Prop({
    type: {
      logo: String,
      website: String,
      address: {
        street: String,
        city: String,
        state: String,
        zipCode: String,
        country: String,
      },
    },
  })
  profile?: {
    logo?: string;
    website?: string;
    address?: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
    };
  };

  @Prop({
    type: {
      plan: {
        type: String,
        enum: ['basic', 'premium', 'enterprise'],
        default: 'basic',
      },
      limits: {
        forms: { type: Number, default: 10 },
        submissions: { type: Number, default: 1000 },
        users: { type: Number, default: 5 },
        storage: { type: Number, default: 1024 }, // MB
      },
      features: [String],
    },
    default: () => ({
      plan: 'basic',
      limits: {
        forms: 10,
        submissions: 1000,
        users: 5,
        storage: 1024,
      },
      features: [],
    }),
  })
  subscription: {
    plan: 'basic' | 'premium' | 'enterprise';
    limits: {
      forms: number;
      submissions: number;
      users: number;
      storage: number;
    };
    features: string[];
  };

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: 'User',
  })
  ownerId: Types.ObjectId;

  @Prop([
    {
      userId: { type: MongooseSchema.Types.ObjectId, ref: 'User', required: true },
      role: { type: String, enum: ['admin', 'member'], required: true },
      joinedAt: { type: Date, default: Date.now },
      invitedBy: { type: MongooseSchema.Types.ObjectId, ref: 'User' },
    },
  ])
  members: Array<{
    userId: Types.ObjectId;
    role: 'admin' | 'member';
    joinedAt: Date;
    invitedBy?: Types.ObjectId;
  }>;

  @Prop({
    required: true,
    enum: ['active', 'suspended', 'deleted'],
    default: 'active',
    index: true,
  })
  status: 'active' | 'suspended' | 'deleted';

  @Prop()
  deletedAt?: Date;
}

export type PermissionDocument = Permission & Document;
export type RoleDocument = Role & Document;
export type UserPermissionDocument = UserPermission & Document;
export type OrganizationDocument = Organization & Document;

export const PermissionSchema = SchemaFactory.createForClass(Permission);
export const RoleSchema = SchemaFactory.createForClass(Role);
export const UserPermissionSchema = SchemaFactory.createForClass(UserPermission);
export const OrganizationSchema = SchemaFactory.createForClass(Organization);

// Permission schema indexes
PermissionSchema.index({ category: 1, action: 1 }); // Permission lookup by category and action
PermissionSchema.index({ tier: 1, isActive: 1 }); // Active permissions by tier

// Role schema indexes
RoleSchema.index({ type: 1, tier: 1, isActive: 1 }); // Active roles by type and tier
RoleSchema.index({ name: 'text', displayName: 'text' }); // Role search

// User Permission schema indexes
UserPermissionSchema.index({ userId: 1, type: 1, isActive: 1 }); // User permissions/roles
UserPermissionSchema.index({ userId: 1, 'context.resourceType': 1, 'context.resourceId': 1 }); // Contextual permissions
UserPermissionSchema.index({ expiresAt: 1 }, { sparse: true }); // Expiring permissions
UserPermissionSchema.index({ roleId: 1 }, { sparse: true }); // Role assignments
UserPermissionSchema.index({ permissionId: 1 }, { sparse: true }); // Permission assignments

// Organization schema indexes
OrganizationSchema.index({ slug: 1 }); // Organization lookup
OrganizationSchema.index({ ownerId: 1 }); // Owner's organizations
OrganizationSchema.index({ 'members.userId': 1 }); // User's organizations
OrganizationSchema.index({ status: 1 }); // Active organizations

// Virtual for organization member count
OrganizationSchema.virtual('memberCount').get(function (this: OrganizationDocument) {
  return this.members ? this.members.length : 0;
});

// Method to check if user is organization member
OrganizationSchema.methods.isMember = function (
  this: OrganizationDocument,
  userId: Types.ObjectId,
): boolean {
  return this.members.some(member => member.userId.equals(userId));
};

// Method to get user's role in organization
OrganizationSchema.methods.getUserRole = function (
  this: OrganizationDocument,
  userId: Types.ObjectId,
): string | null {
  const member = this.members.find(member => member.userId.equals(userId));
  return member ? member.role : null;
};

// Method to find a member by user ID
OrganizationSchema.methods.findMember = function (
  this: OrganizationDocument,
  userId: Types.ObjectId,
) {
  return this.members.find(member => member.userId.equals(userId));
};

// Virtual property to get all member user IDs
OrganizationSchema.virtual('memberIds').get(function (this: OrganizationDocument) {
  return this.members.map(member => member.userId);
});
