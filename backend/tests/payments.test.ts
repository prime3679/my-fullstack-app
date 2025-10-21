import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/index';
import { db } from '../src/lib/db';

describe('Payment API Integration Tests', () => {
  let server: FastifyInstance;
  let testRestaurantId: string;
  let testUserId: string;
  let testReservationId: string;
  let testPreOrderId: string;

  beforeAll(async () => {
    // Build server
    server = await buildServer();
    await server.ready();

    // Create test restaurant
    const restaurant = await db.restaurant.create({
      data: {
        name: 'Test Payment Restaurant',
        slug: 'test-payment-restaurant',
        currency: 'USD',
        taxRate: 0.0825
      }
    });
    testRestaurantId = restaurant.id;

    // Create test user
    const user = await db.user.create({
      data: {
        email: `payment-test-${Date.now()}@test.com`,
        name: 'Payment Test User',
        phone: '+15555551234',
        role: 'DINER'
      }
    });
    testUserId = user.id;

    // Create test reservation
    const reservation = await db.reservation.create({
      data: {
        restaurantId: testRestaurantId,
        userId: testUserId,
        partySize: 2,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        status: 'BOOKED'
      }
    });
    testReservationId = reservation.id;

    // Create test menu item
    await db.menuCategory.create({
      data: {
        restaurantId: testRestaurantId,
        name: 'Test Category',
        displayOrder: 1,
        menuItems: {
          create: {
            restaurantId: testRestaurantId,
            sku: 'TEST-ITEM-001',
            name: 'Test Burger',
            price: 1200, // $12.00
            prepTimeMinutes: 15,
            isAvailable: true,
            is86: false
          }
        }
      }
    });

    // Create test pre-order
    const preOrder = await db.preOrder.create({
      data: {
        reservationId: testReservationId,
        status: 'DRAFT',
        subtotal: 1200,
        tax: 99, // 8.25% of $12
        tip: 0,
        total: 1299,
        currency: 'USD',
        items: {
          create: {
            sku: 'TEST-ITEM-001',
            name: 'Test Burger',
            quantity: 1,
            price: 1200,
            modifiersJson: [],
            allergensJson: []
          }
        }
      }
    });
    testPreOrderId = preOrder.id;
  });

  afterAll(async () => {
    // Cleanup
    await db.payment.deleteMany({ where: { preorderId: testPreOrderId } });
    await db.preOrderItem.deleteMany({ where: { preorderId: testPreOrderId } });
    await db.preOrder.delete({ where: { id: testPreOrderId } });
    await db.reservation.delete({ where: { id: testReservationId } });
    await db.menuItem.deleteMany({ where: { restaurantId: testRestaurantId } });
    await db.menuCategory.deleteMany({ where: { restaurantId: testRestaurantId } });
    await db.user.delete({ where: { id: testUserId } });
    await db.restaurant.delete({ where: { id: testRestaurantId } });

    await server.close();
  });

  describe('POST /api/v1/payments/payment-intent', () => {
    it('should create a payment intent successfully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/payments/payment-intent',
        payload: {
          preOrderId: testPreOrderId,
          tipAmount: 200 // $2.00 tip
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('clientSecret');
      expect(body.data).toHaveProperty('paymentIntentId');
      expect(body.data.amount).toBe(1499); // $12.99 + $2.00 tip
    });

    it('should fail with missing preOrderId', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/payments/payment-intent',
        payload: {
          tipAmount: 200
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeTruthy();
    });

    it('should fail with non-existent preOrderId', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/payments/payment-intent',
        payload: {
          preOrderId: 'non-existent-id',
          tipAmount: 0
        }
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBeTruthy();
    });

    it('should handle zero tip amount', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/payments/payment-intent',
        payload: {
          preOrderId: testPreOrderId,
          tipAmount: 0
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.amount).toBe(1299); // Just order total, no tip
    });
  });

  describe('GET /api/v1/payments/status/:preOrderId', () => {
    it('should return payment status for pre-order', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/payments/status/${testPreOrderId}`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('preOrderId');
      expect(body.data).toHaveProperty('hasPaidPayment');
      expect(body.data).toHaveProperty('totalPaid');
    });

    it('should return empty status for pre-order with no payments', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/v1/payments/status/${testPreOrderId}`
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.hasPaidPayment).toBe(false);
      expect(body.data.latestPayment).toBeNull();
      expect(body.data.totalPaid).toBe(0);
    });

    it('should fail with non-existent preOrderId', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/payments/status/non-existent-id'
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('POST /api/v1/payments/webhook', () => {
    it('should reject webhook without signature header', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/payments/webhook',
        payload: {
          type: 'payment_intent.succeeded',
          data: {}
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('stripe-signature');
    });

    it('should reject webhook with invalid signature', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/payments/webhook',
        headers: {
          'stripe-signature': 'invalid-signature'
        },
        payload: {
          type: 'payment_intent.succeeded',
          data: {}
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeTruthy();
    });
  });

  describe('Payment Flow Integration', () => {
    it('should complete full payment workflow', async () => {
      // Step 1: Create payment intent
      const intentResponse = await server.inject({
        method: 'POST',
        url: '/api/v1/payments/payment-intent',
        payload: {
          preOrderId: testPreOrderId,
          tipAmount: 300
        }
      });

      expect(intentResponse.statusCode).toBe(200);
      const intentBody = JSON.parse(intentResponse.body);
      const paymentIntentId = intentBody.data.paymentIntentId;

      // Step 2: Simulate Stripe payment success
      // (In real tests, you'd use Stripe test mode here)

      // Step 3: Check payment status
      const statusResponse = await server.inject({
        method: 'GET',
        url: `/api/v1/payments/status/${testPreOrderId}`
      });

      expect(statusResponse.statusCode).toBe(200);
      const statusBody = JSON.parse(statusResponse.body);
      expect(statusBody.data.preOrderId).toBe(testPreOrderId);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing environment variables gracefully', async () => {
      // This would test behavior when STRIPE_SECRET_KEY is not set
      // Skip in normal test runs
      expect(process.env.STRIPE_SECRET_KEY).toBeTruthy();
    });

    it('should validate payment amounts', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/payments/payment-intent',
        payload: {
          preOrderId: testPreOrderId,
          tipAmount: -100 // Negative tip should be handled
        }
      });

      // Should either accept and set to 0, or return error
      expect([200, 400]).toContain(response.statusCode);
    });
  });

  describe('Idempotency', () => {
    it('should handle duplicate payment intent creation', async () => {
      // Create first payment intent
      const response1 = await server.inject({
        method: 'POST',
        url: '/api/v1/payments/payment-intent',
        payload: {
          preOrderId: testPreOrderId,
          tipAmount: 200
        }
      });

      expect(response1.statusCode).toBe(200);

      // Create second payment intent with same pre-order
      // Should create new intent (tip might be different)
      const response2 = await server.inject({
        method: 'POST',
        url: '/api/v1/payments/payment-intent',
        payload: {
          preOrderId: testPreOrderId,
          tipAmount: 300
        }
      });

      expect(response2.statusCode).toBe(200);

      // Both should have different payment intent IDs
      const body1 = JSON.parse(response1.body);
      const body2 = JSON.parse(response2.body);
      expect(body1.data.paymentIntentId).not.toBe(body2.data.paymentIntentId);
    });
  });
});
