/**
 * UsersController - Handles user management endpoints for profile, update, and deactivation.
 *
 * @controller
 * @route /users
 * @group Users
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { UserDocument } from './schemas/user.schema';
import { UsersService } from './users.service';

interface UserProfileDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  lastLoginAt: Date | null;
}

interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
}

interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

// DTO for refresh token operations
interface RefreshTokenDto {
  refreshToken: string;
}

// DTO for admin user creation
interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Get user by ID
   * @route GET /users/:id
   * @param id User ID
   * @returns UserProfileDto
   */
  @Get(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID', description: 'Returns user profile by user ID.' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        status: { type: 'string' },
        lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string): Promise<UserProfileDto> {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user._id as string,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      lastLoginAt: user.lastLoginAt || null,
    };
  }

  /**
   * Get user by email
   * @route GET /users/email/:email
   * @param email User email
   * @returns UserProfileDto
   */
  @Get('email/:email')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user by email',
    description: 'Returns user profile by email address.',
  })
  @ApiResponse({
    status: 200,
    description: 'User found',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        status: { type: 'string' },
        lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserByEmail(@Param('email') email: string): Promise<UserProfileDto> {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user._id as string,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      lastLoginAt: user.lastLoginAt || null,
    };
  }

  /**
   * Update user profile (firstName, lastName)
   * @route PATCH /users/profile
   * @param req Request with user context
   * @param updateProfileDto Profile update data
   * @returns UserProfileDto Updated user profile
   */
  @Patch('profile')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update user profile',
    description: "Updates the authenticated user's profile information.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        status: { type: 'string' },
        lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateProfile(
    @Request() req: { user: { userId: string } },
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<UserProfileDto> {
    const updated = await this.usersService.updateProfile(req.user.userId, updateProfileDto);
    return {
      id: updated._id as string,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      status: updated.status,
      lastLoginAt: updated.lastLoginAt || null,
    };
  }

  /**
   * Deactivate user account
   * @route DELETE /users/deactivate
   * @param req Request with user context
   * @returns Success message
   */
  @Delete('deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Deactivate user account',
    description: "Deactivates the authenticated user's account.",
  })
  @ApiResponse({
    status: 200,
    description: 'Account deactivated',
    schema: { example: { message: 'Account deactivated successfully' } },
  })
  async deactivateAccount(
    @Request() req: { user: { userId: string } },
  ): Promise<{ message: string }> {
    await this.usersService.deactivateAccount(req.user.userId);
    return { message: 'Account deactivated successfully' };
  }

  /**
   * Change user password
   * @route PATCH /users/change-password
   * @param req Request with user context
   * @param changePasswordDto Current and new password
   * @returns Success message
   */
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change user password',
    description: "Changes the authenticated user's password.",
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        currentPassword: { type: 'string', example: 'OldPass123!' },
        newPassword: { type: 'string', example: 'NewPass456!' },
      },
      required: ['currentPassword', 'newPassword'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: { example: { message: 'Password changed successfully' } },
  })
  @ApiResponse({ status: 400, description: 'Current password is incorrect or validation failed' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async changePassword(
    @Request() req: { user: { userId: string } },
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('User not found');
    // Validate current password
    const isCurrentPasswordValid = await this.usersService.validatePassword(
      user,
      changePasswordDto.currentPassword,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }
    await this.usersService.updatePassword(req.user.userId, changePasswordDto.newPassword);
    return { message: 'Password changed successfully' };
  }

  /**
   * List all users (admin only)
   * @route GET /users
   * @param _req Request with user context (unused but required for auth)
   * @returns UserProfileDto[] Array of user profiles
   */
  @Get()
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all users',
    description: 'Returns all user profiles (admin only).',
  })
  @ApiResponse({
    status: 200,
    description: 'Users found',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          status: { type: 'string' },
          lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  })
  async listAllUsers(@Request() _req: { user: { status: string } }): Promise<UserProfileDto[]> {
    const users = await this.usersService['userModel'].find().exec();
    return users.map((user: UserDocument) => ({
      id: user._id as string,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      lastLoginAt: user.lastLoginAt || null,
    }));
  }

  /**
   * Add refresh token for user (admin only)
   * @route POST /users/:id/refresh-token
   */
  @Post(':id/refresh-token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add refresh token (admin only)',
    description: 'Adds a refresh token hash for a user. Admin only.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', example: 'refresh-token-hash' },
      },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({ status: 200, description: 'Refresh token added' })
  async addRefreshToken(
    @Request() req: { user: { role: string } },
    @Param('id') id: string,
    @Body() body: RefreshTokenDto,
  ): Promise<{ message: string }> {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admin only');
    await this.usersService.addRefreshToken(id, body.refreshToken);
    return { message: 'Refresh token added' };
  }

  /**
   * Remove refresh token for user (admin only)
   * @route DELETE /users/:id/refresh-token
   */
  @Delete(':id/refresh-token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove refresh token (admin only)',
    description: 'Removes a refresh token hash for a user. Admin only.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', example: 'refresh-token-hash' },
      },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({ status: 200, description: 'Refresh token removed' })
  async removeRefreshToken(
    @Request() req: { user: { role: string } },
    @Param('id') id: string,
    @Body() body: RefreshTokenDto,
  ): Promise<{ message: string }> {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admin only');
    await this.usersService.removeRefreshToken(id, body.refreshToken);
    return { message: 'Refresh token removed' };
  }

  /**
   * Remove all refresh tokens for user (admin only)
   * @route DELETE /users/:id/refresh-tokens
   */
  @Delete(':id/refresh-tokens')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove all refresh tokens (admin only)',
    description: 'Removes all refresh tokens for a user. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'All refresh tokens removed' })
  async removeAllRefreshTokens(
    @Request() req: { user: { role: string } },
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admin only');
    await this.usersService.removeAllRefreshTokens(id);
    return { message: 'All refresh tokens removed' };
  }

  /**
   * Validate refresh token for user (admin only)
   * @route POST /users/:id/validate-refresh-token
   */
  @Post(':id/validate-refresh-token')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Validate refresh token (admin only)',
    description: 'Validates if a refresh token hash exists for a user. Admin only.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: { type: 'string', example: 'refresh-token-hash' },
      },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    schema: { example: { valid: true } },
  })
  async validateRefreshToken(
    @Request() req: { user: { role: string } },
    @Param('id') id: string,
    @Body() body: RefreshTokenDto,
  ): Promise<{ valid: boolean }> {
    if (req.user.role !== 'admin') throw new ForbiddenException('Admin only');
    const valid = await this.usersService.validateRefreshToken(id, body.refreshToken);
    return { valid };
  }

  /**
   * Create new user (admin only)
   * @route POST /users
   * @param _req Request with user context (unused but required for auth)
   * @param createUserDto User creation data
   * @returns UserProfileDto Created user profile
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create new user',
    description: 'Creates a new user account (admin only).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password', 'firstName', 'lastName'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        password: { type: 'string', minLength: 8, example: 'password123' },
        firstName: { type: 'string', example: 'John' },
        lastName: { type: 'string', example: 'Doe' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'User created',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        status: { type: 'string' },
        lastLoginAt: { type: 'string', format: 'date-time', nullable: true },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async createUser(
    @Request() _req: { user: { status: string } },
    @Body() createUserDto: CreateUserDto,
  ): Promise<UserProfileDto> {
    const user = await this.usersService.create(createUserDto);
    return {
      id: user._id as string,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      lastLoginAt: user.lastLoginAt || null,
    };
  }
}
