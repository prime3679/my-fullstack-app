import { pino } from 'pino';

export interface LogContext {
  requestId?: string;
  userId?: string;
  restaurantId?: string;
  reservationId?: string;
  action?: string;
  ip?: string;
  userAgent?: string;
  performance?: {
    duration: number;
    method: string;
    route: string;
  };
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  // Allow additional properties for flexible logging
  [key: string]: any;
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label: string) => ({ level: label.toUpperCase() }),
  },
  timestamp: () => `,"time":"${new Date().toISOString()}"`,
  redact: {
    paths: ['password', 'token', 'secret', 'authorization'],
    censor: '[REDACTED]'
  }
});

/**
 * Convert unknown error to LogContext error format
 */
export function toLogError(error: unknown): { name: string; message: string; stack?: string; code?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }
  return {
    name: 'UnknownError',
    message: String(error)
  };
}

export class Logger {
  static info(message: string, context?: LogContext) {
    logger.info(context, message);
  }

  static warn(message: string, context?: LogContext) {
    logger.warn(context, message);
  }

  static error(message: string, context?: LogContext) {
    logger.error(context, message);
  }

  static debug(message: string, context?: LogContext) {
    logger.debug(context, message);
  }

  static audit(action: string, context?: LogContext) {
    logger.info({
      ...context,
      action,
      type: 'AUDIT'
    }, `Audit: ${action}`);
  }

  static performance(route: string, method: string, duration: number, context?: LogContext) {
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    logger[level]({
      ...context,
      performance: { duration, method, route },
      type: 'PERFORMANCE'
    }, `Performance: ${method} ${route} took ${duration}ms`);
  }

  static security(event: string, context?: LogContext) {
    logger.warn({
      ...context,
      type: 'SECURITY'
    }, `Security Event: ${event}`);
  }

  static business(event: string, context?: LogContext) {
    logger.info({
      ...context,
      type: 'BUSINESS'
    }, `Business Event: ${event}`);
  }
}

export default Logger;