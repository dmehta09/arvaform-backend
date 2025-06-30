/**
 * OAuth 2.0 Service for Integration Framework
 * Handles authentication flows, token management, and security
 *
 * @author ArvaForm Integration Team
 * @since 2025-01-14
 */
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { OAuthConfig, OAuthGrantType, OAuthProvider } from '../types/integration.types';

// Additional types for OAuth service
export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  tokenType: string;
}

export type OAuthTokens = OAuthCredentials;

/**
 * OAuth service for managing third-party authentication
 * Provides secure token management and authentication flows
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-gcm';

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey =
      this.configService.get<string>('OAUTH_ENCRYPTION_KEY') || this.generateEncryptionKey();
  }

  /**
   * Generates OAuth authorization URL for provider
   */
  generateAuthUrl(provider: OAuthProvider, config: OAuthConfig, state: string): string {
    try {
      const baseUrl = this.getProviderAuthUrl(provider);
      const params = new URLSearchParams({
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        response_type: 'code',
        state: state,
        scope: this.formatScopes(config.scope || []),
        access_type: 'offline',
        prompt: 'consent',
      });

      this.addProviderSpecificParams(provider, params);

      const authUrl = `${baseUrl}?${params.toString()}`;
      this.logger.log(`Generated auth URL for ${provider}`);

      return authUrl;
    } catch (error) {
      this.logger.error(`Failed to generate auth URL for ${provider}:`, error);
      throw new BadRequestException(`Failed to generate authorization URL for ${provider}`);
    }
  }

  /**
   * Exchanges authorization code for access tokens
   */
  async exchangeCodeForTokens(
    provider: OAuthProvider,
    code: string,
    config: OAuthConfig,
  ): Promise<OAuthTokens> {
    try {
      const tokenUrl = this.getProviderTokenUrl(provider);
      const payload = {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        grant_type: OAuthGrantType.AUTHORIZATION_CODE,
        redirect_uri: config.redirectUri,
      };

      this.logger.log(`Exchanging code for tokens with ${provider}`);
      const response = await this.makeTokenRequest(tokenUrl, payload);

      const tokens = this.parseTokenResponse(response.data);
      this.logger.log(`Successfully obtained tokens for ${provider}`);

      return tokens;
    } catch (error) {
      this.logger.error(`Token exchange failed for ${provider}:`, error);
      throw new UnauthorizedException(`Failed to exchange authorization code for tokens`);
    }
  }

  /**
   * Refreshes access token using refresh token
   */
  async refreshAccessToken(
    provider: OAuthProvider,
    refreshToken: string,
    config: OAuthConfig,
  ): Promise<OAuthTokens> {
    try {
      const tokenUrl = this.getProviderTokenUrl(provider);
      const payload = {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: OAuthGrantType.REFRESH_TOKEN,
      };

      this.logger.log(`Refreshing access token for ${provider}`);
      const response = await this.makeTokenRequest(tokenUrl, payload);

      const tokens = this.parseTokenResponse(response.data);

      if (!tokens.refreshToken) {
        tokens.refreshToken = refreshToken;
      }

      this.logger.log(`Successfully refreshed tokens for ${provider}`);
      return tokens;
    } catch (error) {
      this.logger.error(`Token refresh failed for ${provider}:`, error);
      throw new UnauthorizedException(`Failed to refresh access token`);
    }
  }

  /**
   * Validates access token with provider
   */
  async validateToken(provider: OAuthProvider, accessToken: string): Promise<boolean> {
    try {
      const validationUrl = this.getProviderValidationUrl(provider);
      if (!validationUrl) {
        return true;
      }

      const response = await axios.get(validationUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 5000,
      });

      const isValid = response.status === 200;
      this.logger.log(`Token validation for ${provider}: ${isValid ? 'valid' : 'invalid'}`);

      return isValid;
    } catch (error) {
      this.logger.warn(`Token validation failed for ${provider}:`, error.message);
      return false;
    }
  }

  /**
   * Encrypts OAuth credentials for secure storage
   */
  encryptCredentials(credentials: OAuthCredentials): string {
    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);

      const credentialsJson = JSON.stringify(credentials);
      let encrypted = cipher.update(credentialsJson, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      const encryptedData = {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encrypted: encrypted,
      };

      return Buffer.from(JSON.stringify(encryptedData)).toString('base64');
    } catch (error) {
      this.logger.error('Failed to encrypt credentials:', error);
      throw new Error('Credential encryption failed');
    }
  }

  /**
   * Decrypts OAuth credentials from storage
   */
  decryptCredentials(encryptedCredentials: string): OAuthCredentials {
    try {
      const encryptedData = JSON.parse(Buffer.from(encryptedCredentials, 'base64').toString());
      const decipher = createDecipheriv(
        this.algorithm,
        Buffer.from(this.encryptionKey, 'hex'),
        Buffer.from(encryptedData.iv, 'hex'),
      );

      decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));

      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted) as OAuthCredentials;
    } catch (error) {
      this.logger.error('Failed to decrypt credentials:', error);
      throw new UnauthorizedException('Invalid or corrupted credentials');
    }
  }

  /**
   * Checks if tokens need refresh
   */
  needsTokenRefresh(tokens: OAuthTokens, bufferMinutes: number = 5): boolean {
    if (!tokens.expiresAt) {
      return false;
    }

    const expiryTime = new Date(tokens.expiresAt);
    const bufferTime = new Date(Date.now() + bufferMinutes * 60 * 1000);

    return expiryTime <= bufferTime;
  }

  private getProviderAuthUrl(provider: OAuthProvider): string {
    const urls = {
      [OAuthProvider.GOOGLE]: 'https://accounts.google.com/o/oauth2/v2/auth',
      [OAuthProvider.MICROSOFT]: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
      [OAuthProvider.SALESFORCE]: 'https://login.salesforce.com/services/oauth2/authorize',
      [OAuthProvider.HUBSPOT]: 'https://app.hubspot.com/oauth/authorize',
      [OAuthProvider.ZAPIER]: 'https://zapier.com/oauth/authorize',
      [OAuthProvider.SLACK]: 'https://slack.com/oauth/v2/authorize',
      [OAuthProvider.CUSTOM]: '',
    };
    return urls[provider] || '';
  }

  private getProviderTokenUrl(provider: OAuthProvider): string {
    const urls = {
      [OAuthProvider.GOOGLE]: 'https://oauth2.googleapis.com/token',
      [OAuthProvider.MICROSOFT]: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
      [OAuthProvider.SALESFORCE]: 'https://login.salesforce.com/services/oauth2/token',
      [OAuthProvider.HUBSPOT]: 'https://api.hubapi.com/oauth/v1/token',
      [OAuthProvider.ZAPIER]: 'https://zapier.com/oauth/token',
      [OAuthProvider.SLACK]: 'https://slack.com/api/oauth.v2.access',
      [OAuthProvider.CUSTOM]: '',
    };
    return urls[provider] || '';
  }

  private getProviderValidationUrl(provider: OAuthProvider): string | null {
    const urls = {
      [OAuthProvider.GOOGLE]: 'https://www.googleapis.com/oauth2/v1/tokeninfo',
      [OAuthProvider.MICROSOFT]: 'https://graph.microsoft.com/v1.0/me',
      [OAuthProvider.SALESFORCE]: null,
      [OAuthProvider.HUBSPOT]: 'https://api.hubapi.com/oauth/v1/access-tokens',
      [OAuthProvider.ZAPIER]: null,
      [OAuthProvider.SLACK]: 'https://slack.com/api/auth.test',
      [OAuthProvider.CUSTOM]: null,
    };
    return urls[provider] || null;
  }

  private formatScopes(scopes: string[]): string {
    return scopes.join(' ');
  }

  private addProviderSpecificParams(provider: OAuthProvider, params: URLSearchParams): void {
    switch (provider) {
      case OAuthProvider.MICROSOFT:
        params.set('response_mode', 'query');
        break;
      case OAuthProvider.SLACK:
        params.set('user_scope', 'identity.basic');
        break;
      default:
        break;
    }
  }

  private async makeTokenRequest(
    url: string,
    payload: Record<string, string>,
  ): Promise<AxiosResponse> {
    return axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      timeout: 10000,
    });
  }

  private parseTokenResponse(data: Record<string, unknown>): OAuthTokens {
    const accessToken = data.access_token as string;
    const refreshToken = data.refresh_token as string;
    const expiresIn = data.expires_in as number;
    const scope = data.scope as string;

    if (!accessToken) {
      throw new Error('No access token in response');
    }

    const tokens: OAuthTokens = {
      accessToken,
      refreshToken,
      scope,
      tokenType: (data.token_type as string) || 'Bearer',
    };

    if (expiresIn) {
      tokens.expiresAt = new Date(Date.now() + expiresIn * 1000);
    }

    return tokens;
  }

  private generateEncryptionKey(): string {
    const key = randomBytes(32).toString('hex');
    this.logger.warn(
      'Generated new encryption key - ensure OAUTH_ENCRYPTION_KEY is set in production',
    );
    return key;
  }
}
