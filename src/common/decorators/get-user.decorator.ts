import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * User payload interface for type safety
 */
export interface UserPayload {
  userId: string;
  email: string;
  role?: string;
  firstName?: string;
  lastName?: string;
  lastLoginAt?: Date;
}

/**
 * Request interface with user attached by JWT guard
 */
interface RequestWithUser {
  user: UserPayload;
}

/**
 * GetUser Decorator
 *
 * Extract user information from the authenticated request.
 * Works with JWT authentication to provide easy access to user data.
 *
 * @param data - Optional property name to extract specific user field
 * @returns User object or specific user property
 *
 * @example
 * // Get entire user object
 * @GetUser() user: UserPayload
 *
 * // Get specific user property
 * @GetUser('id') userId: string
 * @GetUser('email') userEmail: string
 */
export const GetUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext): UserPayload | string | null => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      return null;
    }

    // If data is specified, return that specific property
    if (data) {
      // Handle nested properties like 'user.id' -> 'userId'
      const property = data === 'id' ? 'userId' : data;
      return user[property as keyof UserPayload] as string;
    }

    // Return entire user object
    return user;
  },
);
