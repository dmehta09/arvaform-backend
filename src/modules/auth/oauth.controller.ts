import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';

/**
 * OAuth authentication controller
 * Handles Google and GitHub OAuth authentication flows
 */
@ApiTags('OAuth Authentication')
@Controller('auth/oauth')
export class OAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  // Google OAuth Routes
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Initiate Google OAuth authentication' })
  async googleAuth() {
    // Guard redirects to Google OAuth
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Handle Google OAuth callback' })
  googleCallback(@Req() req: Request & { user?: Express.User }, @Res() res: Response) {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect(`${this.getFrontendUrl()}/auth/error?message=authentication_failed`);
      }

      // Generate JWT tokens for the authenticated user
      const tokens = this.generateTokensForUser(user);

      // Redirect to frontend with tokens (typically stored in secure cookies or local storage)
      const redirectUrl = `${this.getFrontendUrl()}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`;

      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      return res.redirect(`${this.getFrontendUrl()}/auth/error?message=callback_error`);
    }
  }

  // GitHub OAuth Routes
  @Get('github')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Initiate GitHub OAuth authentication' })
  async githubAuth() {
    // Guard redirects to GitHub OAuth
  }

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  @ApiOperation({ summary: 'Handle GitHub OAuth callback' })
  githubCallback(@Req() req: Request & { user?: Express.User }, @Res() res: Response) {
    try {
      const user = req.user;

      if (!user) {
        return res.redirect(`${this.getFrontendUrl()}/auth/error?message=authentication_failed`);
      }

      // Generate JWT tokens for the authenticated user
      const tokens = this.generateTokensForUser(user);

      // Redirect to frontend with tokens
      const redirectUrl = `${this.getFrontendUrl()}/auth/callback?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`;

      return res.redirect(redirectUrl);
    } catch (error) {
      console.error('GitHub OAuth callback error:', error);
      return res.redirect(`${this.getFrontendUrl()}/auth/error?message=callback_error`);
    }
  }

  /**
   * Generates JWT tokens for authenticated OAuth user
   */
  private generateTokensForUser(user: Express.User) {
    // Create JWT payload with proper typing
    const userObj = user as { _id?: string; id?: string; email?: string; status?: string };
    const _payload = {
      sub: userObj._id || userObj.id || '',
      email: userObj.email || '',
      status: userObj.status || 'active',
    };

    // Use the existing token generation logic from AuthService
    // Note: We need to add a public method to AuthService to generate tokens
    // For now, we'll need to implement this logic here or expose the method

    // Temporary implementation - this should be moved to AuthService
    return {
      accessToken: 'temp_access_token', // Replace with actual JWT generation
      refreshToken: 'temp_refresh_token', // Replace with actual JWT generation
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer',
    };
  }

  /**
   * Gets the frontend URL from configuration
   */
  private getFrontendUrl(): string {
    return this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }
}
