import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-github2';
import { AuthService } from '../auth.service';

/**
 * GitHub OAuth 2.0 strategy for Passport.js
 * Handles GitHub authentication flow and user account linking
 */
@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    // Get OAuth credentials with fallbacks for development
    const clientID =
      configService.get<string>('GITHUB_CLIENT_ID') || 'placeholder-github-client-id';
    const clientSecret =
      configService.get<string>('GITHUB_CLIENT_SECRET') || 'placeholder-github-client-secret';
    const callbackURL =
      configService.get<string>('GITHUB_CALLBACK_URL') ||
      'http://localhost:3001/api/v1/auth/oauth/github/callback';

    // Log warning if using placeholder values
    if (
      clientID === 'placeholder-github-client-id' ||
      clientSecret === 'placeholder-github-client-secret'
    ) {
      console.warn(
        '⚠️  GitHub OAuth credentials not configured. OAuth login will not work until proper credentials are set.',
      );
      console.warn(
        '   Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['user:email'],
    });
  }

  /**
   * Validates GitHub OAuth profile and handles user account creation/linking
   * @param accessToken - OAuth access token
   * @param refreshToken - OAuth refresh token
   * @param profile - GitHub user profile
   * @param done - Passport callback function
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      username?: string;
      displayName?: string;
      emails?: Array<{ value: string; primary?: boolean; verified?: boolean }>;
      photos?: Array<{ value: string }>;
    },
    done: (error: Error | null, user?: false | Express.User) => void,
  ): Promise<void> {
    try {
      const { id, username, displayName, emails, photos } = profile;

      // Extract primary email from GitHub profile
      const primaryEmail = emails?.find(email => email.primary)?.value || emails?.[0]?.value;
      if (!primaryEmail) {
        return done(new Error('No email found in GitHub profile'), false);
      }

      // Prepare OAuth provider data
      const oauthData = {
        provider: 'github' as const,
        providerId: id,
        email: primaryEmail,
        name: displayName || username,
        avatar: photos?.[0]?.value,
        accessToken,
        refreshToken,
        connectedAt: new Date(),
      };

      // Find or create user with OAuth provider
      const user = await this.authService.findOrCreateOAuthUser(oauthData);

      if (!user) {
        return done(new Error('Failed to create or find user'), false);
      }

      return done(null, user);
    } catch (error) {
      // Log error for monitoring and debugging
      console.error('GitHub OAuth validation error:', error);
      return done(error instanceof Error ? error : new Error('Unknown OAuth error'), false);
    }
  }
}
