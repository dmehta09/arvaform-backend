# OAuth 2.0 Setup Guide

## Overview

This guide explains how to set up OAuth 2.0 authentication with Google and
GitHub for the ArvaForm backend.

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Google OAuth 2.0 Configuration
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_CALLBACK_URL=http://localhost:4000/auth/oauth/google/callback

# GitHub OAuth 2.0 Configuration
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here
GITHUB_CALLBACK_URL=http://localhost:4000/auth/oauth/github/callback

# Frontend URL for OAuth redirects
FRONTEND_URL=http://localhost:3000
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Credentials"
4. Click "Create Credentials" > "OAuth client ID"
5. Select "Web application" as the application type
6. Add authorized redirect URIs:
   - `http://localhost:4000/auth/oauth/google/callback` (development)
   - `https://yourdomain.com/auth/oauth/google/callback` (production)
7. Copy the Client ID and Client Secret to your environment variables

## GitHub OAuth Setup

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in the application details:
   - Application name: ArvaForm
   - Homepage URL: `http://localhost:3000` (development)
   - Authorization callback URL:
     `http://localhost:4000/auth/oauth/github/callback`
4. Copy the Client ID and Client Secret to your environment variables

## OAuth Flow

### Google OAuth Flow

1. User clicks "Sign in with Google"
2. Frontend redirects to: `GET /auth/oauth/google`
3. Backend redirects to Google OAuth consent screen
4. User authorizes the application
5. Google redirects to: `GET /auth/oauth/google/callback`
6. Backend processes the callback and generates JWT tokens
7. Backend redirects to frontend with tokens:
   `http://localhost:3000/auth/callback?token=...&refresh=...`

### GitHub OAuth Flow

1. User clicks "Sign in with GitHub"
2. Frontend redirects to: `GET /auth/oauth/github`
3. Backend redirects to GitHub OAuth consent screen
4. User authorizes the application
5. GitHub redirects to: `GET /auth/oauth/github/callback`
6. Backend processes the callback and generates JWT tokens
7. Backend redirects to frontend with tokens:
   `http://localhost:3000/auth/callback?token=...&refresh=...`

## API Endpoints

### Google OAuth

- **Initiate:** `GET /auth/oauth/google`
- **Callback:** `GET /auth/oauth/google/callback`

### GitHub OAuth

- **Initiate:** `GET /auth/oauth/github`
- **Callback:** `GET /auth/oauth/github/callback`

## Frontend Integration

The frontend OAuth callback page is located at:

- `arvaform-frontend/src/app/(auth)/oauth/callback/page.tsx`

This page handles:

- Token extraction from URL parameters
- Token storage (localStorage for development)
- Error handling
- Redirect to dashboard on success

## User Account Linking

The OAuth implementation supports:

- Creating new user accounts from OAuth profiles
- Linking OAuth providers to existing user accounts
- Updating OAuth provider tokens on subsequent logins
- Multiple OAuth providers per user account

## Security Considerations

1. **Token Storage**: In production, use secure HTTP-only cookies instead of
   localStorage
2. **HTTPS**: Always use HTTPS in production
3. **State Parameter**: Consider adding CSRF protection with state parameter
4. **Token Encryption**: OAuth tokens are stored encrypted in the database
5. **Rate Limiting**: OAuth endpoints are protected by rate limiting

## Testing

To test the OAuth implementation:

1. Start the backend server: `pnpm run start:dev`
2. Start the frontend server: `pnpm run dev`
3. Navigate to the OAuth initiation URLs:
   - `http://localhost:4000/auth/oauth/google`
   - `http://localhost:4000/auth/oauth/github`
4. Complete the OAuth flow and verify token generation

## Troubleshooting

### Common Issues

1. **Invalid Redirect URI**: Ensure callback URLs match exactly in OAuth
   provider settings
2. **Missing Scopes**: Verify that required scopes are requested (email, profile
   for Google; user:email for GitHub)
3. **Environment Variables**: Double-check that all OAuth environment variables
   are set correctly
4. **CORS Issues**: Ensure frontend URL is properly configured in CORS settings

### Debugging

Enable debug logging by setting the log level to debug in your NestJS
configuration:

```typescript
// main.ts
app.useLogger(['error', 'warn', 'log', 'debug', 'verbose']);
```

This will show detailed OAuth flow information in the console.
