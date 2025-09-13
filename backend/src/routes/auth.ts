import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import passport from 'passport';
import { db } from '../lib/db';
import Logger from '../lib/logger';
import { businessEventLogger } from '../lib/middleware';
import { SocialAuthService, SocialLoginRequest, SocialLoginResponse } from '../lib/socialAuth';
import { emailService, WelcomeSequenceContext } from '../lib/emailService';

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

// Validation schemas
const signupSchema = z.object({
  phone: z.string().min(10).max(15),
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  dietaryPreferences: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  marketingOptIn: z.boolean().default(false),
  referralSource: z.string().optional(),
  restaurantId: z.string().optional()
});

const signinSchema = z.object({
  identifier: z.string(), // phone or email
  password: z.string().optional(),
  verificationCode: z.string().optional() // For SMS-based auth
});

const verifyPhoneSchema = z.object({
  phone: z.string(),
  code: z.string().length(6)
});

const socialLoginSchema = z.object({
  provider: z.enum(['google', 'apple']),
  idToken: z.string().optional(),
  accessToken: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional()
});

interface AuthRequest extends FastifyRequest {
  user?: {
    id: string;
    role: string;
    restaurantId?: string;
  };
}

// JWT secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

export async function authRoutes(fastify: FastifyInstance) {
  
  // Sign up - Optimized for speed
  fastify.post('/signup', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const validatedData = signupSchema.parse(request.body);
      const { phone, name, email, password, dietaryPreferences, allergies, marketingOptIn, referralSource, restaurantId } = validatedData;

      // Check if user already exists
      const existingUser = await db.user.findFirst({
        where: {
          OR: [
            { phone },
            ...(email ? [{ email }] : [])
          ]
        }
      });

      if (existingUser) {
        return reply.code(409).send({ error: 'User already exists with this phone or email' });
      }

      // Generate verification code for phone
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Hash password if provided, otherwise we'll use SMS verification
      const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

      // Create user
      const user = await db.user.create({
        data: {
          phone,
          name,
          email: email || null,
          hashedPassword,
          marketingOptIn,
          restaurantId: restaurantId || null,
          role: 'DINER'
        }
      });

      // Create diner profile if dietary info provided
      if (dietaryPreferences?.length || allergies?.length) {
        await db.dinerProfile.create({
          data: {
            userId: user.id,
            dietaryTags: dietaryPreferences || [],
            allergensJson: allergies || []
          }
        });
      }

      // Log business event
      businessEventLogger('USER_SIGNUP', {
        userId: user.id,
        referralSource,
        restaurantId,
        signupMethod: password ? 'password' : 'sms'
      })(request);

      // TODO: Send SMS verification code (integrate with Twilio/AWS SNS)
      Logger.info('SMS verification code generated', { 
        userId: user.id, 
        phone, 
        code: verificationCode // Remove in production
      });

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          role: user.role, 
          restaurantId: user.restaurantId 
        }, 
        JWT_SECRET, 
        { expiresIn: '30d' }
      );

      // Start welcome email sequence if user has email and opted into marketing
      if (user.email && user.marketingOptIn) {
        const welcomeContext: WelcomeSequenceContext = {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          registrationMethod: password ? 'email' : 'phone',
          referralSource: referralSource,
          restaurantId: user.restaurantId || undefined
        };

        try {
          await emailService.startWelcomeSequence(welcomeContext);
          Logger.info('Welcome email sequence started', { userId: user.id });
        } catch (error) {
          Logger.error('Failed to start welcome email sequence', { error, userId: user.id });
          // Don't fail signup if email fails
        }
      }

      return {
        success: true,
        message: 'Account created! Check your phone for verification.',
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          marketingOptIn: user.marketingOptIn
        },
        token,
        verificationRequired: !password // If no password, require SMS verification
      };

    } catch (error) {
      Logger.error('Signup failed', {
        error: {
          name: (error as Error).name,
          message: (error as Error).message
        },
        requestId: (request as any).context?.requestId
      });

      if (error instanceof z.ZodError) {
        return reply.code(400).send({ error: 'Validation failed', details: error.issues || [] });
      }

      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Sign in
  fastify.post('/signin', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { identifier, password, verificationCode } = signinSchema.parse(request.body);

      // Find user by phone or email
      const user = await db.user.findFirst({
        where: {
          OR: [
            { phone: identifier },
            { email: identifier }
          ]
        },
        include: {
          dinerProfile: true
        }
      });

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Verify password or SMS code
      let authenticated = false;
      
      if (password && user.hashedPassword) {
        authenticated = await bcrypt.compare(password, user.hashedPassword);
      } else if (verificationCode) {
        // TODO: Verify SMS code (implement with your SMS provider)
        authenticated = verificationCode.length === 6; // Simplified for demo
      }

      if (!authenticated) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          role: user.role, 
          restaurantId: user.restaurantId 
        }, 
        JWT_SECRET, 
        { expiresIn: '30d' }
      );

      // Log business event
      businessEventLogger('USER_SIGNIN', {
        userId: user.id,
        method: password ? 'password' : 'sms'
      })(request);

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          restaurantId: user.restaurantId,
          dinerProfile: user.dinerProfile
        },
        token
      };

    } catch (error) {
      Logger.error('Signin failed', {
        error: {
          name: (error as Error).name,
          message: (error as Error).message
        }
      });

      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Quick phone signup (for fastest onboarding)
  fastify.post('/signup/quick', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { phone, name } = z.object({
        phone: z.string().min(10),
        name: z.string().min(2)
      }).parse(request.body);

      // Check if user exists
      const existingUser = await db.user.findUnique({ where: { phone } });
      if (existingUser) {
        return reply.code(409).send({ error: 'Phone number already registered' });
      }

      // Create user with minimal info
      const user = await db.user.create({
        data: {
          phone,
          name,
          role: 'DINER',
          marketingOptIn: false
        }
      });

      // Generate verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // TODO: Send SMS
      Logger.info('Quick signup SMS sent', { userId: user.id, phone, code: verificationCode });

      // Log business event
      businessEventLogger('USER_QUICK_SIGNUP', {
        userId: user.id
      })(request);

      return {
        success: true,
        message: `Verification code sent to ${phone}`,
        userId: user.id,
        verificationRequired: true
      };

    } catch (error) {
      Logger.error('Quick signup failed', { error: formatError(error) });
      return reply.code(500).send({ error: 'Signup failed' });
    }
  });

  // Verify phone number
  fastify.post('/verify-phone', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { phone, code } = verifyPhoneSchema.parse(request.body);

      // TODO: Verify actual SMS code with your provider
      // For demo, accept any 6-digit code
      if (code.length !== 6) {
        return reply.code(400).send({ error: 'Invalid verification code' });
      }

      const user = await db.user.findUnique({ 
        where: { phone },
        include: { dinerProfile: true }
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          role: user.role, 
          restaurantId: user.restaurantId 
        }, 
        JWT_SECRET, 
        { expiresIn: '30d' }
      );

      // Log business event
      businessEventLogger('PHONE_VERIFIED', {
        userId: user.id
      })(request);

      return {
        success: true,
        message: 'Phone verified successfully',
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          dinerProfile: user.dinerProfile
        },
        token
      };

    } catch (error) {
      Logger.error('Phone verification failed', { error: formatError(error) });
      return reply.code(500).send({ error: 'Verification failed' });
    }
  });

  // Get current user profile
  fastify.get('/me', {
    preHandler: [authenticateToken]
  }, async (request: AuthRequest, reply: FastifyReply) => {
    try {
      const user = await db.user.findUnique({
        where: { id: request.user!.id },
        include: {
          dinerProfile: true,
          restaurant: request.user!.restaurantId ? {
            select: {
              id: true,
              name: true,
              slug: true
            }
          } : false
        }
      });

      if (!user) {
        return reply.code(404).send({ error: 'User not found' });
      }

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          role: user.role,
          restaurantId: user.restaurantId,
          restaurant: user.restaurant,
          dinerProfile: user.dinerProfile,
          marketingOptIn: user.marketingOptIn
        }
      };

    } catch (error) {
      Logger.error('Get user profile failed', { error: formatError(error) });
      return reply.code(500).send({ error: 'Failed to get profile' });
    }
  });

  // Social login with token verification
  fastify.post('/social', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { provider, idToken, accessToken, email, name } = socialLoginSchema.parse(request.body);

      if (!idToken && !accessToken && !email) {
        return reply.code(400).send({ 
          error: 'Either idToken, accessToken, or email is required' 
        });
      }

      let socialProfile = null;

      // Verify token with provider (simplified for demo)
      if (idToken) {
        if (provider === 'google') {
          socialProfile = await SocialAuthService.verifyGoogleToken(idToken);
        } else if (provider === 'apple') {
          socialProfile = await SocialAuthService.verifyAppleToken(idToken);
        }
      }

      // Fallback to provided email/name for demo purposes
      if (!socialProfile && email && name) {
        socialProfile = {
          id: `${provider}_${email}`,
          provider,
          email,
          name
        };
      }

      if (!socialProfile) {
        return reply.code(400).send({ 
          error: 'Unable to verify social login credentials' 
        });
      }

      // Find or create user
      const { user, isNewUser } = await SocialAuthService.findOrCreateUserWithStatus(socialProfile);
      const token = SocialAuthService.generateJWT(user);

      // Start welcome email sequence for new social users
      if (isNewUser && user.email && user.marketingOptIn) {
        const welcomeContext: WelcomeSequenceContext = {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          registrationMethod: socialProfile.provider as 'google' | 'apple',
          referralSource: 'social_login'
        };

        try {
          await emailService.startWelcomeSequence(welcomeContext);
          Logger.info('Welcome email sequence started for social user', { userId: user.id, provider: socialProfile.provider });
        } catch (error) {
          Logger.error('Failed to start welcome email sequence for social user', { error, userId: user.id });
          // Don't fail login if email fails
        }
      }

      // Check if user needs to complete onboarding
      const requiresOnboarding = !user.dinerProfile || 
        !user.dinerProfile.dietaryTags.length ||
        user.dinerProfile.allergensJson === null;

      const response: SocialLoginResponse = {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        requiresOnboarding
      };

      Logger.info('Social login successful', { 
        userId: user.id, 
        provider, 
        requiresOnboarding 
      });

      return response;

    } catch (error) {
      Logger.error('Social login failed', { error: formatError(error) });

      if (error instanceof z.ZodError) {
        return reply.code(400).send({ 
          success: false, 
          error: 'Invalid request data',
          details: error.issues || []
        });
      }

      return reply.code(500).send({ 
        success: false, 
        error: 'Social login failed' 
      });
    }
  });

  // Google OAuth redirect routes
  fastify.get('/google', (request, reply) => {
    const redirectURL = passport.authenticate('google', { 
      scope: ['profile', 'email'] 
    })(request, reply, () => {});
  });

  fastify.get('/google/callback', (request, reply) => {
    passport.authenticate('google', { 
      failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed` 
    }, async (err, user) => {
      if (err || !user) {
        Logger.error('Google OAuth callback error', { err });
        return reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=google_auth_failed`);
      }

      try {
        const token = SocialAuthService.generateJWT(user);
        
        // Redirect to frontend with token
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&provider=google`;
        reply.redirect(redirectUrl);
      } catch (error) {
        Logger.error('Google OAuth token generation error', { error: formatError(error) });
        reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=token_generation_failed`);
      }
    })(request, reply);
  });

  // Apple OAuth redirect routes
  fastify.get('/apple', (request, reply) => {
    passport.authenticate('apple')(request, reply);
  });

  fastify.post('/apple/callback', (request, reply) => {
    passport.authenticate('apple', { 
      failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=apple_auth_failed` 
    }, async (err, user) => {
      if (err || !user) {
        Logger.error('Apple OAuth callback error', { err });
        return reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=apple_auth_failed`);
      }

      try {
        const token = SocialAuthService.generateJWT(user);
        
        // Redirect to frontend with token
        const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/callback?token=${token}&provider=apple`;
        reply.redirect(redirectUrl);
      } catch (error) {
        Logger.error('Apple OAuth token generation error', { error: formatError(error) });
        reply.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/login?error=token_generation_failed`);
      }
    })(request, reply);
  });
}

// Authentication middleware
export async function authenticateToken(request: AuthRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return reply.code(401).send({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    request.user = {
      id: decoded.userId,
      role: decoded.role,
      restaurantId: decoded.restaurantId
    };

  } catch (error) {
    return reply.code(403).send({ error: 'Invalid or expired token' });
  }
}