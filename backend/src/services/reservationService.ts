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
    // Parse date explicitly to avoid timezone issues
    const [year, month, day] = date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day); // month is 0-based
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);
    
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

    // Calculate total capacity
    const totalCapacity = restaurant.locations.reduce((total, location) => {
      return total + location.tables.reduce((locationTotal, table) => {
        return locationTotal + (table.seats >= partySize ? 1 : 0);
      }, 0);
    }, 0);

    // Get existing reservations for the date
    const existingReservations = await db.reservation.findMany({
      where: {
        restaurantId,
        startAt: {
          gte: startDate,
          lt: endDate
        },
        status: {
          in: [ReservationStatus.BOOKED, ReservationStatus.CHECKED_IN]
        }
      }
    });

    // Generate available time slots (simplified - every 30 minutes from 5 PM to 10 PM)
    const availableSlots = [];
    const baseHour = 17; // 5 PM
    const endHour = 22; // 10 PM

    for (let hour = baseHour; hour < endHour; hour++) {
      for (let minutes of [0, 30]) {
        const slotTime = new Date(startDate);
        slotTime.setHours(hour, minutes, 0, 0);

        // Count reservations at this exact time slot
        const reservationsAtSlot = existingReservations.filter(res => 
          res.startAt.getTime() === slotTime.getTime()
        ).length;

        // Simple availability check - if we have capacity
        if (reservationsAtSlot < totalCapacity) {
          availableSlots.push({
            time: slotTime.toISOString(),
            available: true,
            capacity: totalCapacity - reservationsAtSlot
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