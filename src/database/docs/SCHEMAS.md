# Schema Management Guide

## Overview

This guide covers schema design patterns, best practices, and management
strategies for the ArvaForm database schemas using Mongoose ODM.

## Schema Architecture

```
src/database/schemas/
├── index.ts              # Schema exports and utilities
├── user.schema.ts        # User entity schema
├── form.schema.ts        # Form entity schema
├── submission.schema.ts  # Form submission schema
├── element.schema.ts     # Form element schema
└── permission.schema.ts  # Permission/role schema
```

## Base Schema Template

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({
  timestamps: true, // Adds createdAt, updatedAt
  collection: 'users', // Explicit collection name
  versionKey: false, // Disable __v field
})
export class User extends Document {
  @Prop({
    required: true,
    unique: true,
    index: true, // Simple index
    lowercase: true, // Transform to lowercase
    trim: true, // Remove whitespace
  })
  email: string;

  @Prop({
    required: true,
    minlength: 2,
    maxlength: 100,
  })
  name: string;

  @Prop({
    default: 'active',
    enum: ['active', 'inactive', 'suspended'],
  })
  status: string;

  @Prop({
    type: Date,
    default: Date.now,
  })
  lastLoginAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Compound indexes
UserSchema.index({ email: 1, status: 1 });
UserSchema.index({ createdAt: -1, status: 1 });

// Text search index
UserSchema.index({ name: 'text', email: 'text' });
```

## Schema Patterns

### 1. Reference Pattern

```typescript
@Schema({ timestamps: true })
export class Form extends Document {
  @Prop({ required: true })
  title: string;

  // Reference to User
  @Prop({
    type: Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;
}
```

### 2. Embedded Document Pattern

```typescript
@Schema({ _id: false }) // Disable _id for subdocuments
export class FormElement {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  label: string;
}

@Schema({ timestamps: true })
export class Form extends Document {
  @Prop({
    type: [FormElement], // Embed array of documents
    default: [],
  })
  elements: FormElement[];
}
```

## Validation Patterns

```typescript
@Schema()
export class Form extends Document {
  @Prop({
    required: [true, 'Title is required'],
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters'],
    trim: true,
  })
  title: string;

  @Prop({
    required: true,
    enum: {
      values: ['draft', 'published', 'archived'],
      message: 'Status must be draft, published, or archived',
    },
  })
  status: string;
}
```

## Performance Optimization

### Indexing Strategies

```typescript
export const UserSchema = SchemaFactory.createForClass(User);

// Single field indexes
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ status: 1 });
UserSchema.index({ createdAt: -1 });

// Compound indexes (order matters!)
UserSchema.index({ status: 1, createdAt: -1 });

// Text search indexes
UserSchema.index({
  name: 'text',
  email: 'text',
});
```

## Best Practices

### 1. Naming Conventions

```typescript
// Collections: lowercase, plural
@Schema({ collection: 'users' })
export class User extends Document {}

// Fields: camelCase
@Prop()
firstName: string;

// References: singular + Id suffix
@Prop({ type: Types.ObjectId, ref: 'User' })
userId: Types.ObjectId;

// Boolean fields: use 'is' or 'has' prefix
@Prop({ default: false })
isActive: boolean;
```

### 2. Security Considerations

```typescript
@Schema()
export class User extends Document {
  // Never include sensitive data in JSON output
  @Prop({
    required: true,
    select: false, // Exclude from queries by default
  })
  password: string;
}

// Transform JSON output to remove sensitive fields
UserSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});
```

For complete schema implementations, see the files in `src/database/schemas/`.
