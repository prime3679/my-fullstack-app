/**
 * POS Integration API Routes
 * Handles menu sync, order injection, and POS configuration
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { posService } from '../services/posService';
import { Logger } from '../lib/logger';
import { formatError } from '../utils/errorFormat';
import { POSConfiguration, POSProvider } from '../types/pos';

interface SyncMenuRequest {
  Params: {
    restaurantId: string;
  };
}

interface UpdateConfigRequest {
  Params: {
    restaurantId: string;
  };
  Body: Partial<POSConfiguration>;
}

interface InjectOrderRequest {
  Body: {
    preOrderId: string;
  };
}

interface WebhookRequest {
  Params: {
    provider: string;
  };
  Body: any;
}

export async function posRoutes(fastify: FastifyInstance) {
  /**
   * GET /pos/config/:restaurantId
   * Get POS configuration for a restaurant
   */
  fastify.get<{
    Params: { restaurantId: string };
  }>('/config/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;

      const config = await posService.getPOSConfig(restaurantId);

      if (!config) {
        return reply.code(404).send({
          success: false,
          error: 'No POS configuration found for restaurant',
        });
      }

      // Sanitize sensitive data before returning
      const sanitizedConfig = {
        ...config,
        toastClientSecret: config.toastClientSecret ? '***REDACTED***' : undefined,
        toastAccessToken: config.toastAccessToken ? '***REDACTED***' : undefined,
        toastRefreshToken: config.toastRefreshToken ? '***REDACTED***' : undefined,
        squareAccessToken: config.squareAccessToken ? '***REDACTED***' : undefined,
        squareRefreshToken: config.squareRefreshToken ? '***REDACTED***' : undefined,
      };

      return {
        success: true,
        data: sanitizedConfig,
      };
    } catch (error) {
      Logger.error('Failed to get POS configuration', {
        restaurantId: request.params.restaurantId,
        error: formatError(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Failed to get POS configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * PUT /pos/config/:restaurantId
   * Update POS configuration for a restaurant
   */
  fastify.put<UpdateConfigRequest>('/config/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const config = request.body;

      // Validate provider if provided
      if (config.provider && !['toast', 'square', null].includes(config.provider)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid POS provider. Must be "toast", "square", or null',
        });
      }

      // Validate Toast configuration
      if (config.provider === 'toast') {
        if (!config.toastLocationGuid || !config.toastClientId || !config.toastClientSecret) {
          return reply.code(400).send({
            success: false,
            error: 'Toast configuration requires locationGuid, clientId, and clientSecret',
          });
        }
      }

      // Validate Square configuration
      if (config.provider === 'square') {
        if (!config.squareLocationId || !config.squareAccessToken) {
          return reply.code(400).send({
            success: false,
            error: 'Square configuration requires locationId and accessToken',
          });
        }
      }

      await posService.updatePOSConfig(restaurantId, config);

      Logger.info('POS configuration updated', {
        restaurantId,
        provider: config.provider,
      });

      return {
        success: true,
        message: 'POS configuration updated successfully',
      };
    } catch (error) {
      Logger.error('Failed to update POS configuration', {
        restaurantId: request.params.restaurantId,
        error: formatError(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Failed to update POS configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /pos/sync-menu/:restaurantId
   * Manually trigger menu sync from POS to La Carta
   */
  fastify.post<SyncMenuRequest>('/sync-menu/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;

      Logger.info('Manual menu sync triggered', { restaurantId });

      const result = await posService.syncMenu(restaurantId);

      if (!result.success) {
        return reply.code(500).send({
          success: false,
          error: 'Menu sync failed',
          details: result,
        });
      }

      return {
        success: true,
        data: result,
        message: `Menu synced successfully. Created: ${result.itemsCreated}, Updated: ${result.itemsUpdated}`,
      };
    } catch (error) {
      Logger.error('Menu sync failed', {
        restaurantId: request.params.restaurantId,
        error: formatError(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Menu sync failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /pos/inject-order
   * Manually inject order to POS (for retries or manual operations)
   */
  fastify.post<InjectOrderRequest>('/inject-order', async (request, reply) => {
    try {
      const { preOrderId } = request.body;

      if (!preOrderId) {
        return reply.code(400).send({
          success: false,
          error: 'preOrderId is required',
        });
      }

      Logger.info('Manual order injection triggered', { preOrderId });

      const result = await posService.injectOrder(preOrderId);

      if (!result.success) {
        return reply.code(500).send({
          success: false,
          error: 'Order injection failed',
          message: result.error,
        });
      }

      return {
        success: true,
        data: result,
        message: 'Order injected to POS successfully',
      };
    } catch (error) {
      Logger.error('Order injection failed', {
        preOrderId: request.body.preOrderId,
        error: formatError(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Order injection failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * POST /pos/webhook/:provider
   * Handle webhooks from POS systems (Toast, Square)
   */
  fastify.post<WebhookRequest>('/webhook/:provider', async (request, reply) => {
    try {
      const { provider } = request.params;
      const payload = request.body as any;

      Logger.info('Received POS webhook', {
        provider,
        eventType: (payload as any).eventType || (payload as any).type || 'unknown',
      });

      // Validate provider
      if (!['toast', 'square'].includes(provider)) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid POS provider',
        });
      }

      // Handle webhook based on provider
      if (provider === 'toast') {
        await handleToastWebhook(payload);
      } else if (provider === 'square') {
        await handleSquareWebhook(payload);
      }

      return {
        success: true,
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      Logger.error('Webhook processing failed', {
        provider: request.params.provider,
        error: formatError(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}

/**
 * Handle Toast webhook events
 */
async function handleToastWebhook(payload: any): Promise<void> {
  Logger.info('Processing Toast webhook', {
    eventType: payload.eventType,
    orderGuid: payload.orderGuid,
  });

  // Handle different Toast event types
  switch (payload.eventType) {
    case 'ORDER_UPDATED':
      // Handle order status updates
      Logger.info('Toast order updated', {
        orderGuid: payload.orderGuid,
        status: payload.status,
      });
      break;

    case 'ORDER_COMPLETED':
      // Handle order completion
      Logger.info('Toast order completed', {
        orderGuid: payload.orderGuid,
      });
      break;

    case 'MENU_UPDATED':
      // Handle menu updates (could trigger auto-sync)
      Logger.info('Toast menu updated', {
        restaurantGuid: payload.restaurantGuid,
      });
      break;

    default:
      Logger.warn('Unhandled Toast webhook event type', {
        eventType: payload.eventType,
      });
  }
}

/**
 * Handle Square webhook events
 */
async function handleSquareWebhook(payload: any): Promise<void> {
  Logger.info('Processing Square webhook', {
    eventType: payload.type,
    eventId: payload.event_id,
  });

  // Handle different Square event types
  switch (payload.type) {
    case 'order.updated':
      // Handle order status updates
      Logger.info('Square order updated', {
        orderId: payload.data?.object?.order?.id,
        state: payload.data?.object?.order?.state,
      });
      break;

    case 'order.fulfilled':
      // Handle order fulfillment
      Logger.info('Square order fulfilled', {
        orderId: payload.data?.object?.order?.id,
      });
      break;

    case 'catalog.version.updated':
      // Handle catalog (menu) updates
      Logger.info('Square catalog updated', {
        catalogVersion: payload.data?.object?.updated_at,
      });
      break;

    default:
      Logger.warn('Unhandled Square webhook event type', {
        eventType: payload.type,
      });
  }
}
