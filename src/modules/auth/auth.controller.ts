/**
 * AuthController - Handles authentication endpoints for registration, login, token refresh, logout, and profile management.
 *
 * @controller
 * @route /auth
 * @group Authentication
 */
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ApiRateLimit,
  AuthRateLimit,
  RegistrationRateLimit,
} from '../../common/decorators/rate-limit.decorator';
import { AuthService, AuthTokens, LoginResponse } from './auth.service';
import { ChangePasswordDto, LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard, Public } from './guards/jwt.guard';

interface UserContext {
  userId: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  lastLoginAt: Date;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user account
   * @route POST /auth/register
   * @param registerDto User registration data
   * @returns LoginResponse Newly registered user and tokens
   */
  @Public()
  @RegistrationRateLimit() // Apply strict rate limiting for registration
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register new user account',
    description: 'Creates a new user account and returns authentication tokens.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: '...' },
        refreshToken: { type: 'string', example: '...' },
        expiresIn: { type: 'number', example: 900 },
        tokenType: { type: 'string', example: 'Bearer' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string' },
            lastLoginAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Validation failed or email already exists' })
  @ApiResponse({ status: 429, description: 'Too many registration attempts' })
  async register(@Body() registerDto: RegisterDto): Promise<LoginResponse> {
    return this.authService.register(registerDto);
  }

  /**
   * User login
   * @route POST /auth/login
   * @param loginDto User login credentials
   * @returns LoginResponse Authenticated user and tokens
   */
  @Public()
  @AuthRateLimit() // Apply authentication rate limiting
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticates user and returns JWT tokens.',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string', example: '...' },
        refreshToken: { type: 'string', example: '...' },
        expiresIn: { type: 'number', example: 900 },
        tokenType: { type: 'string', example: 'Bearer' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            role: { type: 'string' },
            lastLoginAt: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials or account locked' })
  @ApiResponse({ status: 429, description: 'Too many login attempts' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponse> {
    return this.authService.login(loginDto);
  }

  /**
   * Refresh access and refresh tokens
   * @route POST /auth/refresh
   * @param refreshToken Refresh token string
   * @returns AuthTokens New access and refresh tokens
   */
  @Public()
  @ApiRateLimit() // Apply standard API rate limiting
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Uses refresh token to generate new access and refresh tokens.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string', example: '...' } },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully', type: Object })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @ApiResponse({ status: 429, description: 'Too many refresh attempts' })
  async refresh(@Body('refreshToken') refreshToken: string): Promise<AuthTokens> {
    return this.authService.refreshTokens(refreshToken);
  }

  /**
   * Logout user (invalidate refresh token)
   * @route POST /auth/logout
   * @param req Request with user context
   * @param refreshToken Refresh token to invalidate
   * @returns Success message
   */
  @UseGuards(JwtAuthGuard)
  @ApiRateLimit() // Apply standard API rate limiting
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'User logout',
    description: 'Invalidates the current refresh token and logs out the user.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string', example: '...' } },
      required: ['refreshToken'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    schema: { example: { message: 'Logout successful' } },
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async logout(
    @Request() req: { user: UserContext },
    @Body('refreshToken') refreshToken: string,
  ): Promise<{ message: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }
    await this.authService.logout(req.user.userId, refreshToken);
    return { message: 'Logout successful' };
  }

  /**
   * Logout from all devices (invalidate all refresh tokens)
   * @route POST /auth/logout-all
   * @param req Request with user context
   * @returns Success message
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout from all devices',
    description: 'Invalidates all refresh tokens for the user, logging them out from all devices.',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out from all devices successfully',
    schema: { example: { message: 'Logged out from all devices successfully' } },
  })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async logoutFromAllDevices(@Request() req: { user: UserContext }): Promise<{ message: string }> {
    await this.authService.logoutFromAllDevices(req.user.userId);
    return { message: 'Logged out from all devices successfully' };
  }

  /**
   * Change user password
   * @route PATCH /auth/change-password
   * @param req Request with user context
   * @param changePasswordDto Change password data
   * @returns Success message
   */
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change user password',
    description:
      "Changes the user's password after validating the current password. Logs out from all devices for security.",
  })
  @ApiBody({ type: ChangePasswordDto })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    schema: { example: { message: 'Password changed successfully. Please login again.' } },
  })
  @ApiResponse({ status: 400, description: 'Current password is incorrect or validation failed' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  async changePassword(
    @Request() req: { user: UserContext },
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.authService.changePassword(req.user.userId, changePasswordDto);
    return { message: 'Password changed successfully. Please login again.' };
  }

  /**
   * Get authenticated user's profile
   * @route GET /auth/profile
   * @param req Request with user context
   * @returns UserContext Authenticated user profile
   */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get user profile',
    description: "Returns the authenticated user's profile information.",
  })
  @ApiResponse({ status: 200, description: 'User profile retrieved successfully', type: Object })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  getProfile(@Request() req: { user: UserContext }): UserContext {
    return req.user;
  }
}
