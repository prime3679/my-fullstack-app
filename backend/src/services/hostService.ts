import { db } from '../lib/db';
import { ReservationStatus } from '@prisma/client';
import { Logger } from '../lib/logger';

export interface UpdateTableAssignmentInput {
  reservationId: string;
  tableId: string;
  actorId?: string;
}

export interface TodaysReservationsQuery {
  restaurantId: string;
  date?: string; // YYYY-MM-DD format, defaults to today
  status?: ReservationStatus;
  timeSlot?: string; // e.g., "17:00", "18:30"
}

export class HostService {

  /**
   * Get today's reservations for a restaurant with all details needed for host dashboard
   */
  async getTodaysReservations(query: TodaysReservationsQuery) {
    try {
      const { restaurantId, date, status, timeSlot } = query;

      // Parse date or use today
      let startDate: Date;
      let endDate: Date;

      if (date) {
        const [year, month, day] = date.split('-').map(Number);
        startDate = new Date(year, month - 1, day);
      } else {
        // Use today in local time
        startDate = new Date();
        startDate.setHours(0, 0, 0, 0);
      }

      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      // Build where clause
      const whereClause: any = {
        restaurantId,
        startAt: {
          gte: startDate,
          lt: endDate
        }
      };

      // Add status filter if provided
      if (status) {
        whereClause.status = status;
      }

      // Add time slot filter if provided
      if (timeSlot) {
        const [hour, minute] = timeSlot.split(':').map(Number);
        const slotStart = new Date(startDate);
        slotStart.setHours(hour, minute, 0, 0);
        const slotEnd = new Date(slotStart);
        slotEnd.setMinutes(slotEnd.getMinutes() + 30); // 30-minute slots

        whereClause.startAt = {
          gte: slotStart,
          lt: slotEnd
        };
      }

      const reservations = await db.reservation.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          table: {
            select: {
              id: true,
              number: true,
              seats: true,
              zone: true
            }
          },
          preOrder: {
            include: {
              items: {
                include: {
                  menuItem: {
                    select: {
                      name: true,
                      course: true
                    }
                  }
                }
              },
              payments: {
                select: {
                  id: true,
                  status: true,
                  totalAmount: true
                }
              }
            }
          },
          checkin: {
            select: {
              id: true,
              checkedInAt: true
            }
          },
          kitchenTicket: {
            select: {
              id: true,
              status: true
            }
          }
        },
        orderBy: {
          startAt: 'asc'
        }
      });

      // Calculate summary stats
      const summary = {
        totalReservations: reservations.length,
        totalCovers: reservations.reduce((sum, r) => sum + r.partySize, 0),
        withPreOrders: reservations.filter(r => r.preOrder).length,
        checkedIn: reservations.filter(r => r.checkin).length,
        seated: reservations.filter(r => r.status === ReservationStatus.CHECKED_IN).length,
        completed: reservations.filter(r => r.status === ReservationStatus.COMPLETED).length,
        noShows: reservations.filter(r => r.status === ReservationStatus.NO_SHOW).length
      };

      return {
        reservations,
        summary,
        date: startDate.toISOString().split('T')[0]
      };
    } catch (error) {
      Logger.error('Error fetching today\'s reservations', { query, error });
      throw error;
    }
  }

  /**
   * Assign a table to a reservation
   */
  async assignTable(input: UpdateTableAssignmentInput) {
    try {
      const { reservationId, tableId, actorId } = input;

      // Verify table exists and get restaurant info for validation
      const table = await db.table.findUnique({
        where: { id: tableId },
        include: {
          location: {
            select: {
              restaurantId: true
            }
          }
        }
      });

      if (!table) {
        throw new Error('Table not found');
      }

      // Verify reservation exists
      const reservation = await db.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          restaurantId: true,
          partySize: true
        }
      });

      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Verify table belongs to same restaurant
      if (table.location.restaurantId !== reservation.restaurantId) {
        throw new Error('Table does not belong to the reservation\'s restaurant');
      }

      // Optional: Check if table has enough seats
      if (table.seats < reservation.partySize) {
        Logger.warn('Table assigned has fewer seats than party size', {
          tableSeats: table.seats,
          partySize: reservation.partySize,
          reservationId
        });
      }

      // Update reservation with table assignment
      const updatedReservation = await db.reservation.update({
        where: { id: reservationId },
        data: {
          tableId,
          updatedAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          table: {
            select: {
              id: true,
              number: true,
              seats: true,
              zone: true
            }
          },
          preOrder: {
            include: {
              _count: {
                select: { items: true }
              }
            }
          }
        }
      });

      // Log the event
      await db.event.create({
        data: {
          kind: 'table_assigned',
          actorId,
          restaurantId: reservation.restaurantId,
          reservationId,
          payloadJson: {
            tableId,
            tableNumber: table.number
          }
        }
      });

      return updatedReservation;
    } catch (error) {
      Logger.error('Error assigning table', { input, error });
      throw error;
    }
  }

  /**
   * Update reservation status (seated, completed, no-show)
   */
  async updateReservationStatus(
    reservationId: string,
    status: ReservationStatus,
    actorId?: string
  ) {
    try {
      const reservation = await db.reservation.findUnique({
        where: { id: reservationId }
      });

      if (!reservation) {
        throw new Error('Reservation not found');
      }

      const previousStatus = reservation.status;

      // Update the reservation
      const updatedReservation = await db.reservation.update({
        where: { id: reservationId },
        data: {
          status,
          updatedAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          table: {
            select: {
              id: true,
              number: true,
              seats: true,
              zone: true
            }
          },
          preOrder: {
            include: {
              items: true
            }
          },
          checkin: true
        }
      });

      // Log the event
      await db.event.create({
        data: {
          kind: 'reservation_status_changed',
          actorId,
          restaurantId: reservation.restaurantId,
          reservationId,
          payloadJson: {
            previousStatus,
            newStatus: status
          }
        }
      });

      return updatedReservation;
    } catch (error) {
      Logger.error('Error updating reservation status', { reservationId, status, error });
      throw error;
    }
  }

  /**
   * Get available tables for a restaurant
   */
  async getAvailableTables(restaurantId: string, time?: Date) {
    try {
      // Get all tables for the restaurant
      const locations = await db.location.findMany({
        where: { restaurantId },
        include: {
          tables: {
            orderBy: {
              number: 'asc'
            }
          }
        }
      });

      const allTables = locations.flatMap(location =>
        location.tables.map(table => ({
          ...table,
          locationId: location.id,
          locationName: location.name
        }))
      );

      if (!time) {
        // If no time specified, return all tables
        return allTables.map(table => ({
          ...table,
          isAvailable: true,
          assignedReservation: null
        }));
      }

      // Check which tables are assigned at the specified time
      const timeStart = new Date(time);
      timeStart.setMinutes(timeStart.getMinutes() - 90); // 1.5 hours before
      const timeEnd = new Date(time);
      timeEnd.setMinutes(timeEnd.getMinutes() + 90); // 1.5 hours after

      const reservationsAtTime = await db.reservation.findMany({
        where: {
          restaurantId,
          startAt: {
            gte: timeStart,
            lte: timeEnd
          },
          status: {
            in: [ReservationStatus.BOOKED, ReservationStatus.CHECKED_IN]
          },
          tableId: {
            not: null
          }
        },
        include: {
          user: {
            select: {
              name: true
            }
          }
        }
      });

      // Map tables to availability
      const tablesWithAvailability = allTables.map(table => {
        const assignedReservation = reservationsAtTime.find(r => r.tableId === table.id);
        return {
          ...table,
          isAvailable: !assignedReservation,
          assignedReservation: assignedReservation ? {
            id: assignedReservation.id,
            guestName: assignedReservation.user?.name || 'Guest',
            startAt: assignedReservation.startAt,
            partySize: assignedReservation.partySize
          } : null
        };
      });

      return tablesWithAvailability;
    } catch (error) {
      Logger.error('Error fetching available tables', { restaurantId, time, error });
      throw error;
    }
  }
}

export const hostService = new HostService();
