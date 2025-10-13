import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../lib/db';

export async function checkinRoutes(fastify: FastifyInstance) {
  
  // Check-in via QR code scan
  fastify.post<{
    Body: { 
      reservationId: string; 
      method: 'QR_SCAN' | 'MANUAL' | 'INTEGRATION';
      locationId: string;
      tableId?: string;
    };
  }>('/scan', async (request, reply) => {
    try {
      const { reservationId, method, locationId, tableId } = request.body;

      // Validate reservation exists and is in correct status
      const reservation = await db.reservation.findUnique({
        where: { id: reservationId },
        include: {
          checkin: true,
          kitchenTicket: true,
          preOrder: {
            include: {
              items: true
            }
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      if (!reservation) {
        return reply.code(404).send({
          error: 'Reservation not found'
        });
      }

      if (reservation.status !== 'BOOKED') {
        return reply.code(400).send({
          error: 'Reservation must be BOOKED status to check in',
          currentStatus: reservation.status
        });
      }

      // Check if already checked in
      if (reservation.checkin) {
        return reply.code(400).send({
          error: 'Reservation already checked in',
          checkinTime: reservation.checkin.scannedAt
        });
      }

      // Create check-in record
      const checkin = await db.checkIn.create({
        data: {
          reservationId,
          method,
          locationId,
          tableId,
          scannedAt: new Date()
        }
      });

      // Update reservation status to CHECKED_IN
      await db.reservation.update({
        where: { id: reservationId },
        data: { status: 'CHECKED_IN' }
      });

      // If there's a pre-order, create/update kitchen ticket with fire time
      let newKitchenTicket = null;
      if (reservation.preOrder) {
        let kitchenTicket = reservation.kitchenTicket;
        
        if (!kitchenTicket) {
          // Calculate prep time based on pre-order items
          const estimatedPrepTime = reservation.preOrder.items.reduce((total: number, item: any) => {
            const itemPrepTime = 8; // Default prep time per item
            return total + (itemPrepTime * item.quantity);
          }, 0);

          // Create kitchen ticket
          newKitchenTicket = await db.kitchenTicket.create({
            data: {
              reservationId,
              status: 'PENDING',
              estimatedPrepMinutes: Math.max(estimatedPrepTime, 5), // Minimum 5 minutes
              fireAt: new Date(), // Fire immediately on check-in
              itemsJson: reservation.preOrder.items.map((item: any) => {
                const modifiersPayload = item.modifiersJson;
                const modifiers = Array.isArray(modifiersPayload)
                  ? modifiersPayload
                  : Array.isArray(modifiersPayload?.details)
                    ? modifiersPayload.details
                    : [];

                return {
                  name: item.name,
                  quantity: item.quantity,
                  modifiers,
                  notes: item.notes,
                  allergens: item.allergensJson || []
                };
              })
            }
          });

          // Notify kitchen via WebSocket
          const wsManager = (global as any).websocketManager;
          if (wsManager) {
            wsManager.notifyNewTicket(reservation.restaurantId, {
              ...newKitchenTicket,
              reservation: {
                user: reservation.user,
                partySize: reservation.partySize,
                startAt: reservation.startAt
              }
            });
          }
        } else {
          // Update existing ticket to fire immediately
          newKitchenTicket = await db.kitchenTicket.update({
            where: { id: kitchenTicket.id },
            data: { 
              fireAt: new Date(),
              status: 'PENDING'
            }
          });
        }
      }

      // Create check-in event for audit trail
      await db.event.create({
        data: {
          kind: 'reservation.checked_in',
          actorId: reservation.userId,
          restaurantId: reservation.restaurantId,
          reservationId: reservation.id,
          payloadJson: {
            method,
            locationId,
            tableId,
            scannedAt: checkin.scannedAt
          }
        }
      });

      return {
        success: true,
        data: {
          checkin,
          reservation: {
            id: reservation.id,
            status: 'CHECKED_IN',
            partySize: reservation.partySize,
            startAt: reservation.startAt,
            user: {
              name: reservation.user?.name || '',
              email: reservation.user?.email || ''
            }
          },
          kitchenTicket: newKitchenTicket || reservation.kitchenTicket
        },
        message: 'Successfully checked in! Kitchen has been notified.'
      };

    } catch (error) {
      console.error('Check-in failed:', error);
      return reply.code(500).send({
        error: 'Failed to process check-in',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get check-in status for a reservation
  fastify.get<{
    Params: { reservationId: string };
  }>('/status/:reservationId', async (request, reply) => {
    try {
      const { reservationId } = request.params;

      const reservation = await db.reservation.findUnique({
        where: { id: reservationId },
        include: {
          checkin: {
            include: {
              table: true,
              location: true
            }
          },
          kitchenTicket: true,
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      });

      if (!reservation) {
        return reply.code(404).send({
          error: 'Reservation not found'
        });
      }

      return {
        success: true,
        data: {
          reservation: {
            id: reservation.id,
            status: reservation.status,
            partySize: reservation.partySize,
            startAt: reservation.startAt,
            user: reservation.user
          },
          checkin: reservation.checkin,
          kitchenTicket: reservation.kitchenTicket
        }
      };

    } catch (error) {
      console.error('Get check-in status failed:', error);
      return reply.code(500).send({
        error: 'Failed to get check-in status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate QR code data for a reservation
  fastify.get<{
    Params: { reservationId: string };
  }>('/qr/:reservationId', async (request, reply) => {
    try {
      const { reservationId } = request.params;

      const reservation = await db.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          status: true,
          startAt: true,
          restaurantId: true,
          partySize: true,
          user: {
            select: {
              name: true,
              email: true
            }
          },
          restaurant: {
            select: {
              name: true,
              slug: true
            }
          }
        }
      });

      if (!reservation) {
        return reply.code(404).send({
          error: 'Reservation not found'
        });
      }

      // QR code contains check-in URL and reservation data
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const qrData = {
        url: `${baseUrl}/checkin/${reservationId}`,
        reservationId,
        restaurantName: reservation.restaurant.name,
        guestName: reservation.user?.name || '',
        reservationTime: reservation.startAt
      };

      return {
        success: true,
        data: {
          qrData: JSON.stringify(qrData),
          qrUrl: qrData.url,
          reservation: {
            id: reservation.id,
            status: reservation.status,
            restaurant: reservation.restaurant,
            user: reservation.user
          }
        }
      };

    } catch (error) {
      console.error('Generate QR code failed:', error);
      return reply.code(500).send({
        error: 'Failed to generate QR code',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Manual check-in (for staff use)
  fastify.post<{
    Body: {
      reservationId: string;
      locationId: string;
      tableId?: string;
    };
  }>('/manual', async (request, reply) => {
    try {
      const { reservationId, locationId, tableId } = request.body;

      // Use the same logic as QR scan but with MANUAL method
      const result = await fastify.inject({
        method: 'POST',
        url: '/checkin/scan',
        payload: {
          reservationId,
          method: 'MANUAL',
          locationId,
          tableId
        }
      });

      return JSON.parse(result.body);

    } catch (error) {
      console.error('Manual check-in failed:', error);
      return reply.code(500).send({
        error: 'Failed to process manual check-in',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
