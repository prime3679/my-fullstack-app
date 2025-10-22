import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../lib/db';
import { posService } from '../services/posService';
import { Logger, toLogError } from '../lib/logger';
import { formatError } from '../utils/errorFormat';

export async function kitchenRoutes(fastify: FastifyInstance) {
  
  // Get all kitchen tickets for a restaurant
  fastify.get<{
    Querystring: { restaurantId: string; status?: string };
  }>('/tickets', async (request, reply) => {
    try {
      const { restaurantId, status } = request.query;

      if (!restaurantId) {
        return reply.code(400).send({
          error: 'restaurantId is required'
        });
      }

      const tickets = await db.kitchenTicket.findMany({
        where: {
          reservation: {
            restaurantId: restaurantId
          },
          ...(status ? { status: status as any } : {})
        },
        include: {
          reservation: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true
                }
              },
              preOrder: {
                include: {
                  items: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });

      return {
        success: true,
        data: tickets
      };

    } catch (error) {
      console.error('Get kitchen tickets failed:', error);
      return reply.code(500).send({
        error: 'Failed to get kitchen tickets',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update kitchen ticket status
  fastify.patch<{
    Params: { ticketId: string };
    Body: { status: string; estimatedPrepMinutes?: number };
  }>('/tickets/:ticketId', async (request, reply) => {
    try {
      const { ticketId } = request.params;
      const { status, estimatedPrepMinutes } = request.body;

      if (!['PENDING', 'HOLD', 'FIRED', 'READY', 'SERVED'].includes(status)) {
        return reply.code(400).send({
          error: 'Invalid status. Must be one of: PENDING, HOLD, FIRED, READY, SERVED'
        });
      }

      const updateData: any = { status };
      
      // Set timestamps based on status
      if (status === 'FIRED') {
        updateData.firedAt = new Date();
        if (estimatedPrepMinutes) {
          updateData.estimatedPrepMinutes = estimatedPrepMinutes;
        }
      } else if (status === 'READY') {
        updateData.readyAt = new Date();
      } else if (status === 'SERVED') {
        updateData.servedAt = new Date();
      }

      const ticket = await db.kitchenTicket.update({
        where: { id: ticketId },
        data: updateData,
        include: {
          reservation: {
            include: {
              user: {
                select: {
                  name: true,
                  email: true
                }
              },
              preOrder: {
                include: {
                  items: true
                }
              }
            }
          }
        }
      });

      // Inject order to POS when ticket is fired
      if (status === 'FIRED' && ticket.reservation.preOrder) {
        try {
          Logger.info('Injecting order to POS on ticket fire', {
            ticketId,
            preOrderId: ticket.reservation.preOrder.id,
            restaurantId: ticket.reservation.restaurantId,
          });

          const posResponse = await posService.injectOrder(ticket.reservation.preOrder.id);

          if (posResponse.success) {
            Logger.info('Order successfully injected to POS', {
              ticketId,
              preOrderId: ticket.reservation.preOrder.id,
              posOrderId: posResponse.posOrderId,
            });
          } else {
            Logger.error('Failed to inject order to POS', {
              ticketId,
              preOrderId: ticket.reservation.preOrder.id,
              error: { name: 'POSError', message: posResponse.error || 'Unknown error' },
            });
            // Don't fail the ticket update - POS injection can be retried
          }
        } catch (error) {
          Logger.error('Error during POS order injection', {
            ticketId,
            error: formatError(error),
          });
          // Don't fail the ticket update - continue with ticket status change
        }
      }

      // Emit real-time update
      const wsManager = (global as any).websocketManager;
      if (wsManager) {
        wsManager.notifyTicketUpdate(ticket.reservation.restaurantId, ticket);
        
        // Special notifications for certain status changes
        if (status === 'READY') {
          wsManager.notifyTicketReady(ticket.reservation.restaurantId, ticket);
        }
      }

      return {
        success: true,
        data: ticket
      };

    } catch (error) {
      console.error('Update kitchen ticket failed:', error);
      return reply.code(500).send({
        error: 'Failed to update kitchen ticket',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get kitchen dashboard stats for a restaurant
  fastify.get<{
    Querystring: { restaurantId: string };
  }>('/dashboard', async (request, reply) => {
    try {
      const { restaurantId } = request.query;

      if (!restaurantId) {
        return reply.code(400).send({
          error: 'restaurantId is required'
        });
      }

      // Get today's date range
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

      // Get ticket counts by status using individual counts
      const pendingCount = await db.kitchenTicket.count({
        where: {
          reservation: { restaurantId },
          status: 'PENDING',
          createdAt: { gte: startOfDay, lt: endOfDay }
        }
      });

      const holdCount = await db.kitchenTicket.count({
        where: {
          reservation: { restaurantId },
          status: 'HOLD', 
          createdAt: { gte: startOfDay, lt: endOfDay }
        }
      });

      const firedCount = await db.kitchenTicket.count({
        where: {
          reservation: { restaurantId },
          status: 'FIRED',
          createdAt: { gte: startOfDay, lt: endOfDay }
        }
      });

      const readyCount = await db.kitchenTicket.count({
        where: {
          reservation: { restaurantId },
          status: 'READY',
          createdAt: { gte: startOfDay, lt: endOfDay }
        }
      });

      const servedCount = await db.kitchenTicket.count({
        where: {
          reservation: { restaurantId },
          status: 'SERVED',
          createdAt: { gte: startOfDay, lt: endOfDay }
        }
      });

      const ticketCounts = {
        PENDING: pendingCount,
        HOLD: holdCount,
        FIRED: firedCount,
        READY: readyCount,
        SERVED: servedCount
      };

      // Get average prep times for completed tickets
      const completedTickets = await db.kitchenTicket.findMany({
        where: {
          reservation: {
            restaurantId: restaurantId
          },
          status: 'SERVED',
          firedAt: { not: null },
          readyAt: { not: null },
          createdAt: {
            gte: startOfDay,
            lt: endOfDay
          }
        },
        select: {
          firedAt: true,
          readyAt: true,
          estimatedPrepMinutes: true
        }
      });

      // Calculate actual average prep time from completed tickets
      const avgPrepTime = completedTickets.length > 0
        ? completedTickets.reduce((sum: number, ticket: any) => {
            if (ticket.firedAt && ticket.readyAt) {
              const actualMinutes = Math.round((ticket.readyAt.getTime() - ticket.firedAt.getTime()) / (1000 * 60));
              return sum + actualMinutes;
            }
            return sum + ticket.estimatedPrepMinutes;
          }, 0) / completedTickets.length
        : 0;

      // Get current active tickets
      const activeTickets = await db.kitchenTicket.count({
        where: {
          reservation: {
            restaurantId: restaurantId
          },
          status: {
            in: ['FIRED', 'READY']
          }
        }
      });

      const stats = {
        ticketCounts,
        averagePrepTime: Math.round(avgPrepTime),
        activeTickets
      };

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      console.error('Get kitchen dashboard failed:', error);
      return reply.code(500).send({
        error: 'Failed to get kitchen dashboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}