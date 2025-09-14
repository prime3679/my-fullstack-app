import Fastify from 'fastify';
import { paymentRoutes } from './payments';
import { PaymentService } from '../services/paymentService';
import { PreOrderService } from '../services/preOrderService';

// Mock the services
jest.mock('../services/paymentService');
jest.mock('../services/preOrderService');
jest.mock('../lib/logger');

describe('Payment Routes', () => {
  let fastify: any;
  let mockPaymentService: jest.Mocked<PaymentService>;
  let mockPreOrderService: jest.Mocked<PreOrderService>;

  beforeEach(async () => {
    fastify = Fastify();
    
    // Mock database
    fastify.decorate('db', {
      user: {
        findUnique: jest.fn(),
      },
      preOrder: {
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      reservation: {
        update: jest.fn(),
      },
      payment: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    });

    await fastify.register(paymentRoutes, { prefix: '/api/v1/payments' });
    
    // Get the mocked instances
    mockPaymentService = PaymentService.prototype as jest.Mocked<PaymentService>;
    mockPreOrderService = PreOrderService.prototype as jest.Mocked<PreOrderService>;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('POST /create-payment-intent', () => {
    it('should create payment intent successfully', async () => {
      const mockPreOrder = {
        id: 'order_123',
        status: 'DRAFT',
        subtotal: 5000,
        tax: 438,
        userId: 'user_123',
        restaurantId: 'rest_123',
        reservationId: 'res_123',
      };

      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test_secret',
      };

      mockPreOrderService.getPreOrder = jest.fn().mockResolvedValue(mockPreOrder);
      mockPaymentService.createOrRetrieveCustomer = jest.fn().mockResolvedValue('cus_123');
      mockPaymentService.createPaymentIntent = jest.fn().mockResolvedValue(mockPaymentIntent);
      fastify.db.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
      });
      fastify.db.preOrder.update.mockResolvedValue(mockPreOrder);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/payments/create-payment-intent',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preOrderId: 'order_123',
          tipPercent: 20,
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toHaveProperty('clientSecret');
      expect(body.data.breakdown).toEqual({
        subtotal: 5000,
        tax: 438,
        tip: 1000,
        total: 6438,
      });
    });

    it('should return 404 when pre-order not found', async () => {
      mockPreOrderService.getPreOrder = jest.fn().mockResolvedValue(null);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/payments/create-payment-intent',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preOrderId: 'nonexistent',
        }),
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Pre-order not found');
    });

    it('should return 400 when pre-order is not payable', async () => {
      mockPreOrderService.getPreOrder = jest.fn().mockResolvedValue({
        id: 'order_123',
        status: 'COMPLETED',
      });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/payments/create-payment-intent',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preOrderId: 'order_123',
        }),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Pre-order is not in a payable state');
    });
  });

  describe('PATCH /payment-intent/:paymentIntentId', () => {
    it('should update payment intent with new tip', async () => {
      const mockPreOrder = {
        id: 'order_123',
        subtotal: 5000,
        tax: 438,
      };

      const mockUpdatedIntent = {
        id: 'pi_test123',
      };

      mockPreOrderService.getPreOrder = jest.fn().mockResolvedValue(mockPreOrder);
      mockPaymentService.updatePaymentIntent = jest.fn().mockResolvedValue(mockUpdatedIntent);
      fastify.db.preOrder.update.mockResolvedValue(mockPreOrder);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/payments/payment-intent/pi_test123',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tipPercent: 25,
          preOrderId: 'order_123',
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.breakdown.tip).toBe(1250); // 25% of 5000
      expect(mockPaymentService.updatePaymentIntent).toHaveBeenCalledWith(
        'pi_test123',
        6688 // 5000 + 438 + 1250
      );
    });
  });

  describe('POST /confirm-payment', () => {
    it('should confirm payment successfully', async () => {
      const mockPayment = {
        id: 'pay_123',
        amount: 6438,
      };

      const mockPreOrder = {
        id: 'order_123',
        reservationId: 'res_123',
        status: 'AUTHORIZED',
      };

      mockPaymentService.processPaymentCompletion = jest.fn().mockResolvedValue({
        payment: mockPayment,
        preOrder: mockPreOrder,
      });

      fastify.db.reservation.update.mockResolvedValue({});

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/payments/confirm-payment',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: 'pi_test123',
          preOrderId: 'order_123',
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.payment).toEqual(mockPayment);
      expect(body.data.confirmationNumber).toMatch(/^LC/);
      expect(fastify.db.reservation.update).toHaveBeenCalledWith({
        where: { id: 'res_123' },
        data: {
          hasPrepaid: true,
          status: 'CONFIRMED',
        },
      });
    });
  });

  describe('POST /payment-intent/:paymentIntentId/cancel', () => {
    it('should cancel payment intent', async () => {
      const mockCancelledIntent = {
        id: 'pi_test123',
        status: 'canceled',
      };

      mockPaymentService.cancelPaymentIntent = jest.fn().mockResolvedValue(mockCancelledIntent);
      fastify.db.preOrder.findFirst.mockResolvedValue({
        id: 'order_123',
        paymentIntentId: 'pi_test123',
      });
      fastify.db.preOrder.update.mockResolvedValue({});

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/payments/payment-intent/pi_test123/cancel',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Customer changed mind',
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.status).toBe('canceled');
      expect(fastify.db.preOrder.update).toHaveBeenCalledWith({
        where: { id: 'order_123' },
        data: { status: 'CANCELLED' },
      });
    });
  });

  describe('POST /refund', () => {
    it('should create full refund', async () => {
      const mockRefund = {
        id: 'ref_123',
        amount: 5000,
        status: 'succeeded',
      };

      mockPaymentService.createRefund = jest.fn().mockResolvedValue(mockRefund);
      fastify.db.payment.findFirst.mockResolvedValue({
        id: 'pay_123',
        preOrderId: 'order_123',
        amount: 5000,
        stripePaymentIntentId: 'pi_test123',
      });
      fastify.db.payment.update.mockResolvedValue({});
      fastify.db.preOrder.update.mockResolvedValue({});

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/payments/refund',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: 'pi_test123',
          reason: 'Customer complaint',
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.refundId).toBe('ref_123');
      expect(fastify.db.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_123' },
        data: {
          status: 'REFUNDED',
          refundedAmount: 5000,
        },
      });
    });

    it('should create partial refund', async () => {
      const mockRefund = {
        id: 'ref_123',
        amount: 2500,
        status: 'succeeded',
      };

      mockPaymentService.createRefund = jest.fn().mockResolvedValue(mockRefund);
      fastify.db.payment.findFirst.mockResolvedValue({
        id: 'pay_123',
        preOrderId: 'order_123',
        amount: 5000,
        stripePaymentIntentId: 'pi_test123',
      });
      fastify.db.payment.update.mockResolvedValue({});
      fastify.db.preOrder.update.mockResolvedValue({});

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/payments/refund',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentIntentId: 'pi_test123',
          amount: 2500,
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.amount).toBe(2500);
      expect(fastify.db.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay_123' },
        data: {
          status: 'PARTIALLY_REFUNDED',
          refundedAmount: 2500,
        },
      });
    });
  });

  describe('POST /setup-payment-method', () => {
    it('should setup payment method for user', async () => {
      const mockSetupIntent = {
        id: 'seti_123',
        client_secret: 'seti_secret',
      };

      fastify.db.user.findUnique.mockResolvedValue({
        id: 'user_123',
        email: 'test@example.com',
        name: 'Test User',
      });

      mockPaymentService.createOrRetrieveCustomer = jest.fn().mockResolvedValue('cus_123');
      mockPaymentService.setupPaymentMethod = jest.fn().mockResolvedValue(mockSetupIntent);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/payments/setup-payment-method',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'user_123',
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.clientSecret).toBe('seti_secret');
    });

    it('should return 404 when user not found', async () => {
      fastify.db.user.findUnique.mockResolvedValue(null);

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/payments/setup-payment-method',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'nonexistent',
        }),
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('User not found');
    });
  });

  describe('GET /payment-methods', () => {
    it('should list user payment methods', async () => {
      const mockPaymentMethods = [
        {
          id: 'pm_123',
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242',
            exp_month: 12,
            exp_year: 2025,
          },
        },
      ];

      fastify.db.user.findUnique.mockResolvedValue({
        id: 'user_123',
        stripeCustomerId: 'cus_123',
      });

      mockPaymentService.listPaymentMethods = jest.fn().mockResolvedValue(mockPaymentMethods);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/payments/payment-methods?userId=user_123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.paymentMethods).toHaveLength(1);
      expect(body.data.paymentMethods[0].card.last4).toBe('4242');
    });

    it('should return empty array when user has no Stripe customer', async () => {
      fastify.db.user.findUnique.mockResolvedValue({
        id: 'user_123',
        stripeCustomerId: null,
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/payments/payment-methods?userId=user_123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.paymentMethods).toEqual([]);
    });
  });
});