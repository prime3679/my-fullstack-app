/**
 * Retry utility with exponential backoff for handling transient failures
 * Used primarily for external API calls (POS systems, payment processors, etc.)
 */

import { Logger } from '../lib/logger';
import { formatError } from './errorFormat';

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    // Retry on network errors and 5xx server errors
    if (error?.code === 'ECONNREFUSED' || error?.code === 'ETIMEDOUT') {
      return true;
    }
    if (error?.response?.status >= 500 && error?.response?.status < 600) {
      return true;
    }
    // Retry on rate limit (429)
    if (error?.response?.status === 429) {
      return true;
    }
    return false;
  },
  onRetry: () => {},
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  multiplier: number
): number {
  const exponentialDelay = initialDelay * Math.pow(multiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  // Add jitter (random 0-25% of delay) to prevent thundering herd
  const jitter = cappedDelay * 0.25 * Math.random();
  return Math.floor(cappedDelay + jitter);
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration options
 * @returns Promise resolving to function result
 * @throws Last error if all retries exhausted
 *
 * @example
 * const result = await withRetry(
 *   () => posApi.createOrder(orderData),
 *   { maxAttempts: 4, initialDelayMs: 2000 }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      const result = await fn();

      // Log successful retry
      if (attempt > 1) {
        Logger.info('Operation succeeded after retry', {
          attempt,
          totalAttempts: opts.maxAttempts,
        });
      }

      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      const shouldRetry = opts.shouldRetry(error);
      const isLastAttempt = attempt === opts.maxAttempts;

      if (!shouldRetry || isLastAttempt) {
        // Don't retry - either error is not retryable or we're out of attempts
        Logger.error('Operation failed', {
          attempt,
          totalAttempts: opts.maxAttempts,
          shouldRetry,
          error: formatError(error),
        });
        throw error;
      }

      // Calculate delay and wait before retry
      const delay = calculateDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier
      );

      Logger.warn('Operation failed, retrying', {
        attempt,
        totalAttempts: opts.maxAttempts,
        delayMs: delay,
        error: formatError(error),
      });

      // Call onRetry callback if provided
      opts.onRetry(attempt, error);

      // Wait before next attempt
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Retry configuration optimized for POS API calls
 */
export const POS_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 4,
  initialDelayMs: 2000,
  maxDelayMs: 16000,
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    // Network errors
    if (error?.code === 'ECONNREFUSED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.code === 'ENOTFOUND') {
      return true;
    }

    // HTTP 5xx errors (server errors)
    if (error?.response?.status >= 500 && error?.response?.status < 600) {
      return true;
    }

    // HTTP 429 (rate limit)
    if (error?.response?.status === 429) {
      return true;
    }

    // HTTP 408 (request timeout)
    if (error?.response?.status === 408) {
      return true;
    }

    // HTTP 503 (service unavailable) - common in POS systems during maintenance
    if (error?.response?.status === 503) {
      return true;
    }

    return false;
  },
};

/**
 * Retry configuration for critical operations (more aggressive)
 */
export const CRITICAL_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 5,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2.5,
  shouldRetry: POS_RETRY_OPTIONS.shouldRetry,
};
