/**
 * @fileoverview Centralized exports for all MongoDB schemas and types.
 * This file simplifies imports across the application.
 */

// Form-related entities and types
export * from '../../modules/forms/entities/form.entity';

// Submission-related entities and types
export * from '../../modules/submissions/entities/submission.entity';

// User-related schemas and types
export * from '../../modules/users/schemas/user.schema';

// Permission and access control schemas and types
export * from './permission.schema';

// Analytics-related entities and types
export * from '../../modules/analytics/entities/analytics.entity';
