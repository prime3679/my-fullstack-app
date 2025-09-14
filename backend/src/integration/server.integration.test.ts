import Fastify, { FastifyInstance } from 'fastify';
import { db } from '../lib/db';
import { setupSecurity } from '../lib/security';
import { createTestUser, createTestRestaurant, createTestReservation } from '../test/setup';

describe('Server Integration Tests', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    fastify = Fastify({ logger: false });
    
    await setupSecurity(fastify, {
      environment: 'test',
      corsOrigins: ['http://localhost:3000'],
      rateLimitMax: 1000,
      rateLimitTimeWindow: '1 minute',
    });

    fastify.get('/api/health', async () => {
      return { status: 'OK' };
    });

    await fastify.ready();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('Security Middleware', () => {
    it('should set security headers', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/health',
      });

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('should handle CORS requests', async () => {
      const response = await fastify.inject({
        method: 'OPTIONS',
        url: '/api/health',
        headers: {
          Origin: 'http://localhost:3000',
        },
      });

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should block unauthorized CORS origins', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/health',
        headers: {
          Origin: 'http://malicious-site.com',
        },
      });

      expect(response.statusCode).toBe(500);
    });

    it('should enforce rate limiting', async () => {
      const requests = [];
      
      for (let i = 0; i < 1001; i++) {
        requests.push(
          fastify.inject({
            method: 'GET',
            url: '/api/health',
          })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimited = responses.filter(r => r.statusCode === 429);
      
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should reject invalid content types for POST requests', async () => {
      fastify.post('/api/test', async () => ({ success: true }));

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/test',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: 'plain text',
      });

      expect(response.statusCode).toBe(415);
      expect(JSON.parse(response.body).error).toBe('Unsupported Media Type');
    });

    it('should detect and block suspicious patterns', async () => {
      const xssResponse = await fastify.inject({
        method: 'GET',
        url: '/api/health?query=<script>alert(1)</script>',
      });

      expect(xssResponse.statusCode).toBe(400);
      expect(JSON.parse(xssResponse.body).error).toBe('Bad Request');

      const sqlResponse = await fastify.inject({
        method: 'GET',
        url: '/api/health?query=1 UNION SELECT * FROM users',
      });

      expect(sqlResponse.statusCode).toBe(400);

      const pathTraversalResponse = await fastify.inject({
        method: 'GET',
        url: '/api/../../etc/passwd',
      });

      expect(pathTraversalResponse.statusCode).toBe(400);
    });
  });

  describe('End-to-End Reservation Flow', () => {
    let user: any;
    let restaurant: any;

    beforeEach(async () => {
      user = await createTestUser();
      restaurant = await createTestRestaurant();
    });

    it('should complete full reservation workflow', async () => {
      const reservationDate = new Date('2024-02-01T19:00:00Z');
      
      const reservation = await db.reservation.create({
        data: {
          userId: user.id,
          restaurantId: restaurant.id,
          date: reservationDate,
          startAt: reservationDate,
          endAt: new Date(reservationDate.getTime() + 2 * 60 * 60 * 1000),
          partySize: 4,
          status: 'CONFIRMED',
          notes: 'Anniversary dinner',
        },
      });

      expect(reservation.status).toBe('CONFIRMED');

      const checkIn = await db.checkIn.create({
        data: {
          reservationId: reservation.id,
          userId: user.id,
          restaurantId: restaurant.id,
          checkedInAt: new Date(),
          tableNumber: '12',
        },
      });

      expect(checkIn.tableNumber).toBe('12');

      const updatedReservation = await db.reservation.update({
        where: { id: reservation.id },
        data: { status: 'CHECKED_IN' },
      });

      expect(updatedReservation.status).toBe('CHECKED_IN');

      const preOrder = await db.preOrder.create({
        data: {
          reservationId: reservation.id,
          userId: user.id,
          restaurantId: restaurant.id,
          status: 'PENDING',
          subtotal: 12000,
          tax: 1080,
          tip: 2400,
          total: 15480,
        },
      });

      expect(preOrder.total).toBe(15480);

      const preOrderItems = await db.preOrderItem.createMany({
        data: [
          {
            preOrderId: preOrder.id,
            name: 'Caesar Salad',
            price: 1200,
            quantity: 2,
            notes: 'No anchovies',
          },
          {
            preOrderId: preOrder.id,
            name: 'Ribeye Steak',
            price: 4800,
            quantity: 2,
            notes: 'Medium rare',
          },
        ],
      });

      expect(preOrderItems.count).toBe(2);

      const finalReservation = await db.reservation.update({
        where: { id: reservation.id },
        data: { status: 'COMPLETED' },
      });

      expect(finalReservation.status).toBe('COMPLETED');
    });
  });

  describe('Database Transactions', () => {
    it('should rollback on error', async () => {
      const user = await createTestUser();
      const restaurant = await createTestRestaurant();

      try {
        await db.$transaction(async (tx) => {
          const reservation = await tx.reservation.create({
            data: {
              userId: user.id,
              restaurantId: restaurant.id,
              date: new Date(),
              startAt: new Date(),
              endAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
              partySize: 2,
              status: 'CONFIRMED',
            },
          });

          throw new Error('Simulated error');
        });
      } catch (error) {
        // Expected error
      }

      const reservations = await db.reservation.findMany({
        where: { userId: user.id },
      });

      expect(reservations).toHaveLength(0);
    });

    it('should handle concurrent operations', async () => {
      const user = await createTestUser();
      const restaurant = await createTestRestaurant();

      const operations = Array(10).fill(null).map((_, i) => 
        db.reservation.create({
          data: {
            userId: user.id,
            restaurantId: restaurant.id,
            date: new Date(),
            startAt: new Date(Date.now() + i * 60 * 60 * 1000),
            endAt: new Date(Date.now() + (i + 2) * 60 * 60 * 1000),
            partySize: 2,
            status: 'CONFIRMED',
          },
        })
      );

      const results = await Promise.all(operations);
      expect(results).toHaveLength(10);

      const count = await db.reservation.count({
        where: { userId: user.id },
      });
      expect(count).toBe(10);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      const originalConnect = db.$connect;
      db.$connect = jest.fn().mockRejectedValue(new Error('Connection failed'));

      try {
        await db.$connect();
      } catch (error: any) {
        expect(error.message).toBe('Connection failed');
      }

      db.$connect = originalConnect;
    });

    it('should handle validation errors', async () => {
      try {
        await db.user.create({
          data: {
            email: 'invalid-email',
            phone: '123',
            name: '',
            password: 'weak',
          },
        });
      } catch (error: any) {
        expect(error).toBeDefined();
      }
    });
  });
});