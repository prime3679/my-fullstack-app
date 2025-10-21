/**
 * Kitchen Service
 * Handles kitchen ticket workflow and real-time order management
 */

import { Logger } from '../lib/logger';
import { db } from '../lib/db';
import { KitchenTicketStatus } from '@prisma/client';

interface KitchenTicket {
  id: string;
  reservationId: string;
  status: KitchenTicketStatus;
  targetFireTime: Date | null;
  firedAt: Date | null;
  readyAt: Date | null;
  servedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reservation: {
    id: string;
    startAt: Date;
    partySize: number;
    user: {
      name: string;
    } | null;
    table: {
      number: string;
    } | null;
  };
  preOrder: {
    id: string;
    items: Array<{
      id: string;
      quantity: number;
      menuItem: {
        name: string;
        course: string | null;
        prepTimeMinutes: number | null;
      };
      modifiers: string[];
      specialInstructions: string | null;
    }>;
  } | null;
}

interface TicketWithPacing extends KitchenTicket {
  minutesUntilFire: number | null;
  minutesSinceFired: number | null;
  pacingStatus: 'on_time' | 'warning' | 'late' | 'ready';
  estimatedReadyTime: Date | null;
}

export class KitchenService {
  /**
   * Get all active kitchen tickets for a restaurant
   */
  async getActiveTickets(restaurantId: string): Promise<TicketWithPacing[]> {
    try {
      const tickets = await db.kitchenTicket.findMany({
        where: {
          reservation: {
            restaurantId,
          },
          status: {
            in: ['PENDING', 'HOLD', 'FIRED', 'READY'],
          },
        },
        include: {
          reservation: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
              table: {
                select: {
                  number: true,
                },
              },
              preOrder: {
                include: {
                  items: {
                    include: {
                      menuItem: {
                        select: {
                          name: true,
                          course: true,
                          prepTimeMinutes: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          targetFireTime: 'asc',
        },
      });

      const ticketsWithPacing: TicketWithPacing[] = tickets.map((ticket) => {
        const pacing = this.calculatePacing(ticket);
        return {
          ...ticket,
          preOrder: ticket.reservation.preOrder,
          ...pacing,
        };
      });

      Logger.info('Fetched active kitchen tickets', {
        restaurantId,
        ticketCount: ticketsWithPacing.length,
      });

      return ticketsWithPacing;
    } catch (error) {
      Logger.error('Failed to fetch active kitchen tickets', {
        restaurantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update kitchen ticket status
   */
  async updateTicketStatus(
    ticketId: string,
    status: KitchenTicketStatus
  ): Promise<KitchenTicket> {
    try {
      const updateData: any = { status };

      // Set timestamps based on status
      if (status === 'FIRED' && !updateData.firedAt) {
        updateData.firedAt = new Date();
      } else if (status === 'READY' && !updateData.readyAt) {
        updateData.readyAt = new Date();
      } else if (status === 'SERVED' && !updateData.servedAt) {
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
                },
              },
              table: {
                select: {
                  number: true,
                },
              },
              preOrder: {
                include: {
                  items: {
                    include: {
                      menuItem: {
                        select: {
                          name: true,
                          course: true,
                          prepTimeMinutes: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      Logger.info('Updated kitchen ticket status', {
        ticketId,
        status,
      });

      return {
        ...ticket,
        preOrder: ticket.reservation.preOrder,
      };
    } catch (error) {
      Logger.error('Failed to update kitchen ticket status', {
        ticketId,
        status,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Fire a ticket (start cooking)
   */
  async fireTicket(ticketId: string): Promise<KitchenTicket> {
    return this.updateTicketStatus(ticketId, 'FIRED');
  }

  /**
   * Mark ticket as ready
   */
  async markReady(ticketId: string): Promise<KitchenTicket> {
    return this.updateTicketStatus(ticketId, 'READY');
  }

  /**
   * Mark ticket as served
   */
  async markServed(ticketId: string): Promise<KitchenTicket> {
    return this.updateTicketStatus(ticketId, 'SERVED');
  }

  /**
   * Hold a ticket (delay firing)
   */
  async holdTicket(ticketId: string): Promise<KitchenTicket> {
    return this.updateTicketStatus(ticketId, 'HOLD');
  }

  /**
   * Calculate pacing information for a ticket
   */
  private calculatePacing(ticket: any): {
    minutesUntilFire: number | null;
    minutesSinceFired: number | null;
    pacingStatus: 'on_time' | 'warning' | 'late' | 'ready';
    estimatedReadyTime: Date | null;
  } {
    const now = new Date();

    // If already ready or served
    if (ticket.status === 'READY' || ticket.status === 'SERVED') {
      return {
        minutesUntilFire: null,
        minutesSinceFired: null,
        pacingStatus: 'ready',
        estimatedReadyTime: ticket.readyAt,
      };
    }

    // Calculate minutes until target fire time
    let minutesUntilFire: number | null = null;
    if (ticket.targetFireTime) {
      minutesUntilFire = Math.round(
        (ticket.targetFireTime.getTime() - now.getTime()) / (1000 * 60)
      );
    }

    // Calculate minutes since fired
    let minutesSinceFired: number | null = null;
    if (ticket.firedAt) {
      minutesSinceFired = Math.round(
        (now.getTime() - ticket.firedAt.getTime()) / (1000 * 60)
      );
    }

    // Calculate estimated prep time
    let prepTimeMinutes = 15; // Default
    if (ticket.reservation?.preOrder?.items) {
      const maxPrepTime = Math.max(
        ...ticket.reservation.preOrder.items.map(
          (item: any) => item.menuItem.prepTimeMinutes || 15
        )
      );
      prepTimeMinutes = maxPrepTime;
    }

    // Determine pacing status
    let pacingStatus: 'on_time' | 'warning' | 'late' | 'ready' = 'on_time';

    if (ticket.status === 'FIRED') {
      // Check if cooking is taking too long
      if (minutesSinceFired !== null) {
        if (minutesSinceFired > prepTimeMinutes + 5) {
          pacingStatus = 'late';
        } else if (minutesSinceFired > prepTimeMinutes) {
          pacingStatus = 'warning';
        }
      }
    } else if (ticket.status === 'PENDING' || ticket.status === 'HOLD') {
      // Check if we're approaching fire time
      if (minutesUntilFire !== null) {
        if (minutesUntilFire < 0) {
          pacingStatus = 'late';
        } else if (minutesUntilFire <= 2) {
          pacingStatus = 'warning';
        }
      }
    }

    // Calculate estimated ready time
    let estimatedReadyTime: Date | null = null;
    if (ticket.firedAt) {
      estimatedReadyTime = new Date(
        ticket.firedAt.getTime() + prepTimeMinutes * 60 * 1000
      );
    }

    return {
      minutesUntilFire,
      minutesSinceFired,
      pacingStatus,
      estimatedReadyTime,
    };
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string): Promise<TicketWithPacing | null> {
    try {
      const ticket = await db.kitchenTicket.findUnique({
        where: { id: ticketId },
        include: {
          reservation: {
            include: {
              user: {
                select: {
                  name: true,
                },
              },
              table: {
                select: {
                  number: true,
                },
              },
              preOrder: {
                include: {
                  items: {
                    include: {
                      menuItem: {
                        select: {
                          name: true,
                          course: true,
                          prepTimeMinutes: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!ticket) return null;

      const pacing = this.calculatePacing(ticket);
      return {
        ...ticket,
        preOrder: ticket.reservation.preOrder,
        ...pacing,
      };
    } catch (error) {
      Logger.error('Failed to fetch kitchen ticket', {
        ticketId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Export singleton instance
export const kitchenService = new KitchenService();
