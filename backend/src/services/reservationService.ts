import { db } from '../lib/db';
import { ReservationStatus } from '@prisma/client';

export interface CreateReservationInput {
  restaurantId: string;
  userId?: string;
  partySize: number;
  startAt: Date;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  specialRequests?: string;
}

export interface AvailabilityQuery {
  restaurantId: string;
  partySize: number;
  date: string; // YYYY-MM-DD format
}

export class ReservationService {
  
  async checkAvailability({ restaurantId, partySize, date }: AvailabilityQuery) {
    // Get restaurant's capacity rules and operating hours
    const restaurant = await db.restaurant.findUnique({
      where: { id: restaurantId },
      include: {
        locations: {
          include: {
            tables: true
          }
        }
      }
    });

    if (!restaurant) {
      throw new Error('Restaurant not found');
    }

    // Use restaurant's timezone, fallback to UTC
    const timezone = restaurant.timezone || 'UTC';
    
    // Parse date in restaurant's timezone
    const [year, month, day] = date.split('-').map(Number);
    
    // Create date range for the specific day in the restaurant's timezone
    const startOfDay = new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T00:00:00.000Z`);
    const endOfDay = new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T23:59:59.999Z`);

    // Calculate total capacity (count tables that can accommodate the party size)
    const totalCapacity = restaurant.locations.reduce((total, location) => {
      return total + location.tables.reduce((locationTotal, table) => {
        return locationTotal + (table.seats >= partySize ? 1 : 0);
      }, 0);
    }, 0);

    if (totalCapacity === 0) {
      return {
        date,
        partySize,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug
        },
        availableSlots: []
      };
    }

    // Get existing reservations for the date
    const existingReservations = await db.reservation.findMany({
      where: {
        restaurantId,
        startAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: {
          in: [ReservationStatus.BOOKED, ReservationStatus.CHECKED_IN]
        }
      }
    });

    // Generate available time slots - every 30 minutes from 5 PM to 10 PM
    const availableSlots = [];
    const baseHour = 17; // 5 PM
    const endHour = 22; // 10 PM

    for (let hour = baseHour; hour < endHour; hour++) {
      for (let minutes of [0, 30]) {
        // Create slot time in UTC for consistency
        const slotTime = new Date(`${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00.000Z`);

        // Count reservations within 30 minutes of this slot (to account for overlapping reservations)
        const slotStart = new Date(slotTime.getTime());
        const slotEnd = new Date(slotTime.getTime() + 30 * 60 * 1000); // 30 minutes later

        const conflictingReservations = existingReservations.filter(res => {
          const reservationStart = res.startAt;
          const reservationEnd = new Date(reservationStart.getTime() + 90 * 60 * 1000); // Assume 90 min dining time
          
          // Check if reservations overlap with this time slot
          return (reservationStart < slotEnd && reservationEnd > slotStart);
        }).length;

        // Check if we have available capacity for this slot
        if (conflictingReservations < totalCapacity) {
          availableSlots.push({
            time: slotTime.toISOString(),
            available: true,
            capacity: totalCapacity - conflictingReservations
          });
        }
      }
    }

    return {
      date,
      partySize,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug
      },
      availableSlots
    };
  }

  async createReservation(input: CreateReservationInput) {
    // If no userId provided, create or find guest user
    let userId = input.userId;
    
    if (!userId && input.guestEmail) {
      // Find or create guest user
      let user = await db.user.findUnique({
        where: { email: input.guestEmail }
      });

      if (!user) {
        user = await db.user.create({
          data: {
            email: input.guestEmail,
            name: input.guestName || '',
            phone: input.guestPhone,
            role: 'DINER'
          }
        });
      }
      
      userId = user.id;
    }

    // Check if the slot is still available
    const availability = await this.checkAvailability({
      restaurantId: input.restaurantId,
      partySize: input.partySize,
      date: input.startAt.toISOString().split('T')[0]
    });

    // More lenient time comparison - check if times are within same minute
    const requestedSlot = availability.availableSlots.find(slot => {
      const slotTime = new Date(slot.time);
      const requestedTime = input.startAt;
      
      // Compare year, month, day, hour, and minute
      return slotTime.getFullYear() === requestedTime.getFullYear() &&
             slotTime.getMonth() === requestedTime.getMonth() &&
             slotTime.getDate() === requestedTime.getDate() &&
             slotTime.getHours() === requestedTime.getHours() &&
             slotTime.getMinutes() === requestedTime.getMinutes();
    });

    if (!requestedSlot || !requestedSlot.available) {
      throw new Error('Requested time slot is no longer available');
    }

    // Create the reservation
    const reservation = await db.reservation.create({
      data: {
        restaurantId: input.restaurantId,
        userId,
        partySize: input.partySize,
        startAt: input.startAt,
        status: ReservationStatus.BOOKED,
        source: 'lacarta'
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
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true
          }
        }
      }
    });

    // Log the event
    await db.event.create({
      data: {
        kind: 'reservation_created',
        actorId: userId,
        restaurantId: input.restaurantId,
        reservationId: reservation.id,
        payloadJson: {
          partySize: input.partySize,
          startAt: input.startAt,
          source: 'lacarta'
        }
      }
    });

    return reservation;
  }

  async getReservation(id: string) {
    const reservation = await db.reservation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true
          }
        },
        preOrder: {
          include: {
            items: true,
            payments: true
          }
        },
        checkin: true,
        kitchenTicket: true
      }
    });

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    return reservation;
  }

  async updateReservationStatus(id: string, status: ReservationStatus, actorId?: string) {
    const reservation = await db.reservation.update({
      where: { id },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        restaurant: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log the status change
    await db.event.create({
      data: {
        kind: 'reservation_status_changed',
        actorId,
        restaurantId: reservation.restaurantId,
        reservationId: reservation.id,
        payloadJson: {
          newStatus: status,
          previousStatus: status // TODO: Store previous status
        }
      }
    });

    return reservation;
  }

  async cancelReservation(id: string, actorId?: string) {
    return this.updateReservationStatus(id, ReservationStatus.CANCELED, actorId);
  }

  async getReservationsByRestaurant(restaurantId: string, date?: string) {
    const whereClause: any = { restaurantId };

    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);

      whereClause.startAt = {
        gte: startDate,
        lt: endDate
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
        preOrder: {
          include: {
            _count: {
              select: { items: true }
            }
          }
        },
        checkin: true
      },
      orderBy: {
        startAt: 'asc'
      }
    });

    return reservations;
  }
}