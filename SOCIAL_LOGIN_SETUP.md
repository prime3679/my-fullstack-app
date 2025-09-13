# Social Login Setup Guide

This guide explains how to configure Google and Apple Sign-In for the La Carta platform.

## Overview

The social login system provides:
- ✅ Google Sign-In integration
- ✅ Apple Sign-In integration
- ✅ Automatic user account creation
- ✅ JWT token-based authentication
- ✅ Progressive onboarding flow
- ✅ Comprehensive error handling and logging

## Architecture

### Backend Components
- **SocialAuthService** (`/backend/src/lib/socialAuth.ts`) - Core authentication logic
- **OAuth Routes** (`/backend/src/routes/auth.ts`) - Social login endpoints
- **Passport Strategies** - Google OAuth 2.0 and Apple OAuth configurations

### Frontend Components
- **SocialLogin** (`/frontend/src/components/auth/SocialLogin.tsx`) - Social login buttons
- **AuthCallback** (`/frontend/src/app/auth/callback/page.tsx`) - OAuth redirect handler
- **QuickSignup** - Enhanced with social login options

## Setup Instructions

### 1. Google Sign-In Setup

#### Google Cloud Console Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure consent screen with your app details
6. Create OAuth client ID:
   - Application type: "Web application"
   - Authorized origins: `http://localhost:3000`, `http://localhost:3001`
   - Authorized redirect URIs: `http://localhost:3001/api/v1/auth/google/callback`

#### Environment Configuration:
```bash
# Backend (.env)
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:3001/api/v1/auth/google/callback"

# Frontend (.env.local)
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
```

### 2. Apple Sign-In Setup

#### Apple Developer Setup:
1. Go to [Apple Developer Console](https://developer.apple.com/account/)
2. Create an App ID with "Sign In with Apple" capability
3. Create a Service ID for your web app:
   - Configure domains: `localhost:3000`, `localhost:3001`
   - Configure redirect URLs: `http://localhost:3001/api/v1/auth/apple/callback`
4. Create a private key for Apple Sign-In
5. Note your Team ID, Key ID, and App ID

#### Environment Configuration:
```bash
# Backend (.env)
APPLE_CLIENT_ID="your.app.bundle.id"
APPLE_TEAM_ID="ABCD123456"
APPLE_KEY_ID="ABC123DEFG"  
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_CALLBACK_URL="http://localhost:3001/api/v1/auth/apple/callback"

# Frontend (.env.local)
NEXT_PUBLIC_APPLE_CLIENT_ID="your.app.bundle.id"
NEXT_PUBLIC_APPLE_REDIRECT_URI="http://localhost:3000/auth/apple/callback"
```

### 3. Testing Social Login

#### Demo Mode (No OAuth Setup Required):
The system includes demo/testing functionality that works without actual OAuth setup:

```bash
# The social login buttons will show "demo-client-id" 
# This allows UI/UX testing without OAuth configuration
```

#### Full OAuth Testing:
1. Configure environment variables with real OAuth credentials
2. Start both backend and frontend servers
3. Navigate to `/join` page
4. Click "Continue with Google" or "Continue with Apple"
5. Complete OAuth flow
6. User should be redirected back with authentication token

## API Endpoints

### Social Authentication
- `POST /api/v1/auth/social` - Token-based social login
- `GET /api/v1/auth/google` - Initiate Google OAuth flow
- `GET /api/v1/auth/google/callback` - Handle Google OAuth callback
- `GET /api/v1/auth/apple` - Initiate Apple OAuth flow  
- `POST /api/v1/auth/apple/callback` - Handle Apple OAuth callback

### Request/Response Examples

#### Token-based Social Login:
```javascript
POST /api/v1/auth/social
{
  "provider": "google",
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "email": "user@example.com",  // fallback for demo
  "name": "John Doe"           // fallback for demo
}

// Response:
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "user@example.com", 
    "name": "John Doe",
    "role": "DINER"
  },
  "requiresOnboarding": true
}
```

## User Flow

1. **User clicks social login button** → Frontend loads Google/Apple SDK
2. **OAuth popup opens** → User authenticates with provider
3. **Provider returns ID token** → Frontend receives authentication token
4. **Frontend calls API** → POST /api/v1/auth/social with token
5. **Backend verifies token** → Validates with Google/Apple servers
6. **User lookup/creation** → Find existing user or create new one
7. **JWT generation** → Generate La Carta authentication token
8. **Profile completion** → Check if onboarding needed
9. **Redirect to app** → User authenticated and ready to use app

## Security Features

- ✅ ID token verification with Google/Apple servers
- ✅ JWT token expiration (7 days)
- ✅ HTTPS-only cookies in production
- ✅ CORS protection
- ✅ Rate limiting on auth endpoints
- ✅ Comprehensive audit logging
- ✅ Error handling without information leakage

## Database Schema

Social login integrates with existing User model:
- Uses existing `email` field as unique identifier
- Sets `role` to "DINER" for social signups
- Leaves `hashedPassword` as null (social-only users)
- Creates basic `DinerProfile` for preferences

## Troubleshooting

### Common Issues:

#### Google OAuth Issues:
- **"redirect_uri_mismatch"** → Check authorized redirect URIs in Google Console
- **"invalid_client"** → Verify client ID and secret are correct
- **"access_denied"** → User canceled OAuth flow or insufficient permissions

#### Apple OAuth Issues:  
- **"invalid_client"** → Check App ID, Team ID, and Key ID configuration
- **"invalid_key"** → Verify private key format and Key ID association
- **"invalid_scope"** → Ensure "name email" scope is requested

#### Frontend Issues:
- **SDK not loading** → Check network connectivity and script sources
- **Popup blocked** → User needs to allow popups for OAuth
- **Token verification failed** → Backend can't verify provider tokens

### Debug Logging:
Check backend logs for detailed OAuth flow information:
```bash
# Backend logs show:
# - OAuth provider responses
# - Token verification attempts  
# - User creation/lookup results
# - JWT generation success/failure
```

## Production Deployment

### Security Checklist:
- [ ] Use HTTPS for all OAuth redirect URIs
- [ ] Configure proper CORS origins
- [ ] Set secure JWT secret (min 32 characters)
- [ ] Enable rate limiting on auth endpoints
- [ ] Configure proper OAuth app verification (Google)
- [ ] Set up Apple App Store Connect for production Apple Sign-In
- [ ] Use environment-specific OAuth client IDs
- [ ] Enable audit logging for production monitoring

### Monitoring:
The system logs all social authentication events for monitoring:
- `SOCIAL_LOGIN` - Successful social authentication
- `USER_REGISTERED` - New user created via social login
- `SOCIAL_AUTH_CALLBACK_SUCCESS` - OAuth callback processed
- Various error events for debugging

This comprehensive social login system provides a smooth, secure authentication experience that integrates seamlessly with La Carta's existing user management and onboarding flows.