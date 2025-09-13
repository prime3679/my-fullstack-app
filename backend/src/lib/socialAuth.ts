import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as AppleStrategy } from 'passport-apple';
import { prisma } from './db';
import { Logger } from './logger';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_change_in_production';

// Helper function to convert unknown errors to proper error objects
function formatError(error: unknown): { name: string; message: string; stack?: string; code?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }
  return { name: 'Unknown', message: String(error) };
}

interface SocialProfile {
  id: string;
  provider: 'google' | 'apple';
  email: string;
  name: string;
  picture?: string;
}

export class SocialAuthService {
  
  static initialize() {
    // Google OAuth Strategy
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/google/callback'
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          const socialProfile: SocialProfile = {
            id: profile.id,
            provider: 'google',
            email: profile.emails?.[0]?.value || '',
            name: profile.displayName || '',
            picture: profile.photos?.[0]?.value
          };
          
          const user = await SocialAuthService.findOrCreateUser(socialProfile);
          return done(undefined, user);
        } catch (error) {
          Logger.error('Google OAuth error', { error: formatError(error) });
          return done(error, undefined);
        }
      }));
    }

    // Apple OAuth Strategy
    if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
      passport.use(new AppleStrategy({
        clientID: process.env.APPLE_CLIENT_ID,
        teamID: process.env.APPLE_TEAM_ID,
        keyID: process.env.APPLE_KEY_ID,
        privateKey: process.env.APPLE_PRIVATE_KEY,
        callbackURL: process.env.APPLE_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/apple/callback',
        scope: ['email', 'name']
      }, async (accessToken: any, refreshToken: any, idToken: any, profile: any, done: any) => {
        try {
          // Apple provides minimal profile data
          const socialProfile: SocialProfile = {
            id: profile.id,
            provider: 'apple',
            email: profile.email || '',
            name: profile.name ? `${profile.name.firstName} ${profile.name.lastName}` : 'Apple User'
          };
          
          const user = await SocialAuthService.findOrCreateUser(socialProfile);
          return done(undefined, user);
        } catch (error) {
          Logger.error('Apple OAuth error', { error: formatError(error) });
          return done(error, undefined);
        }
      }));
    }

    // Serialize/deserialize for session management (though we'll use JWT)
    passport.serializeUser((user: any, done) => {
      done(undefined, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id },
          include: { dinerProfile: true }
        });
        done(undefined, user);
      } catch (error) {
        done(error, undefined);
      }
    });
  }

  static async findOrCreateUserWithStatus(socialProfile: SocialProfile) {
    try {
      // First, try to find user by email
      let user = await prisma.user.findUnique({
        where: { email: socialProfile.email },
        include: { dinerProfile: true }
      });

      if (user) {
        // User exists, update social login info if needed
        Logger.info('Existing user found for social login', {
          userId: user.id,
          provider: socialProfile.provider,
          email: socialProfile.email
        });

        // Log social login event
        await prisma.event.create({
          data: {
            kind: 'SOCIAL_LOGIN',
            actorId: user.id,
            payloadJson: {
              provider: socialProfile.provider,
              method: 'OAUTH'
            }
          }
        });

        return { user, isNewUser: false };
      }

      // User doesn't exist, create new user
      user = await prisma.user.create({
        data: {
          email: socialProfile.email,
          name: socialProfile.name,
          role: 'DINER',
          marketingOptIn: true, // Default to true for social users to receive welcome emails
          hashedPassword: undefined
        },
        include: { dinerProfile: true }
      });

      // Create basic diner profile
      await prisma.dinerProfile.create({
        data: {
          userId: user.id,
          allergensJson: undefined,
          dietaryTags: [],
          favoriteSkus: []
        }
      });

      // Log new user registration via social
      await prisma.event.create({
        data: {
          kind: 'USER_REGISTERED',
          actorId: user.id,
          payloadJson: {
            provider: socialProfile.provider,
            method: 'SOCIAL_OAUTH'
          }
        }
      });

      Logger.info('New user created via social login', {
        userId: user.id,
        provider: socialProfile.provider,
        email: socialProfile.email
      });

      return { user, isNewUser: true };

    } catch (error) {
      Logger.error('Social authentication failed', {
        error,
        email: socialProfile.email,
        provider: socialProfile.provider
      });
      throw error;
    }
  }

  static async findOrCreateUser(socialProfile: SocialProfile) {
    try {
      // First, try to find user by email
      let user = await prisma.user.findUnique({
        where: { email: socialProfile.email },
        include: { dinerProfile: true }
      });

      if (user) {
        // User exists, update social login info if needed
        Logger.info('Existing user found for social login', {
          userId: user.id,
          provider: socialProfile.provider,
          email: socialProfile.email
        });

        // Log social login event
        await prisma.event.create({
          data: {
            kind: 'SOCIAL_LOGIN',
            actorId: user.id,
            payloadJson: {
              provider: socialProfile.provider,
              method: 'OAUTH'
            }
          }
        });

        return user;
      }

      // User doesn't exist, create new user
      user = await prisma.user.create({
        data: {
          email: socialProfile.email,
          name: socialProfile.name,
          role: 'DINER',
          marketingOptIn: false,
          // Don't set password for social login users
          hashedPassword: undefined
        },
        include: { dinerProfile: true }
      });

      // Create basic diner profile
      await prisma.dinerProfile.create({
        data: {
          userId: user.id,
          allergensJson: undefined,
          dietaryTags: [],
          favoriteSkus: []
        }
      });

      // Log new user registration via social
      await prisma.event.create({
        data: {
          kind: 'USER_REGISTERED',
          actorId: user.id,
          payloadJson: {
            provider: socialProfile.provider,
            method: 'SOCIAL_OAUTH',
            registrationSource: 'web'
          }
        }
      });

      Logger.info('New user created via social login', {
        userId: user.id,
        provider: socialProfile.provider,
        email: socialProfile.email
      });

      return user;
    } catch (error) {
      Logger.error('Error in findOrCreateUser', { 
        error, 
        socialProfile: { 
          provider: socialProfile.provider, 
          email: socialProfile.email 
        } 
      });
      throw error;
    }
  }

  static generateJWT(user: any) {
    return jwt.sign(
      { 
        userId: user.id, 
        email: user.email,
        role: user.role,
        name: user.name
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  static async verifyGoogleToken(idToken: string): Promise<SocialProfile | undefined> {
    try {
      // For production, you'd verify the token with Google's API
      // For now, we'll use a simplified approach
      
      // In production, use google-auth-library:
      // const ticket = await client.verifyIdToken({
      //   idToken,
      //   audience: process.env.GOOGLE_CLIENT_ID
      // });
      // const payload = ticket.getPayload();
      
      // For demo purposes, return undefined to indicate token verification needed
      Logger.warn('Google token verification not implemented for production', { idToken: idToken.substring(0, 20) + '...' });
      return undefined;
    } catch (error) {
      Logger.error('Google token verification error', { error: formatError(error) });
      return undefined;
    }
  }

  static async verifyAppleToken(idToken: string): Promise<SocialProfile | undefined> {
    try {
      // For production, you'd verify the token with Apple's API
      // This requires decoding the JWT and verifying the signature
      
      Logger.warn('Apple token verification not implemented for production', { idToken: idToken.substring(0, 20) + '...' });
      return undefined;
    } catch (error) {
      Logger.error('Apple token verification error', { error: formatError(error) });
      return undefined;
    }
  }
}

// Types for request/response
export interface SocialLoginRequest {
  provider: 'google' | 'apple';
  idToken?: string;
  accessToken?: string;
  email?: string;
  name?: string;
}

export interface SocialLoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  error?: string;
  requiresOnboarding?: boolean;
}