import Stripe from 'stripe';
import { db } from '../lib/db';
import Logger from '../lib/logger';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-12-18.acacia',
});

export interface CreatePaymentIntentInput {
  amount: number; // in cents
  currency?: string;
  customerId?: string;
  metadata?: Record<string, string>;
  preOrderId?: string;
  reservationId?: string;
}

export interface ProcessPaymentInput {
  paymentIntentId: string;
  preOrderId: string;
  paymentMethodId?: string;
}

export class PaymentService {
  /**
   * Create a payment intent for pre-order payment
   */
  async createPaymentIntent(input: CreatePaymentIntentInput): Promise<Stripe.PaymentIntent> {
    try {
      const {
        amount,
        currency = 'usd',
        customerId,
        metadata = {},
        preOrderId,
        reservationId,
      } = input;

      // Validate amount
      if (amount <= 0) {
        throw new Error('Payment amount must be greater than 0');
      }

      // Add metadata
      const paymentMetadata = {
        ...metadata,
        ...(preOrderId && { preOrderId }),
        ...(reservationId && { reservationId }),
        source: 'lacarta',
      };

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        automatic_payment_methods: {
          enabled: true,
        },
        ...(customerId && { customer: customerId }),
        metadata: paymentMetadata,
      });

      // Log payment intent creation
      Logger.info('Payment intent created', {
        paymentIntentId: paymentIntent.id,
        amount,
        currency,
        preOrderId,
        reservationId,
      });

      return paymentIntent;
    } catch (error) {
      Logger.error('Failed to create payment intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        input,
      });
      throw error;
    }
  }

  /**
   * Retrieve a payment intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      Logger.error('Failed to retrieve payment intent', {
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Update payment intent amount (before confirmation)
   */
  async updatePaymentIntent(
    paymentIntentId: string,
    amount: number
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await stripe.paymentIntents.update(paymentIntentId, {
        amount,
      });

      Logger.info('Payment intent updated', {
        paymentIntentId,
        newAmount: amount,
      });

      return paymentIntent;
    } catch (error) {
      Logger.error('Failed to update payment intent', {
        paymentIntentId,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(
    paymentIntentId: string,
    reason?: string
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
        cancellation_reason: 'requested_by_customer',
      });

      Logger.info('Payment intent cancelled', {
        paymentIntentId,
        reason,
      });

      return paymentIntent;
    } catch (error) {
      Logger.error('Failed to cancel payment intent', {
        paymentIntentId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process payment completion and update pre-order
   */
  async processPaymentCompletion(input: ProcessPaymentInput): Promise<{
    payment: any;
    preOrder: any;
  }> {
    try {
      const { paymentIntentId, preOrderId } = input;

      // Retrieve payment intent to verify status
      const paymentIntent = await this.getPaymentIntent(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        throw new Error(`Payment not successful. Status: ${paymentIntent.status}`);
      }

      // Create payment record
      const payment = await db.payment.create({
        data: {
          preOrderId,
          stripePaymentIntentId: paymentIntentId,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          status: 'SUCCEEDED',
          paymentMethod: paymentIntent.payment_method_types[0] || 'card',
        },
      });

      // Update pre-order status
      const preOrder = await db.preOrder.update({
        where: { id: preOrderId },
        data: {
          status: 'AUTHORIZED',
          paymentIntentId: paymentIntentId,
        },
        include: {
          items: true,
          payments: true,
        },
      });

      Logger.info('Payment processed successfully', {
        paymentId: payment.id,
        preOrderId,
        paymentIntentId,
        amount: paymentIntent.amount,
      });

      return { payment, preOrder };
    } catch (error) {
      Logger.error('Failed to process payment completion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        input,
      });
      throw error;
    }
  }

  /**
   * Create a refund for a payment
   */
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<Stripe.Refund> {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        ...(amount && { amount }),
        ...(reason && { reason: reason as Stripe.RefundCreateParams.Reason }),
      });

      Logger.info('Refund created', {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount,
        reason,
      });

      return refund;
    } catch (error) {
      Logger.error('Failed to create refund', {
        paymentIntentId,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create or retrieve a Stripe customer
   */
  async createOrRetrieveCustomer(
    userId: string,
    email: string,
    name?: string
  ): Promise<string> {
    try {
      // Check if user already has a Stripe customer ID
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (user?.stripeCustomerId) {
        return user.stripeCustomerId;
      }

      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email,
        ...(name && { name }),
        metadata: {
          userId,
        },
      });

      // Update user with Stripe customer ID
      await db.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customer.id },
      });

      Logger.info('Stripe customer created', {
        customerId: customer.id,
        userId,
        email,
      });

      return customer.id;
    } catch (error) {
      Logger.error('Failed to create or retrieve customer', {
        userId,
        email,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * List payment methods for a customer
   */
  async listPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });

      return paymentMethods.data;
    } catch (error) {
      Logger.error('Failed to list payment methods', {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Setup payment method for future use
   */
  async setupPaymentMethod(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });

      Logger.info('Setup intent created', {
        setupIntentId: setupIntent.id,
        customerId,
      });

      return setupIntent;
    } catch (error) {
      Logger.error('Failed to setup payment method', {
        customerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Calculate platform fee (for marketplace model)
   */
  calculatePlatformFee(amount: number, feePercentage: number = 2.5): number {
    return Math.round(amount * (feePercentage / 100));
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(
    payload: string | Buffer,
    signature: string,
    endpointSecret: string
  ): Stripe.Event {
    try {
      return stripe.webhooks.constructEvent(payload, signature, endpointSecret);
    } catch (error) {
      Logger.error('Invalid webhook signature', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Invalid webhook signature');
    }
  }
}