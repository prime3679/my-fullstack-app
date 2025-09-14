import { FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import { Logger } from './logger';

export interface SecurityConfig {
  environment: 'development' | 'production' | 'test';
  corsOrigins: string[];
  rateLimitMax?: number;
  rateLimitTimeWindow?: string;
}

export async function setupSecurity(fastify: FastifyInstance, config: SecurityConfig) {
  // Helmet for security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "wss:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: config.environment === 'production'
  });

  // CORS configuration
  await fastify.register(cors, {
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) return callback(null, true);
      
      // Check if origin is allowed
      const allowed = config.corsOrigins.some(allowed => {
        if (allowed === '*') return true;
        if (allowed.includes('*')) {
          const pattern = allowed.replace(/\*/g, '.*');
          return new RegExp(pattern).test(origin);
        }
        return origin === allowed;
      });

      if (allowed) {
        callback(null, true);
      } else {
        Logger.warn('CORS blocked request', { origin });
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: config.rateLimitMax || 100,
    timeWindow: config.rateLimitTimeWindow || '1 minute',
    cache: 10000,
    allowList: (req) => {
      // Exempt health checks from rate limiting
      return req.url === '/api/health';
    },
    redis: undefined, // Use in-memory store for now, switch to Redis in production
    skipOnError: false,
    keyGenerator: (req) => {
      // Use IP + user ID if authenticated
      const userId = (req as any).user?.id || 'anonymous';
      return `${req.ip}-${userId}`;
    },
    errorResponseBuilder: (req, context) => {
      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: `Rate limit exceeded, retry in ${context.after}`,
        date: Date.now(),
        expiresIn: context.ttl
      };
    }
  });

  // Additional security headers
  fastify.addHook('onSend', async (request, reply) => {
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Remove sensitive headers
    reply.removeHeader('X-Powered-By');
    reply.removeHeader('Server');
  });

  // Request validation hook
  fastify.addHook('preHandler', async (request, reply) => {
    // Validate Content-Type for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentType = request.headers['content-type'];
      if (!contentType || (!contentType.includes('application/json') && !contentType.includes('multipart/form-data'))) {
        Logger.warn('Invalid content-type', { 
          contentType, 
          method: request.method, 
          url: request.url 
        });
        return reply.code(415).send({ 
          error: 'Unsupported Media Type',
          message: 'Content-Type must be application/json or multipart/form-data'
        });
      }
    }

    // Log suspicious patterns
    const suspiciousPatterns = [
      /(\.\.|\/\/)/,  // Path traversal
      /<script/i,      // XSS attempts
      /union.*select/i, // SQL injection
      /\0/,            // Null bytes
    ];

    const url = request.url;
    const body = JSON.stringify(request.body || {});
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(url) || pattern.test(body)) {
        Logger.warn('Suspicious request pattern detected', {
          pattern: pattern.toString(),
          url,
          ip: request.ip,
          userAgent: request.headers['user-agent']
        });
        return reply.code(400).send({ 
          error: 'Bad Request',
          message: 'Invalid request format'
        });
      }
    }
  });

  Logger.info('Security middleware configured', {
    environment: config.environment,
    corsOrigins: config.corsOrigins,
    rateLimitMax: config.rateLimitMax,
    rateLimitTimeWindow: config.rateLimitTimeWindow
  });
}

// Input sanitization utilities
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove null bytes
    input = input.replace(/\0/g, '');
    // Trim whitespace
    input = input.trim();
    // Escape HTML entities
    input = input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  } else if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  } else if (input && typeof input === 'object') {
    const sanitized: any = {};
    for (const key in input) {
      if (input.hasOwnProperty(key)) {
        sanitized[key] = sanitizeInput(input[key]);
      }
    }
    return sanitized;
  }
  return input;
}

// Password strength validation
export function validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// JWT token validation
export function validateJWT(token: string): boolean {
  // Basic JWT format validation
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  
  // Check if each part is valid base64
  for (const part of parts) {
    if (!/^[A-Za-z0-9_-]+$/.test(part)) {
      return false;
    }
  }
  
  return true;
}

// SQL injection prevention for raw queries (if ever needed)
export function escapeSQLString(str: string): string {
  return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, (char) => {
    switch (char) {
      case '\0': return '\\0';
      case '\x08': return '\\b';
      case '\x09': return '\\t';
      case '\x1a': return '\\z';
      case '\n': return '\\n';
      case '\r': return '\\r';
      case '"':
      case "'":
      case '\\':
      case '%':
        return '\\' + char;
      default:
        return char;
    }
  });
}