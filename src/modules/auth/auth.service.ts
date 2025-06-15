import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface LoginResponse extends AuthTokens {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    status: string;
    lastLoginAt: Date | null;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenExpiration: string;
  private readonly refreshTokenExpiration: string;
  private readonly refreshSecret: string;

  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {
    this.accessTokenExpiration = String(
      this.configService.get<string>('JWT_ACCESS_EXPIRATION') ?? '15m',
    );
    this.refreshTokenExpiration = String(
      this.configService.get<string>('JWT_REFRESH_EXPIRATION') ?? '7d',
    );
    this.refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || '';
  }

  /**
   * Registers a new user account
   */
  async register(registerDto: RegisterDto): Promise<LoginResponse> {
    try {
      this.logger.debug(`Registration attempt for email: ${registerDto.email}`);

      // Create new user
      const user = await this.usersService.create(registerDto);

      // Generate tokens for immediate login after registration
      const tokens = this.generateTokens({
        sub: user._id as string,
        email: user.email,
        status: user.status,
      });

      // Store refresh token hash
      const refreshTokenHash = await this.hashToken(tokens.refreshToken);
      await this.usersService.addRefreshToken(user._id as string, refreshTokenHash);

      this.logger.log(`User registered successfully: ${user.email}`);

      return {
        ...tokens,
        user: {
          id: user._id as string,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          lastLoginAt: user.lastLoginAt || null,
        },
      };
    } catch (error) {
      this.logger.error(
        `Registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Authenticates user and returns tokens
   */
  async login(loginDto: LoginDto): Promise<LoginResponse> {
    try {
      this.logger.debug(`Login attempt for email: ${loginDto.email}`);

      // Find user by email
      const user = await this.usersService.findByEmail(loginDto.email);
      if (!user) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Check if account is active
      if (user.status !== 'active') {
        throw new UnauthorizedException('Account is not active');
      }

      // Validate password (includes account locking logic)
      const isPasswordValid = await this.usersService.validatePassword(user, loginDto.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Generate tokens
      const tokens = this.generateTokens({
        sub: user._id as string,
        email: user.email,
        status: user.status,
      });

      // Store refresh token hash
      const refreshTokenHash = await this.hashToken(tokens.refreshToken);
      await this.usersService.addRefreshToken(user._id as string, refreshTokenHash);

      this.logger.log(`User logged in successfully: ${user.email}`);

      return {
        ...tokens,
        user: {
          id: user._id as string,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          status: user.status,
          lastLoginAt: new Date(),
        },
      };
    } catch (error) {
      this.logger.error(
        `Login failed for email ${loginDto.email}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Refreshes access token using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    try {
      this.logger.debug('Refresh token request received');

      // Verify refresh token
      const payload = this.verifyRefreshToken(refreshToken);

      // Find user
      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status !== 'active') {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Validate refresh token exists in database
      const refreshTokenHash = await this.hashToken(refreshToken);
      const isValidRefreshToken = await this.usersService.validateRefreshToken(
        user._id as string,
        refreshTokenHash,
      );

      if (!isValidRefreshToken) {
        this.logger.warn(`Invalid refresh token used for user: ${user.email}`);
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Remove old refresh token
      await this.usersService.removeRefreshToken(user._id as string, refreshTokenHash);

      // Generate new tokens
      const tokens = this.generateTokens({
        sub: user._id as string,
        email: user.email,
        status: user.status,
      });

      // Store new refresh token hash
      const newRefreshTokenHash = await this.hashToken(tokens.refreshToken);
      await this.usersService.addRefreshToken(user._id as string, newRefreshTokenHash);

      this.logger.log(`Tokens refreshed for user: ${user.email}`);

      return tokens;
    } catch (error) {
      this.logger.error(
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Logs out user by removing refresh token
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    try {
      const refreshTokenHash = await this.hashToken(refreshToken);
      await this.usersService.removeRefreshToken(userId, refreshTokenHash);

      this.logger.log(`User logged out: ${userId}`);
    } catch (error) {
      this.logger.error(
        `Logout failed for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Logs out user from all devices
   */
  async logoutFromAllDevices(userId: string): Promise<void> {
    try {
      await this.usersService.removeAllRefreshTokens(userId);
      this.logger.log(`User logged out from all devices: ${userId}`);
    } catch (error) {
      this.logger.error(
        `Logout from all devices failed for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Changes user password
   */
  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    try {
      // Find user
      const user = await this.usersService.findById(userId);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Validate current password
      const isCurrentPasswordValid = await bcrypt.compare(
        changePasswordDto.currentPassword,
        user.password,
      );

      if (!isCurrentPasswordValid) {
        throw new BadRequestException('Current password is incorrect');
      }

      // Update password
      await this.usersService.updatePassword(userId, changePasswordDto.newPassword);

      // Logout from all devices for security
      await this.usersService.removeAllRefreshTokens(userId);

      this.logger.log(`Password changed for user: ${userId}`);
    } catch (error) {
      this.logger.error(
        `Password change failed for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    }
  }

  /**
   * Validates user for authentication
   */
  async validateUser(payload: JwtPayload): Promise<{
    userId: string;
    email: string;
    status: string;
    firstName: string;
    lastName: string;
    lastLoginAt: Date | null;
  }> {
    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      userId: user._id as string,
      email: user.email,
      status: user.status,
      firstName: user.firstName,
      lastName: user.lastName,
      lastLoginAt: user.lastLoginAt || null,
    };
  }

  /**
   * Generates access and refresh tokens
   */
  private generateTokens(payload: { sub: string; email: string; status: string }): AuthTokens {
    const jti = randomBytes(16).toString('hex'); // Unique token identifier

    const accessToken = this.jwtService.sign(
      {
        ...payload,
        type: 'access',
      },
      {
        expiresIn: this.accessTokenExpiration,
      },
    );

    const refreshToken = this.jwtService.sign(
      {
        ...payload,
        type: 'refresh',
        jti,
      },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshTokenExpiration,
      },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.parseExpiration(this.accessTokenExpiration),
      tokenType: 'Bearer',
    };
  }

  /**
   * Verifies refresh token and returns payload
   */
  private verifyRefreshToken(token: string): JwtPayload {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.refreshSecret,
      });

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Hashes token for secure storage
   */
  private async hashToken(token: string): Promise<string> {
    return bcrypt.hash(token, 10); // Lower rounds for refresh tokens as they're temporary
  }

  /**
   * Parses expiration string to seconds
   */
  private parseExpiration(expiration: string): number {
    const unit = expiration.slice(-1);
    const value = parseInt(expiration.slice(0, -1));

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 900; // Default 15 minutes
    }
  }
}
