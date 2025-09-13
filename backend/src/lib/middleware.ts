import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import Logger from './logger';

interface RequestContext {
  requestId: string;
  startTime: number;
  userId?: string;
  ip: string;
  userAgent: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    context: RequestContext;
  }
}

export async function requestLoggingPlugin(fastify: FastifyInstance) {
  // Add request context
  fastify.decorateRequest('context', null);
  
  // Pre-handler hook to initialize context and log incoming requests
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const startTime = Date.now();
    const requestId = randomUUID();
    
    request.context = {
      requestId,
      startTime,
      ip: request.ip,
      userAgent: request.headers['user-agent'] || 'unknown'
    };

    Logger.info('Incoming request', {
      requestId,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      method: request.method,
      route: request.url,
      action: `${request.method} ${request.routerPath || request.url}`
    });
  });

  // Response hook to log request completion and performance
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.context) return;

    const duration = Date.now() - request.context.startTime;
    const statusCode = reply.statusCode;
    
    Logger.performance(
      request.routerPath || request.url,
      request.method,
      duration,
      {
        requestId: request.context.requestId,
        ip: request.context.ip,
        userAgent: request.context.userAgent,
        userId: request.context.userId
      }
    );

    const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    const message = `Request completed: ${request.method} ${request.url} - ${statusCode} in ${duration}ms`;
    
    Logger[logLevel](message, {
      requestId: request.context.requestId,
      ip: request.context.ip,
      userAgent: request.context.userAgent,
      userId: request.context.userId,
      performance: {
        duration,
        method: request.method,
        route: request.routerPath || request.url
      }
    });
  });

  // Error handler hook
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    Logger.error('Request error', {
      requestId: request.context?.requestId,
      ip: request.context?.ip,
      userAgent: request.context?.userAgent,
      userId: request.context?.userId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      }
    });
  });
}

export function auditMiddleware(action: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    Logger.audit(action, {
      requestId: request.context?.requestId,
      ip: request.context?.ip,
      userAgent: request.context?.userAgent,
      userId: request.context?.userId,
      action
    });
  };
}

export function businessEventLogger(event: string, context?: Record<string, any>) {
  return (request: FastifyRequest) => {
    Logger.business(event, {
      requestId: request.context?.requestId,
      userId: request.context?.userId,
      ...context
    });
  };
}