import { ExecutionContext, Injectable, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

interface UserContext {
  userId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  lastLoginAt: Date;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Determines if the route should be protected
   * Checks for @Public() decorator to allow public access
   */
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    // Check if route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * Handles authentication errors with detailed logging
   */
  handleRequest<TUser = unknown>(
    err: Error | null,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
  ): TUser {
    const request = context.switchToHttp().getRequest();

    // Log authentication attempts for security monitoring
    if (err || !user) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : typeof info === 'object' && info && 'message' in info
            ? (info as { message?: string }).message
            : 'Unknown error';
      console.log('[AUTH] Authentication failed:', {
        ip: request.ip,
        userAgent: request.get('User-Agent'),
        path: request.path,
        method: request.method,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      });
      throw err || new UnauthorizedException('Authentication required');
    }

    // Log successful authentication
    if (typeof user === 'object' && user !== null && 'userId' in user && 'email' in user) {
      const u = user as unknown as UserContext;
      console.log('[AUTH] Authentication successful:', {
        userId: u.userId,
        email: u.email,
        ip: request.ip,
        path: request.path,
        method: request.method,
        timestamp: new Date().toISOString(),
      });
    }

    return user;
  }
}

// Decorator to mark routes as public (no authentication required)
export const Public = () => SetMetadata('isPublic', true);
