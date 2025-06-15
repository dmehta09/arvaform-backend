import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  status: string;
  iat: number; // Issued at
  exp: number; // Expiration time
  type: 'access' | 'refresh';
  jti?: string; // Unique token identifier for refresh tokens
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET') || 'default_secret',
      passReqToCallback: false,
    });
  }

  /**
   * Validates JWT payload and returns user context
   * This method is called automatically by Passport after token verification
   */
  async validate(payload: JwtPayload): Promise<{
    userId: string;
    email: string;
    status: string;
    firstName: string;
    lastName: string;
    lastLoginAt: Date | null;
  }> {
    try {
      // Ensure this is an access token
      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Fetch user from database to ensure account is still active
      const user = await this.usersService.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('User account not found');
      }

      if (user.status !== 'active') {
        throw new UnauthorizedException('User account is not active');
      }

      // Check if account is locked
      if (user.lockUntil && user.lockUntil > new Date()) {
        throw new UnauthorizedException('Account is temporarily locked');
      }

      // Return user context that will be attached to request.user
      if (!user || typeof user !== 'object' || !('_id' in user)) {
        throw new UnauthorizedException('Invalid user object');
      }
      return {
        userId: user._id as string,
        email: user.email,
        status: user.status,
        firstName: user.firstName,
        lastName: user.lastName,
        lastLoginAt: user.lastLoginAt || null,
      };
    } catch {
      throw new UnauthorizedException('Invalid token or user not found');
    }
  }
}
