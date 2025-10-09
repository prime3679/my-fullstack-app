'use client';

import { API_BASE } from './api';

interface LogContext {
  userId?: string;
  sessionId?: string;
  page?: string;
  action?: string;
  type?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  performance?: {
    duration: number;
    operation: string;
  };
  userAgent?: string;
  url?: string;
  [key: string]: unknown;
}

export class ClientLogger {
  private static sessionId = typeof window !== 'undefined' ? 
    sessionStorage.getItem('sessionId') || this.generateSessionId() : '';

  private static generateSessionId(): string {
    const sessionId = Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  private static getContext(): Partial<LogContext> {
    if (typeof window === 'undefined') return {};
    
    return {
      sessionId: this.sessionId,
      page: window.location.pathname,
      url: window.location.href,
      userAgent: navigator.userAgent
    };
  }

  private static async sendLog(level: string, message: string, context?: LogContext) {
    if (typeof window === 'undefined') return;

    const logData = {
      level: level.toUpperCase(),
      message,
      timestamp: new Date().toISOString(),
      ...this.getContext(),
      ...context
    };

    // In development, log to console
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${level.toUpperCase()}]`, message, context);
    }

    // Send to backend logging endpoint (implement as needed)
    try {
      await fetch(`${API_BASE}/logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logData)
      });
    } catch (error) {
      // Silently fail - don't log errors about logging
      console.warn('Failed to send log to server:', error);
    }
  }

  static info(message: string, context?: LogContext) {
    this.sendLog('info', message, context);
  }

  static warn(message: string, context?: LogContext) {
    this.sendLog('warn', message, context);
  }

  static error(message: string, context?: LogContext) {
    this.sendLog('error', message, context);
  }

  static debug(message: string, context?: LogContext) {
    this.sendLog('debug', message, context);
  }

  static userAction(action: string, context?: LogContext) {
    this.info(`User Action: ${action}`, { ...context, action });
  }

  static performance(operation: string, duration: number, context?: LogContext) {
    const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';
    this.sendLog(level, `Performance: ${operation} took ${duration}ms`, {
      ...context,
      performance: { duration, operation }
    });
  }

  static pageView(page: string, context?: LogContext) {
    this.info(`Page View: ${page}`, { ...context, page, action: 'PAGE_VIEW' });
  }

  static apiError(endpoint: string, status: number, message: string, context?: LogContext) {
    this.error(`API Error: ${endpoint} returned ${status}`, {
      ...context,
      action: 'API_ERROR',
      error: {
        name: 'APIError',
        message: `${endpoint}: ${message}`
      }
    });
  }

  static businessEvent(event: string, context?: LogContext) {
    this.info(`Business Event: ${event}`, { 
      ...context, 
      action: event,
      type: 'BUSINESS' 
    });
  }
}

// Global error handler for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    ClientLogger.error('Unhandled JavaScript error', {
      error: {
        name: event.error?.name || 'Error',
        message: event.message,
        stack: event.error?.stack
      }
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    ClientLogger.error('Unhandled promise rejection', {
      error: {
        name: 'UnhandledPromiseRejection',
        message: event.reason?.message || String(event.reason)
      }
    });
  });
}

export default ClientLogger;
