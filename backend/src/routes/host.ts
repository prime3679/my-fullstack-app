import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { hostService } from '../services/hostService';
import { ReservationStatus } from '../types/prisma-enums';
import { Logger } from '../lib/logger';

export async function hostRoutes(fastify: FastifyInstance) {

  // Get today's reservations for host dashboard
  fastify.get<{
    Params: { restaurantId: string };
    Querystring: {
      date?: string;
      status?: ReservationStatus;
      timeSlot?: string;
    };
  }>('/reservations/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { date, status, timeSlot } = request.query;

      const result = await hostService.getTodaysReservations({
        restaurantId,
        date,
        status,
        timeSlot
      });

      return {
        success: true,
        data: result
      };

    } catch (error) {
      Logger.error('Failed to fetch today\'s reservations', { error: error as Error });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch reservations',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Assign table to a reservation
  fastify.patch<{
    Params: { reservationId: string };
    Body: {
      tableId: string;
      actorId?: string;
    };
  }>('/reservations/:reservationId/assign-table', async (request, reply) => {
    try {
      const { reservationId } = request.params;
      const { tableId, actorId } = request.body;

      if (!tableId) {
        return reply.code(400).send({
          success: false,
          error: 'tableId is required'
        });
      }

      const reservation = await hostService.assignTable({
        reservationId,
        tableId,
        actorId
      });

      // Notify via WebSocket if available
      const wsManager = globalThis.websocketManager;
      if (wsManager && reservation.restaurantId) {
        wsManager.notifyReservationUpdate(reservation.restaurantId, {
          type: 'table_assigned',
          reservation
        });
      }

      return {
        success: true,
        data: reservation,
        message: 'Table assigned successfully'
      };

    } catch (error) {
      Logger.error('Failed to assign table', { error: error as Error });
      return reply.code(500).send({
        success: false,
        error: 'Failed to assign table',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update reservation status
  fastify.patch<{
    Params: { reservationId: string };
    Body: {
      status: ReservationStatus;
      actorId?: string;
    };
  }>('/reservations/:reservationId/status', async (request, reply) => {
    try {
      const { reservationId } = request.params;
      const { status, actorId } = request.body;

      if (!status) {
        return reply.code(400).send({
          success: false,
          error: 'status is required'
        });
      }

      // Validate status is a valid enum value
      const validStatuses = Object.values(ReservationStatus);
      if (!validStatuses.includes(status)) {
        return reply.code(400).send({
          success: false,
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const reservation = await hostService.updateReservationStatus(
        reservationId,
        status,
        actorId
      );

      // Notify via WebSocket if available
      const wsManager = globalThis.websocketManager;
      if (wsManager && reservation.restaurantId) {
        wsManager.notifyReservationUpdate(reservation.restaurantId, {
          type: 'status_updated',
          reservation
        });
      }

      return {
        success: true,
        data: reservation,
        message: `Reservation status updated to ${status}`
      };

    } catch (error) {
      Logger.error('Failed to update reservation status', { error: error as Error });
      return reply.code(500).send({
        success: false,
        error: 'Failed to update reservation status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get available tables
  fastify.get<{
    Params: { restaurantId: string };
    Querystring: {
      time?: string; // ISO 8601 datetime
    };
  }>('/tables/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { time } = request.query;

      const timeDate = time ? new Date(time) : undefined;

      const tables = await hostService.getAvailableTables(restaurantId, timeDate);

      return {
        success: true,
        data: tables
      };

    } catch (error) {
      Logger.error('Failed to fetch available tables', { error: error as Error });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch tables',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
