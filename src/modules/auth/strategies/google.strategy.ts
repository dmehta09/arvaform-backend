import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

/**
 * Google OAuth 2.0 strategy for Passport.js
 * Handles Google authentication flow and user account linking
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID')!,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL')!,
      scope: ['email', 'profile'],
    });
  }

  /**
   * Validates Google OAuth profile and handles user account creation/linking
   * @param accessToken - OAuth access token
   * @param refreshToken - OAuth refresh token
   * @param profile - Google user profile
   * @param done - Passport callback function
   */
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: {
      id: string;
      name?: { givenName?: string; familyName?: string };
      emails?: Array<{ value: string; verified?: boolean }>;
      photos?: Array<{ value: string }>;
    },
    done: VerifyCallback,
  ): Promise<void> {
    try {
      const { id, name, emails, photos } = profile;

      // Extract primary email from Google profile
      const email = emails?.[0]?.value;
      if (!email) {
        return done(new Error('No email found in Google profile'), false);
      }

      // Prepare OAuth provider data
      const oauthData = {
        provider: 'google' as const,
        providerId: id,
        email,
        name: name ? `${name.givenName} ${name.familyName}` : undefined,
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
      console.error('Google OAuth validation error:', error);
      return done(error, false);
    }
  }
}
