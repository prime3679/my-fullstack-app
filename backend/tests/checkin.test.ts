import request from 'supertest';
import { fastify } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { cleanDatabase, prisma } from './setup';
import { checkinRoutes } from '../src/routes/checkin';
import { WebSocketManager } from '../src/lib/websocketManager';

describe('Check-in System', () => {
  let app: any;
  let restaurantId: string;
  let locationId: string;
  let tableId: string;
  let userId: string;
  let reservationId: string;
  let bookedReservationId: string;
  let wsManager: WebSocketManager;

  beforeAll(async () => {
    // Create Fastify instance
    app = fastify({
      logger: false
    });

    // Initialize WebSocket manager
    wsManager = new WebSocketManager(app);
    (global as any).websocketManager = wsManager;

    // Register check-in routes
    await app.register(checkinRoutes, { prefix: '/api/v1/checkin' });
    
    await app.ready();
    
    // Create test data
    await setupTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
  });

  async function setupTestData() {
    // Create restaurant
    const restaurant = await prisma.restaurant.create({
      data: {
        name: 'Test Check-in Restaurant',
        slug: 'test-checkin'
      }
    });
    restaurantId = restaurant.id;

    // Create location
    const location = await prisma.location.create({
      data: {
        restaurantId,
        address: '123 Check-in St'
      }
    });
    locationId = location.id;

    // Create table
    const table = await prisma.table.create({
      data: {
        locationId,
        label: 'Table 1',
        seats: 4
      }
    });
    tableId = table.id;

    // Create user
    const user = await prisma.user.create({
      data: {
        name: 'Test Guest',
        email: 'guest@test.com',
        role: 'DINER'
      }
    });
    userId = user.id;

    // Create checked-in reservation (for status tests)
    const checkedInReservation = await prisma.reservation.create({
      data: {
        restaurantId,
        userId,
        partySize: 2,
        startAt: new Date(),
        status: 'CHECKED_IN',
        source: 'website'
      }
    });
    reservationId = checkedInReservation.id;

    // Create check-in record for the checked-in reservation
    await prisma.checkIn.create({
      data: {
        reservationId,
        method: 'QR_SCAN',
        locationId,
        tableId,
        scannedAt: new Date()
      }
    });

    // Create booked reservation (for check-in tests)
    const bookedReservation = await prisma.reservation.create({
      data: {
        restaurantId,
        userId,
        partySize: 4,
        startAt: new Date(),
        status: 'BOOKED',
        source: 'website'
      }
    });
    bookedReservationId = bookedReservation.id;

    // Create pre-order for the booked reservation
    const preOrder = await prisma.preOrder.create({
      data: {
        reservationId: bookedReservationId,
        status: 'AUTHORIZED',
        subtotal: 3000, // $30.00
        tax: 300, // $3.00
        tip: 500, // $5.00
        total: 3800 // $38.00
      }
    });

    // Add pre-order items
    await prisma.preOrderItem.create({
      data: {
        preorderId: preOrder.id,
        sku: 'caesar-salad',
        name: 'Caesar Salad',
        quantity: 2,
        price: 1500,
        modifiersJson: ['extra-croutons'],
        allergensJson: ['gluten'],
        notes: 'Light dressing'
      }
    });
  }

  describe('POST /api/v1/checkin/scan', () => {
    it('should successfully check in a booked reservation', async () => {
      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: bookedReservationId,
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.checkin).toBeTruthy();
      expect(response.body.data.reservation.status).toBe('CHECKED_IN');
      expect(response.body.data.kitchenTicket).toBeTruthy();
      expect(response.body.message).toContain('Successfully checked in');

      // Verify in database
      const reservation = await prisma.reservation.findUnique({
        where: { id: bookedReservationId },
        include: { checkin: true, kitchenTicket: true }
      });
      
      expect(reservation?.status).toBe('CHECKED_IN');
      expect(reservation?.checkin).toBeTruthy();
      expect(reservation?.kitchenTicket).toBeTruthy();
    });

    it('should create kitchen ticket with pre-order items', async () => {
      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: bookedReservationId,
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(200);

      const kitchenTicket = response.body.data.kitchenTicket;
      expect(kitchenTicket.status).toBe('PENDING');
      expect(kitchenTicket.estimatedPrepMinutes).toBeGreaterThan(0);
      expect(kitchenTicket.fireAt).toBeTruthy();
      expect(kitchenTicket.itemsJson).toHaveLength(1);
      expect(kitchenTicket.itemsJson[0].name).toBe('Caesar Salad');
      expect(kitchenTicket.itemsJson[0].quantity).toBe(2);
      expect(kitchenTicket.itemsJson[0].modifiers).toContain('extra-croutons');
    });

    it('should support manual check-in method', async () => {
      // Create another booked reservation for manual check-in
      const manualReservation = await prisma.reservation.create({
        data: {
          restaurantId,
          userId,
          partySize: 2,
          startAt: new Date(),
          status: 'BOOKED',
          source: 'phone'
        }
      });

      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: manualReservation.id,
          method: 'MANUAL',
          locationId,
          tableId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const checkIn = await prisma.checkIn.findFirst({
        where: { reservationId: manualReservation.id }
      });
      expect(checkIn?.method).toBe('MANUAL');
    });

    it('should support integration check-in method', async () => {
      // Create another booked reservation for integration check-in
      const integrationReservation = await prisma.reservation.create({
        data: {
          restaurantId,
          userId,
          partySize: 3,
          startAt: new Date(),
          status: 'BOOKED',
          source: 'opentable'
        }
      });

      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: integrationReservation.id,
          method: 'INTEGRATION',
          locationId,
          tableId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const checkIn = await prisma.checkIn.findFirst({
        where: { reservationId: integrationReservation.id }
      });
      expect(checkIn?.method).toBe('INTEGRATION');
    });

    it('should allow check-in without specifying table', async () => {
      // Create another booked reservation
      const noTableReservation = await prisma.reservation.create({
        data: {
          restaurantId,
          userId,
          partySize: 2,
          startAt: new Date(),
          status: 'BOOKED',
          source: 'website'
        }
      });

      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: noTableReservation.id,
          method: 'QR_SCAN',
          locationId
          // tableId omitted
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      const checkIn = await prisma.checkIn.findFirst({
        where: { reservationId: noTableReservation.id }
      });
      expect(checkIn?.tableId).toBeNull();
    });

    it('should reject check-in for non-existent reservation', async () => {
      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: 'non-existent',
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(404);

      expect(response.body.error).toBe('Reservation not found');
    });

    it('should reject check-in for non-BOOKED reservation', async () => {
      // Try to check in already checked-in reservation
      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId,
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(400);

      expect(response.body.error).toBe('Reservation must be BOOKED status to check in');
      expect(response.body.currentStatus).toBe('CHECKED_IN');
    });

    it('should reject duplicate check-in', async () => {
      // First check-in
      await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: bookedReservationId,
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(200);

      // Second check-in attempt
      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: bookedReservationId,
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(400);

      expect(response.body.error).toBe('Reservation already checked in');
      expect(response.body.checkinTime).toBeTruthy();
    });

    it('should reject invalid table reference', async () => {
      // Create another booked reservation
      const invalidTableReservation = await prisma.reservation.create({
        data: {
          restaurantId,
          userId,
          partySize: 2,
          startAt: new Date(),
          status: 'BOOKED',
          source: 'website'
        }
      });

      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: invalidTableReservation.id,
          method: 'QR_SCAN',
          locationId,
          tableId: 'invalid-table-id'
        })
        .expect(500);

      expect(response.body.error).toBe('Failed to process check-in');
      expect(response.body.message).toContain('constraint');
    });

    it('should require all mandatory fields', async () => {
      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          // Missing reservationId, method, locationId
        })
        .expect(500); // Fastify validation error

      expect(response.body.error).toBeTruthy();
    });

    it('should create audit event for check-in', async () => {
      await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: bookedReservationId,
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(200);

      // Verify audit event was created
      const event = await prisma.event.findFirst({
        where: {
          kind: 'reservation.checked_in',
          reservationId: bookedReservationId
        }
      });

      expect(event).toBeTruthy();
      expect(event?.actorId).toBe(userId);
      expect(event?.restaurantId).toBe(restaurantId);
      expect(event?.payloadJson).toMatchObject({
        method: 'QR_SCAN',
        locationId,
        tableId
      });
    });
  });

  describe('GET /api/v1/checkin/status/:reservationId', () => {
    it('should return check-in status for checked-in reservation', async () => {
      const response = await request(app.server)
        .get(`/api/v1/checkin/status/${reservationId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reservation.id).toBe(reservationId);
      expect(response.body.data.reservation.status).toBe('CHECKED_IN');
      expect(response.body.data.checkin).toBeTruthy();
      expect(response.body.data.checkin.method).toBe('QR_SCAN');
      expect(response.body.data.checkin.location).toBeTruthy();
      expect(response.body.data.checkin.table).toBeTruthy();
    });

    it('should return status for booked reservation (not checked in)', async () => {
      const response = await request(app.server)
        .get(`/api/v1/checkin/status/${bookedReservationId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.reservation.id).toBe(bookedReservationId);
      expect(response.body.data.reservation.status).toBe('BOOKED');
      expect(response.body.data.checkin).toBeNull();
    });

    it('should return 404 for non-existent reservation', async () => {
      const response = await request(app.server)
        .get('/api/v1/checkin/status/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Reservation not found');
    });

    it('should include user information', async () => {
      const response = await request(app.server)
        .get(`/api/v1/checkin/status/${reservationId}`)
        .expect(200);

      expect(response.body.data.reservation.user).toBeTruthy();
      expect(response.body.data.reservation.user.name).toBe('Test Guest');
      expect(response.body.data.reservation.user.email).toBe('guest@test.com');
    });

    it('should include kitchen ticket information when present', async () => {
      // First check in the booked reservation to create kitchen ticket
      await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: bookedReservationId,
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(200);

      const response = await request(app.server)
        .get(`/api/v1/checkin/status/${bookedReservationId}`)
        .expect(200);

      expect(response.body.data.kitchenTicket).toBeTruthy();
      expect(response.body.data.kitchenTicket.status).toBe('PENDING');
    });
  });

  describe('GET /api/v1/checkin/qr/:reservationId', () => {
    it('should generate QR code data for reservation', async () => {
      const response = await request(app.server)
        .get(`/api/v1/checkin/qr/${bookedReservationId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.qrData).toBeTruthy();
      expect(response.body.data.qrUrl).toBeTruthy();
      
      const qrData = JSON.parse(response.body.data.qrData);
      expect(qrData.reservationId).toBe(bookedReservationId);
      expect(qrData.restaurantName).toBe('Test Check-in Restaurant');
      expect(qrData.guestName).toBe('Test Guest');
      expect(qrData.url).toContain('/checkin/');
    });

    it('should include restaurant and user information', async () => {
      const response = await request(app.server)
        .get(`/api/v1/checkin/qr/${bookedReservationId}`)
        .expect(200);

      expect(response.body.data.reservation).toBeTruthy();
      expect(response.body.data.reservation.restaurant.name).toBe('Test Check-in Restaurant');
      expect(response.body.data.reservation.restaurant.slug).toBe('test-checkin');
      expect(response.body.data.reservation.user.name).toBe('Test Guest');
    });

    it('should return 404 for non-existent reservation', async () => {
      const response = await request(app.server)
        .get('/api/v1/checkin/qr/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Reservation not found');
    });

    it('should use environment variable for frontend URL', async () => {
      const originalUrl = process.env.FRONTEND_URL;
      process.env.FRONTEND_URL = 'https://example.com';

      const response = await request(app.server)
        .get(`/api/v1/checkin/qr/${bookedReservationId}`)
        .expect(200);

      const qrData = JSON.parse(response.body.data.qrData);
      expect(qrData.url).toMatch(/^https:\/\/example\.com/);

      // Restore original value
      if (originalUrl) {
        process.env.FRONTEND_URL = originalUrl;
      } else {
        delete process.env.FRONTEND_URL;
      }
    });
  });

  describe('POST /api/v1/checkin/manual', () => {
    it('should perform manual check-in using scan endpoint', async () => {
      const response = await request(app.server)
        .post('/api/v1/checkin/manual')
        .send({
          reservationId: bookedReservationId,
          locationId,
          tableId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify it used MANUAL method
      const checkIn = await prisma.checkIn.findFirst({
        where: { reservationId: bookedReservationId }
      });
      expect(checkIn?.method).toBe('MANUAL');
    });

    it('should handle manual check-in errors', async () => {
      const response = await request(app.server)
        .post('/api/v1/checkin/manual')
        .send({
          reservationId: 'non-existent',
          locationId,
          tableId
        })
        .expect(404);

      expect(response.body.error).toBe('Reservation not found');
    });

    it('should require reservationId and locationId', async () => {
      const response = await request(app.server)
        .post('/api/v1/checkin/manual')
        .send({
          // Missing required fields
        })
        .expect(500);

      expect(response.body.error).toBeTruthy();
    });
  });

  describe('Check-in Workflow Integration', () => {
    it('should handle complete workflow: reservation -> check-in -> kitchen ticket -> status tracking', async () => {
      // 1. Check initial status (BOOKED)
      let statusResponse = await request(app.server)
        .get(`/api/v1/checkin/status/${bookedReservationId}`)
        .expect(200);
      
      expect(statusResponse.body.data.reservation.status).toBe('BOOKED');
      expect(statusResponse.body.data.checkin).toBeNull();

      // 2. Perform check-in
      const checkinResponse = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: bookedReservationId,
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(200);

      expect(checkinResponse.body.data.kitchenTicket).toBeTruthy();
      const kitchenTicketId = checkinResponse.body.data.kitchenTicket.id;

      // 3. Check updated status (CHECKED_IN)
      statusResponse = await request(app.server)
        .get(`/api/v1/checkin/status/${bookedReservationId}`)
        .expect(200);
      
      expect(statusResponse.body.data.reservation.status).toBe('CHECKED_IN');
      expect(statusResponse.body.data.checkin).toBeTruthy();
      expect(statusResponse.body.data.kitchenTicket).toBeTruthy();

      // 4. Verify kitchen ticket was created correctly
      const kitchenTicket = await prisma.kitchenTicket.findUnique({
        where: { id: kitchenTicketId }
      });

      expect(kitchenTicket?.status).toBe('PENDING');
      expect(kitchenTicket?.fireAt).toBeTruthy();
      expect(kitchenTicket?.itemsJson).toHaveLength(1);
    });

    it('should handle check-in for reservation without pre-order', async () => {
      // Create reservation without pre-order
      const noPreOrderReservation = await prisma.reservation.create({
        data: {
          restaurantId,
          userId,
          partySize: 2,
          startAt: new Date(),
          status: 'BOOKED',
          source: 'website'
        }
      });

      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: noPreOrderReservation.id,
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.checkin).toBeTruthy();
      expect(response.body.data.kitchenTicket).toBeNull(); // No kitchen ticket without pre-order
    });

    it('should update existing kitchen ticket if present', async () => {
      // Create kitchen ticket before check-in (unusual but possible)
      const existingTicket = await prisma.kitchenTicket.create({
        data: {
          reservationId: bookedReservationId,
          status: 'HOLD',
          estimatedPrepMinutes: 30,
          fireAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes from now
          itemsJson: []
        }
      });

      const response = await request(app.server)
        .post('/api/v1/checkin/scan')
        .send({
          reservationId: bookedReservationId,
          method: 'QR_SCAN',
          locationId,
          tableId
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify ticket was updated to fire immediately
      const updatedTicket = await prisma.kitchenTicket.findUnique({
        where: { id: existingTicket.id }
      });
      
      expect(updatedTicket?.status).toBe('PENDING');
      expect(updatedTicket?.fireAt.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });
  });
});
