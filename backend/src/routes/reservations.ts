import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { ReservationService } from '../services/reservationService';

const reservationService = new ReservationService();

interface AvailabilityQuery {
  restaurantId: string;
  partySize: string;
  date: string;
}

interface CreateReservationBody {
  restaurantId: string;
  partySize: number;
  startAt: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  specialRequests?: string;
}

interface ReservationParams {
  id: string;
}

export async function reservationRoutes(fastify: FastifyInstance) {
  
  // Check availability for a restaurant
  fastify.get<{
    Querystring: AvailabilityQuery;
  }>('/availability', async (request, reply) => {
    try {
      const { restaurantId, partySize, date } = request.query;
      
      if (!restaurantId || !partySize || !date) {
        return reply.code(400).send({
          error: 'Missing required parameters: restaurantId, partySize, date'
        });
      }

      const partySizeNum = parseInt(partySize);
      if (isNaN(partySizeNum) || partySizeNum < 1 || partySizeNum > 20) {
        return reply.code(400).send({
          error: 'Party size must be between 1 and 20'
        });
      }

      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return reply.code(400).send({
          error: 'Date must be in YYYY-MM-DD format'
        });
      }

      const availability = await reservationService.checkAvailability({
        restaurantId,
        partySize: partySizeNum,
        date
      });

      return { success: true, data: availability };
    } catch (error) {
      console.error('Availability check failed:', error);
      return reply.code(500).send({
        error: 'Failed to check availability',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create a new reservation
  fastify.post<{
    Body: CreateReservationBody;
  }>('/', async (request, reply) => {
    try {
      const {
        restaurantId,
        partySize,
        startAt,
        guestName,
        guestEmail,
        guestPhone,
        specialRequests
      } = request.body;

      // Validation
      if (!restaurantId || !partySize || !startAt) {
        return reply.code(400).send({
          error: 'Missing required fields: restaurantId, partySize, startAt'
        });
      }

      if (partySize < 1 || partySize > 20) {
        return reply.code(400).send({
          error: 'Party size must be between 1 and 20'
        });
      }

      const startAtDate = new Date(startAt);
      if (isNaN(startAtDate.getTime())) {
        return reply.code(400).send({
          error: 'Invalid startAt date format'
        });
      }

      // Check if the date is in the future
      if (startAtDate < new Date()) {
        return reply.code(400).send({
          error: 'Reservation time must be in the future'
        });
      }

      // For guest reservations, require email
      if (!guestEmail) {
        return reply.code(400).send({
          error: 'Guest email is required'
        });
      }

      const reservation = await reservationService.createReservation({
        restaurantId,
        partySize,
        startAt: startAtDate,
        guestName,
        guestEmail,
        guestPhone,
        specialRequests
      });

      // Generate QR code URL (simplified for now)
      const qrUrl = `${process.env.FRONTEND_URL}/checkin/${reservation.id}`;

      return reply.code(201).send({
        success: true,
        data: {
          ...reservation,
          qrUrl,
          confirmationCode: reservation.id.slice(-8).toUpperCase()
        }
      });
    } catch (error) {
      console.error('Reservation creation failed:', error);
      return reply.code(500).send({
        error: 'Failed to create reservation',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get reservation by ID
  fastify.get<{
    Params: ReservationParams;
  }>('/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      
      const reservation = await reservationService.getReservation(id);
      
      return {
        success: true,
        data: reservation
      };
    } catch (error) {
      console.error('Failed to get reservation:', error);
      if (error instanceof Error && error.message === 'Reservation not found') {
        return reply.code(404).send({
          error: 'Reservation not found'
        });
      }
      return reply.code(500).send({
        error: 'Failed to retrieve reservation'
      });
    }
  });

  // Update reservation status (for restaurant staff)
  fastify.patch<{
    Params: ReservationParams;
    Body: { status: string; };
  }>('/:id/status', async (request, reply) => {
    try {
      const { id } = request.params;
      const { status } = request.body;

      const validStatuses = ['BOOKED', 'CHECKED_IN', 'COMPLETED', 'CANCELED', 'NO_SHOW'];
      if (!validStatuses.includes(status)) {
        return reply.code(400).send({
          error: 'Invalid status',
          validStatuses
        });
      }

      const reservation = await reservationService.updateReservationStatus(
        id, 
        status as any
      );

      return {
        success: true,
        data: reservation
      };
    } catch (error) {
      console.error('Failed to update reservation status:', error);
      return reply.code(500).send({
        error: 'Failed to update reservation status'
      });
    }
  });

  // Cancel reservation
  fastify.delete<{
    Params: ReservationParams;
  }>('/:id', async (request, reply) => {
    try {
      const { id } = request.params;
      
      const reservation = await reservationService.cancelReservation(id);
      
      return {
        success: true,
        data: reservation,
        message: 'Reservation cancelled successfully'
      };
    } catch (error) {
      console.error('Failed to cancel reservation:', error);
      return reply.code(500).send({
        error: 'Failed to cancel reservation'
      });
    }
  });

  // Get reservations for a restaurant (for staff dashboard)
  fastify.get<{
    Querystring: { 
      restaurantId: string;
      date?: string;
    };
  }>('/restaurant/list', async (request, reply) => {
    try {
      const { restaurantId, date } = request.query;
      
      if (!restaurantId) {
        return reply.code(400).send({
          error: 'restaurantId is required'
        });
      }

      const reservations = await reservationService.getReservationsByRestaurant(
        restaurantId, 
        date
      );

      return {
        success: true,
        data: {
          restaurantId,
          date: date || 'all',
          count: reservations.length,
          reservations
        }
      };
    } catch (error) {
      console.error('Failed to get restaurant reservations:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve reservations'
      });
    }
  });
}