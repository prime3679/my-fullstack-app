/**
 * Analytics API Routes
 * Endpoints for restaurant business intelligence and metrics
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { analyticsService } from '../services/analyticsService';
import { Logger } from '../lib/logger';

interface AnalyticsQueryParams {
  restaurantId: string;
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
  limit?: string;
}

export async function analyticsRoutes(fastify: FastifyInstance) {
  /**
   * GET /analytics/dashboard/:restaurantId
   * Get dashboard summary with key metrics
   */
  fastify.get<{
    Params: { restaurantId: string };
  }>('/dashboard/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;

      Logger.info('Fetching dashboard summary', { restaurantId });

      const summary = await analyticsService.getDashboardSummary(restaurantId);

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      Logger.error('Failed to fetch dashboard summary', {
        restaurantId: request.params.restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch dashboard summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /analytics/revenue/:restaurantId
   * Get revenue data over a date range
   */
  fastify.get<{
    Params: { restaurantId: string };
    Querystring: AnalyticsQueryParams;
  }>('/revenue/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { startDate, endDate, groupBy = 'day' } = request.query;

      // Default to last 30 days if not specified
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (!['day', 'week', 'month'].includes(groupBy)) {
        return reply.code(400).send({
          success: false,
          error: 'groupBy must be one of: day, week, month',
        });
      }

      Logger.info('Fetching revenue data', {
        restaurantId,
        startDate: start,
        endDate: end,
        groupBy,
      });

      const revenueData = await analyticsService.getRevenueByDate(
        restaurantId,
        start,
        end,
        groupBy as 'day' | 'week' | 'month'
      );

      return {
        success: true,
        data: {
          revenue: revenueData,
          dateRange: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
        },
      };
    } catch (error) {
      Logger.error('Failed to fetch revenue data', {
        restaurantId: request.params.restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch revenue data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /analytics/popular-items/:restaurantId
   * Get popular menu items
   */
  fastify.get<{
    Params: { restaurantId: string };
    Querystring: AnalyticsQueryParams;
  }>('/popular-items/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { startDate, endDate, limit = '10' } = request.query;

      // Default to last 30 days
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const limitNum = parseInt(limit, 10);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return reply.code(400).send({
          success: false,
          error: 'limit must be between 1 and 100',
        });
      }

      const popularItems = await analyticsService.getPopularItems(
        restaurantId,
        start,
        end,
        limitNum
      );

      return {
        success: true,
        data: {
          items: popularItems,
          dateRange: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
        },
      };
    } catch (error) {
      Logger.error('Failed to fetch popular items', {
        restaurantId: request.params.restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch popular items',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /analytics/customers/:restaurantId
   * Get customer metrics
   */
  fastify.get<{
    Params: { restaurantId: string };
    Querystring: AnalyticsQueryParams;
  }>('/customers/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { startDate, endDate } = request.query;

      // Default to last 30 days
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const customerMetrics = await analyticsService.getCustomerMetrics(
        restaurantId,
        start,
        end
      );

      return {
        success: true,
        data: {
          metrics: customerMetrics,
          dateRange: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
        },
      };
    } catch (error) {
      Logger.error('Failed to fetch customer metrics', {
        restaurantId: request.params.restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch customer metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /analytics/orders/:restaurantId
   * Get order metrics
   */
  fastify.get<{
    Params: { restaurantId: string };
    Querystring: AnalyticsQueryParams;
  }>('/orders/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { startDate, endDate } = request.query;

      // Default to last 30 days
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const orderMetrics = await analyticsService.getOrderMetrics(
        restaurantId,
        start,
        end
      );

      return {
        success: true,
        data: {
          metrics: orderMetrics,
          dateRange: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
        },
      };
    } catch (error) {
      Logger.error('Failed to fetch order metrics', {
        restaurantId: request.params.restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch order metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * GET /analytics/peak-times/:restaurantId
   * Get peak times for reservations
   */
  fastify.get<{
    Params: { restaurantId: string };
    Querystring: AnalyticsQueryParams;
  }>('/peak-times/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { startDate, endDate, groupBy = 'hour' } = request.query;

      // Default to last 30 days
      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      if (!['hour', 'dayOfWeek'].includes(groupBy || '')) {
        return reply.code(400).send({
          success: false,
          error: 'groupBy must be one of: hour, dayOfWeek',
        });
      }

      const peakTimes = await analyticsService.getPeakTimes(
        restaurantId,
        start,
        end,
        groupBy as 'hour' | 'dayOfWeek'
      );

      return {
        success: true,
        data: {
          peakTimes,
          groupBy,
          dateRange: {
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          },
        },
      };
    } catch (error) {
      Logger.error('Failed to fetch peak times', {
        restaurantId: request.params.restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });

      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch peak times',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
