import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  private readonly saltRounds: number;
  private readonly maxLoginAttempts = 5;
  private readonly lockTimeMs = 15 * 60 * 1000; // 15 minutes

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private configService: ConfigService,
  ) {
    this.saltRounds = parseInt(this.configService.get<string>('BCRYPT_SALT_ROUNDS') || '12');
  }

  /**
   * Creates a new user account with secure password hashing
   */
  async create(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<UserDocument> {
    try {
      // Check if user already exists
      const existingUser = await this.userModel.findOne({ email: userData.email.toLowerCase() });
      if (existingUser) {
        throw new ConflictException('Email address is already registered');
      }

      // Hash password with salt
      const hashedPassword = await bcrypt.hash(userData.password, this.saltRounds);

      // Create new user
      const newUser = new this.userModel({
        ...userData,
        email: userData.email.toLowerCase(),
        password: hashedPassword,
        refreshTokens: [],
      });

      const savedUser = await newUser.save();

      console.log('[USER] New user created:', {
        userId: savedUser._id,
        email: savedUser.email,
        timestamp: new Date().toISOString(),
      });

      return savedUser;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      console.error('[USER] Error creating user:', error);
      throw new BadRequestException('Failed to create user account');
    }
  }

  /**
   * Finds user by email address
   */
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  /**
   * Finds user by ID
   */
  async findById(id: string): Promise<UserDocument | null> {
    try {
      return await this.userModel.findById(id).exec();
    } catch {
      return null;
    }
  }

  /**
   * Validates user password and handles account locking
   */
  async validatePassword(user: UserDocument, password: string): Promise<boolean> {
    // Check if account is locked
    if (user.lockUntil && user.lockUntil > new Date()) {
      throw new BadRequestException(
        'Account is temporarily locked due to too many failed login attempts',
      );
    }

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      // Increment login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;

      // Lock account if max attempts exceeded
      if (user.loginAttempts >= this.maxLoginAttempts) {
        user.lockUntil = new Date(Date.now() + this.lockTimeMs);

        console.log('[USER] Account locked due to failed attempts:', {
          userId: user._id,
          email: user.email,
          attempts: user.loginAttempts,
          lockUntil: user.lockUntil,
          timestamp: new Date().toISOString(),
        });
      }

      await user.save();
      return false;
    }

    // Reset login attempts on successful password validation
    if (user.loginAttempts > 0) {
      user.loginAttempts = 0;
      user.lockUntil = null;
      user.lastLoginAt = new Date();
      await user.save();
    }

    return true;
  }

  /**
   * Stores refresh token hash for user
   */
  async addRefreshToken(userId: string, refreshTokenHash: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        $push: { refreshTokens: refreshTokenHash },
        lastLoginAt: new Date(),
      })
      .exec();
  }

  /**
   * Removes specific refresh token
   */
  async removeRefreshToken(userId: string, refreshTokenHash: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { $pull: { refreshTokens: refreshTokenHash } })
      .exec();
  }

  /**
   * Removes all refresh tokens (logout from all devices)
   */
  async removeAllRefreshTokens(userId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { $set: { refreshTokens: [] } }).exec();
  }

  /**
   * Validates if refresh token exists for user
   */
  async validateRefreshToken(userId: string, refreshTokenHash: string): Promise<boolean> {
    const user = await this.userModel.findById(userId).exec();
    return user ? user.refreshTokens.includes(refreshTokenHash) : false;
  }

  /**
   * Updates user password
   */
  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds);

    await this.userModel
      .findByIdAndUpdate(userId, {
        password: hashedPassword,
        $unset: {
          passwordResetToken: 1,
          passwordResetExpires: 1,
        },
      })
      .exec();

    console.log('[USER] Password updated:', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Updates user profile information
   */
  async updateProfile(
    userId: string,
    updateData: {
      firstName?: string;
      lastName?: string;
    },
  ): Promise<UserDocument> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(userId, updateData, { new: true, runValidators: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  /**
   * Deactivates user account
   */
  async deactivateAccount(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        isActive: false,
        $set: { refreshTokens: [] }, // Remove all refresh tokens
      })
      .exec();

    console.log('[USER] Account deactivated:', {
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Creates a new user from OAuth provider
   */
  async createFromOAuth(oauthData: {
    email: string;
    firstName: string;
    lastName: string;
    oauthProvider: {
      provider: 'google' | 'github';
      providerId: string;
      email: string;
      name?: string;
      avatar?: string;
      connectedAt: Date;
      accessToken?: string;
      refreshToken?: string;
    };
  }): Promise<UserDocument> {
    try {
      // Check if user already exists
      const existingUser = await this.userModel.findOne({ email: oauthData.email.toLowerCase() });
      if (existingUser) {
        throw new ConflictException('Email address is already registered');
      }

      // Create new user with OAuth provider
      const newUser = new this.userModel({
        email: oauthData.email.toLowerCase(),
        firstName: oauthData.firstName,
        lastName: oauthData.lastName,
        password: 'oauth-placeholder', // OAuth users don't have passwords
        status: 'active',
        isEmailVerified: true, // OAuth providers verify email
        oauthProviders: [oauthData.oauthProvider],
        refreshTokens: [],
      });

      const savedUser = await newUser.save();

      console.log('[USER] New OAuth user created:', {
        userId: savedUser._id,
        email: savedUser.email,
        provider: oauthData.oauthProvider.provider,
        timestamp: new Date().toISOString(),
      });

      return savedUser;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      console.error('[USER] Error creating OAuth user:', error);
      throw new BadRequestException('Failed to create OAuth user account');
    }
  }

  /**
   * Adds OAuth provider to existing user
   */
  async addOAuthProvider(
    userId: string,
    providerData: {
      provider: 'google' | 'github';
      providerId: string;
      email: string;
      name?: string;
      avatar?: string;
      connectedAt: Date;
      accessToken?: string;
      refreshToken?: string;
    },
  ): Promise<void> {
    try {
      await this.userModel
        .findByIdAndUpdate(userId, {
          $push: { oauthProviders: providerData },
        })
        .exec();

      console.log('[USER] OAuth provider added:', {
        userId,
        provider: providerData.provider,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[USER] Error adding OAuth provider:', error);
      throw new BadRequestException('Failed to add OAuth provider');
    }
  }

  /**
   * Updates OAuth provider data for user
   */
  async updateOAuthProvider(
    userId: string,
    provider: 'google' | 'github',
    updateData: {
      accessToken?: string;
      refreshToken?: string;
      connectedAt: Date;
    },
  ): Promise<void> {
    try {
      await this.userModel
        .findOneAndUpdate(
          { _id: userId, 'oauthProviders.provider': provider },
          {
            $set: {
              'oauthProviders.$.accessToken': updateData.accessToken,
              'oauthProviders.$.refreshToken': updateData.refreshToken,
              'oauthProviders.$.connectedAt': updateData.connectedAt,
            },
          },
        )
        .exec();

      console.log('[USER] OAuth provider updated:', {
        userId,
        provider,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[USER] Error updating OAuth provider:', error);
      throw new BadRequestException('Failed to update OAuth provider');
    }
  }

  /**
   * Updates last login time for user
   */
  async updateLastLogin(userId: string): Promise<void> {
    try {
      await this.userModel
        .findByIdAndUpdate(userId, {
          lastLoginAt: new Date(),
          lastActiveAt: new Date(),
        })
        .exec();
    } catch (error) {
      console.error('[USER] Error updating last login:', error);
      // Don't throw error for this operation as it's not critical
    }
  }
}
