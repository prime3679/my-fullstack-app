import Fastify from 'fastify';
import { reservationRoutes } from './reservations';
import { db } from '../lib/db';
import { createTestRestaurant, createTestUser, createTestReservation } from '../test/setup';

describe('Reservation Routes', () => {
  let fastify: any;
  let testUser: any;
  let testRestaurant: any;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(reservationRoutes, { prefix: '/api/v1/reservations' });
    
    testUser = await createTestUser();
    testRestaurant = await createTestRestaurant();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /api/v1/reservations', () => {
    it('should return list of reservations', async () => {
      const reservation1 = await createTestReservation(testUser.id, testRestaurant.id, {
        date: new Date('2024-01-15'),
        partySize: 2,
      });
      const reservation2 = await createTestReservation(testUser.id, testRestaurant.id, {
        date: new Date('2024-01-16'),
        partySize: 4,
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/reservations',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.reservations).toHaveLength(2);
    });

    it('should filter reservations by date', async () => {
      await createTestReservation(testUser.id, testRestaurant.id, {
        date: new Date('2024-01-15'),
      });
      await createTestReservation(testUser.id, testRestaurant.id, {
        date: new Date('2024-01-16'),
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/reservations?date=2024-01-15',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.reservations).toHaveLength(1);
    });

    it('should filter reservations by restaurant', async () => {
      const restaurant2 = await createTestRestaurant({ name: 'Restaurant 2', slug: 'restaurant-2' });
      
      await createTestReservation(testUser.id, testRestaurant.id);
      await createTestReservation(testUser.id, restaurant2.id);

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/reservations?restaurantId=${testRestaurant.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.reservations).toHaveLength(1);
      expect(body.reservations[0].restaurantId).toBe(testRestaurant.id);
    });
  });

  describe('GET /api/v1/reservations/:id', () => {
    it('should return a single reservation', async () => {
      const reservation = await createTestReservation(testUser.id, testRestaurant.id, {
        partySize: 3,
        notes: 'Window seat please',
      });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/reservations/${reservation.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.reservation.id).toBe(reservation.id);
      expect(body.reservation.partySize).toBe(3);
      expect(body.reservation.notes).toBe('Window seat please');
    });

    it('should return 404 for non-existent reservation', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/reservations/99999',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Reservation not found');
    });
  });

  describe('POST /api/v1/reservations', () => {
    it('should create a new reservation', async () => {
      const reservationDate = new Date('2024-02-01T19:00:00Z');
      
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: testUser.id,
          restaurantId: testRestaurant.id,
          date: reservationDate.toISOString(),
          startAt: reservationDate.toISOString(),
          endAt: new Date(reservationDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
          partySize: 4,
          notes: 'Birthday celebration',
        }),
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.reservation.partySize).toBe(4);
      expect(body.reservation.notes).toBe('Birthday celebration');
      expect(body.reservation.status).toBe('CONFIRMED');
    });

    it('should validate party size', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: testUser.id,
          restaurantId: testRestaurant.id,
          date: new Date().toISOString(),
          startAt: new Date().toISOString(),
          endAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          partySize: 0,
        }),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Party size must be at least 1');
    });

    it('should validate time range', async () => {
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() - 1000); // End before start

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/reservations',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: testUser.id,
          restaurantId: testRestaurant.id,
          date: startTime.toISOString(),
          startAt: startTime.toISOString(),
          endAt: endTime.toISOString(),
          partySize: 2,
        }),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('End time must be after start time');
    });
  });

  describe('PUT /api/v1/reservations/:id', () => {
    it('should update a reservation', async () => {
      const reservation = await createTestReservation(testUser.id, testRestaurant.id, {
        partySize: 2,
        notes: 'Original note',
      });

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v1/reservations/${reservation.id}`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partySize: 4,
          notes: 'Updated note',
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.reservation.partySize).toBe(4);
      expect(body.reservation.notes).toBe('Updated note');
    });

    it('should update reservation status', async () => {
      const reservation = await createTestReservation(testUser.id, testRestaurant.id, {
        status: 'CONFIRMED',
      });

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v1/reservations/${reservation.id}`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'CANCELLED',
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.reservation.status).toBe('CANCELLED');
    });
  });

  describe('DELETE /api/v1/reservations/:id', () => {
    it('should cancel a reservation', async () => {
      const reservation = await createTestReservation(testUser.id, testRestaurant.id);

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/reservations/${reservation.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Reservation cancelled successfully');

      const updated = await db.reservation.findUnique({
        where: { id: reservation.id },
      });
      expect(updated?.status).toBe('CANCELLED');
    });

    it('should return 404 for non-existent reservation', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/v1/reservations/99999',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/v1/reservations/:id/checkin', () => {
    it('should check in a reservation', async () => {
      const reservation = await createTestReservation(testUser.id, testRestaurant.id, {
        status: 'CONFIRMED',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: `/api/v1/reservations/${reservation.id}/checkin`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tableNumber: '12',
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Check-in successful');
      expect(body.reservation.status).toBe('CHECKED_IN');
    });

    it('should not allow check-in for cancelled reservation', async () => {
      const reservation = await createTestReservation(testUser.id, testRestaurant.id, {
        status: 'CANCELLED',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: `/api/v1/reservations/${reservation.id}/checkin`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tableNumber: '12',
        }),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Cannot check in');
    });
  });
});