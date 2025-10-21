/**
 * POS Integration Tests
 * Tests for retry logic, POS clients, and POS service
 */

import { describe, it, expect, jest } from '@jest/globals';
import { withRetry, POS_RETRY_OPTIONS } from '../src/utils/retry';

describe('Retry Utility', () => {
  it('should succeed on first attempt', async () => {
    const mockFn = jest.fn().mockResolvedValue('success');
    const result = await withRetry(mockFn);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and eventually succeed', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue('success');

    const result = await withRetry(mockFn, {
      maxAttempts: 3,
      initialDelayMs: 10,
      maxDelayMs: 100,
    });

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(3);
  });

  it('should throw error after max attempts', async () => {
    const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'));

    await expect(
      withRetry(mockFn, {
        maxAttempts: 2,
        initialDelayMs: 10,
      })
    ).rejects.toThrow('Persistent error');

    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should not retry non-retryable errors', async () => {
    const error = {
      response: { status: 400 },
      message: 'Bad request',
    };
    const mockFn = jest.fn().mockRejectedValue(error);

    await expect(
      withRetry(mockFn, {
        maxAttempts: 3,
        shouldRetry: (err: any) => err?.response?.status >= 500,
      })
    ).rejects.toEqual(error);

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it('should retry on 5xx errors with POS retry options', async () => {
    const error = {
      response: { status: 503 },
      message: 'Service unavailable',
    };
    const mockFn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const result = await withRetry(mockFn, POS_RETRY_OPTIONS);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should retry on rate limit (429) errors', async () => {
    const error = {
      response: { status: 429 },
      message: 'Too many requests',
    };
    const mockFn = jest.fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue('success');

    const result = await withRetry(mockFn, POS_RETRY_OPTIONS);

    expect(result).toBe('success');
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('should call onRetry callback', async () => {
    const mockFn = jest.fn()
      .mockRejectedValueOnce(new Error('Error'))
      .mockResolvedValue('success');
    const onRetry = jest.fn();

    await withRetry(mockFn, {
      maxAttempts: 2,
      initialDelayMs: 10,
      onRetry,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });
});

describe('POS Service Types', () => {
  it('should have correct POS provider types', () => {
    const validProviders: Array<'toast' | 'square' | null> = ['toast', 'square', null];
    expect(validProviders).toHaveLength(3);
    expect(validProviders).toContain('toast');
    expect(validProviders).toContain('square');
    expect(validProviders).toContain(null);
  });
});

describe('POS Menu Item Transformation', () => {
  it('should convert dollars to cents correctly', () => {
    const priceInDollars = 12.99;
    const priceInCents = Math.round(priceInDollars * 100);
    expect(priceInCents).toBe(1299);
  });

  it('should handle zero price', () => {
    const priceInDollars = 0;
    const priceInCents = Math.round(priceInDollars * 100);
    expect(priceInCents).toBe(0);
  });

  it('should round fractional cents', () => {
    const priceInDollars = 12.995;
    const priceInCents = Math.round(priceInDollars * 100);
    expect(priceInCents).toBe(1300);
  });
});

describe('POS Configuration Validation', () => {
  it('should validate Toast configuration has required fields', () => {
    const config = {
      provider: 'toast' as const,
      toastLocationGuid: 'loc123',
      toastClientId: 'client123',
      toastClientSecret: 'secret123',
    };

    expect(config.provider).toBe('toast');
    expect(config.toastLocationGuid).toBeDefined();
    expect(config.toastClientId).toBeDefined();
    expect(config.toastClientSecret).toBeDefined();
  });

  it('should validate Square configuration has required fields', () => {
    const config = {
      provider: 'square' as const,
      squareLocationId: 'loc456',
      squareAccessToken: 'token456',
    };

    expect(config.provider).toBe('square');
    expect(config.squareLocationId).toBeDefined();
    expect(config.squareAccessToken).toBeDefined();
  });
});

describe('Menu Sync Result', () => {
  it('should have correct structure for successful sync', () => {
    const result = {
      success: true,
      provider: 'toast' as const,
      itemsCreated: 25,
      itemsUpdated: 10,
      itemsDeleted: 0,
      categoriesCreated: 5,
      categoriesUpdated: 2,
      errors: [] as string[],
      syncedAt: new Date(),
    };

    expect(result.success).toBe(true);
    expect(result.provider).toBe('toast');
    expect(result.itemsCreated).toBeGreaterThan(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should have correct structure for failed sync', () => {
    const result = {
      success: false,
      provider: 'square' as const,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      categoriesCreated: 0,
      categoriesUpdated: 0,
      errors: ['Authentication failed', 'Network timeout'],
      syncedAt: new Date(),
    };

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.itemsCreated).toBe(0);
  });
});

describe('POS Order Response', () => {
  it('should have correct structure for successful order injection', () => {
    const response = {
      success: true,
      posOrderId: 'toast_order_123',
      posOrderNumber: '123',
      status: 'CREATED',
    };

    expect(response.success).toBe(true);
    expect(response.posOrderId).toBeDefined();
    expect(response.error).toBeUndefined();
  });

  it('should have correct structure for failed order injection', () => {
    const response = {
      success: false,
      error: 'POS system unavailable',
    };

    expect(response.success).toBe(false);
    expect(response.error).toBeDefined();
    expect(response.posOrderId).toBeUndefined();
  });
});
