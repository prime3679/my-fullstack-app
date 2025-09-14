import { PaymentService } from './paymentService';

// Mock Stripe module - create all mocks inside the factory
jest.mock('stripe', () => {
  const mockStripe = {
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    customers: {
      create: jest.fn(),
    },
    paymentMethods: {
      list: jest.fn(),
    },
    setupIntents: {
      create: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  };
  
  return jest.fn(() => mockStripe);
});

// Get the mocked Stripe constructor and instance for use in tests
import Stripe from 'stripe';
const MockedStripe = Stripe as jest.MockedClass<typeof Stripe>;

// Helper to get current mock instance
const getMockStripe = () => {
  const lastCall = MockedStripe.mock.results[MockedStripe.mock.results.length - 1];
  return lastCall?.value;
};

// Mock dependencies
jest.mock('../lib/db', () => ({
  db: {
    payment: {
      create: jest.fn(),
    },
    preOrder: {
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock('../lib/logger', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

import { db } from '../lib/db';

describe('PaymentService', () => {
  let paymentService: PaymentService;
  let mockStripe: any;

  beforeEach(() => {
    jest.clearAllMocks();
    paymentService = new PaymentService();
    // Get the mock instance from the mocked constructor
    mockStripe = getMockStripe();
  });

  describe('createPaymentIntent', () => {
    it('should create a payment intent successfully', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        amount: 5000,
        currency: 'usd',
        client_secret: 'pi_test_secret',
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const result = await paymentService.createPaymentIntent({
        amount: 5000,
        customerId: 'cus_123',
        metadata: { orderId: 'order_123' },
      });

      expect(result).toEqual(mockPaymentIntent);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
        customer: 'cus_123',
        metadata: {
          orderId: 'order_123',
          source: 'lacarta',
        },
      });
    });

    it('should throw error for invalid amount', async () => {
      await expect(
        paymentService.createPaymentIntent({ amount: 0 })
      ).rejects.toThrow('Payment amount must be greater than 0');
    });

    it('should handle Stripe errors', async () => {
      mockStripe.paymentIntents.create.mockRejectedValue(new Error('Stripe error'));

      await expect(
        paymentService.createPaymentIntent({ amount: 5000 })
      ).rejects.toThrow('Stripe error');
    });
  });

  describe('updatePaymentIntent', () => {
    it('should update payment intent amount', async () => {
      const mockUpdatedIntent = {
        id: 'pi_test123',
        amount: 6000,
      };

      mockStripe.paymentIntents.update.mockResolvedValue(mockUpdatedIntent);

      const result = await paymentService.updatePaymentIntent('pi_test123', 6000);

      expect(result).toEqual(mockUpdatedIntent);
      expect(mockStripe.paymentIntents.update).toHaveBeenCalledWith('pi_test123', {
        amount: 6000,
      });
    });
  });

  describe('cancelPaymentIntent', () => {
    it('should cancel payment intent', async () => {
      const mockCancelledIntent = {
        id: 'pi_test123',
        status: 'canceled',
      };

      mockStripe.paymentIntents.cancel.mockResolvedValue(mockCancelledIntent);

      const result = await paymentService.cancelPaymentIntent('pi_test123', 'User requested');

      expect(result).toEqual(mockCancelledIntent);
      expect(mockStripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_test123', {
        cancellation_reason: 'requested_by_customer',
      });
    });
  });

  describe('processPaymentCompletion', () => {
    it('should process successful payment', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 5000,
        currency: 'usd',
        payment_method_types: ['card'],
      };

      const mockPayment = {
        id: 'payment_123',
        preOrderId: 'order_123',
        amount: 5000,
      };

      const mockPreOrder = {
        id: 'order_123',
        status: 'AUTHORIZED',
        items: [],
        payments: [mockPayment],
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
      (db.payment.create as jest.Mock).mockResolvedValue(mockPayment);
      (db.preOrder.update as jest.Mock).mockResolvedValue(mockPreOrder);

      const result = await paymentService.processPaymentCompletion({
        paymentIntentId: 'pi_test123',
        preOrderId: 'order_123',
      });

      expect(result.payment).toEqual(mockPayment);
      expect(result.preOrder).toEqual(mockPreOrder);
      expect(db.payment.create).toHaveBeenCalledWith({
        data: {
          preOrderId: 'order_123',
          stripePaymentIntentId: 'pi_test123',
          amount: 5000,
          currency: 'usd',
          status: 'SUCCEEDED',
          paymentMethod: 'card',
        },
      });
    });

    it('should throw error if payment not succeeded', async () => {
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'processing',
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      await expect(
        paymentService.processPaymentCompletion({
          paymentIntentId: 'pi_test123',
          preOrderId: 'order_123',
        })
      ).rejects.toThrow('Payment not successful. Status: processing');
    });
  });

  describe('createRefund', () => {
    it('should create full refund', async () => {
      const mockRefund = {
        id: 'ref_123',
        amount: 5000,
        status: 'succeeded',
      };

      mockStripe.refunds.create.mockResolvedValue(mockRefund);

      const result = await paymentService.createRefund('pi_test123');

      expect(result).toEqual(mockRefund);
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test123',
      });
    });

    it('should create partial refund', async () => {
      const mockRefund = {
        id: 'ref_123',
        amount: 2500,
        status: 'succeeded',
      };

      mockStripe.refunds.create.mockResolvedValue(mockRefund);

      const result = await paymentService.createRefund('pi_test123', 2500, 'duplicate');

      expect(result).toEqual(mockRefund);
      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        payment_intent: 'pi_test123',
        amount: 2500,
        reason: 'duplicate',
      });
    });
  });

  describe('createOrRetrieveCustomer', () => {
    it('should return existing customer ID', async () => {
      (db.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_123',
        stripeCustomerId: 'cus_existing',
      });

      const customerId = await paymentService.createOrRetrieveCustomer(
        'user_123',
        'user@example.com',
        'John Doe'
      );

      expect(customerId).toBe('cus_existing');
      expect(mockStripe.customers.create).not.toHaveBeenCalled();
    });

    it('should create new customer if not exists', async () => {
      (db.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user_123',
        stripeCustomerId: null,
      });

      mockStripe.customers.create.mockResolvedValue({
        id: 'cus_new',
      });

      const customerId = await paymentService.createOrRetrieveCustomer(
        'user_123',
        'user@example.com',
        'John Doe'
      );

      expect(customerId).toBe('cus_new');
      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        name: 'John Doe',
        metadata: { userId: 'user_123' },
      });
      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user_123' },
        data: { stripeCustomerId: 'cus_new' },
      });
    });
  });

  describe('listPaymentMethods', () => {
    it('should list customer payment methods', async () => {
      const mockPaymentMethodsData = [
        {
          id: 'pm_123',
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242',
          },
        },
      ];

      mockStripe.paymentMethods.list.mockResolvedValue({
        data: mockPaymentMethodsData,
      });

      const result = await paymentService.listPaymentMethods('cus_123');

      expect(result).toEqual(mockPaymentMethodsData);
      expect(mockStripe.paymentMethods.list).toHaveBeenCalledWith({
        customer: 'cus_123',
        type: 'card',
      });
    });
  });

  describe('setupPaymentMethod', () => {
    it('should create setup intent for payment method', async () => {
      const mockSetupIntent = {
        id: 'seti_123',
        client_secret: 'seti_secret',
      };

      mockStripe.setupIntents.create.mockResolvedValue(mockSetupIntent);

      const result = await paymentService.setupPaymentMethod('cus_123');

      expect(result).toEqual(mockSetupIntent);
      expect(mockStripe.setupIntents.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        payment_method_types: ['card'],
        usage: 'off_session',
      });
    });
  });

  describe('calculatePlatformFee', () => {
    it('should calculate platform fee correctly', () => {
      const fee = paymentService.calculatePlatformFee(10000); // $100
      expect(fee).toBe(250); // 2.5% = $2.50
    });

    it('should use custom fee percentage', () => {
      const fee = paymentService.calculatePlatformFee(10000, 3.5);
      expect(fee).toBe(350); // 3.5% = $3.50
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate webhook signature successfully', () => {
      const mockEvent = { type: 'payment_intent.succeeded', data: {} };
      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent);

      const result = paymentService.validateWebhookSignature(
        'payload',
        'signature',
        'secret'
      );

      expect(result).toEqual(mockEvent);
      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'payload',
        'signature',
        'secret'
      );
    });

    it('should throw error for invalid signature', () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() =>
        paymentService.validateWebhookSignature('payload', 'bad_sig', 'secret')
      ).toThrow('Invalid webhook signature');
    });
  });
});