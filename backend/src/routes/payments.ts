import { FastifyInstance } from 'fastify';
import { PaymentService } from '../services/paymentService';
import { PreOrderService } from '../services/preOrderService';
import Logger from '../lib/logger';

const paymentService = new PaymentService();
const preOrderService = new PreOrderService();

interface CreatePaymentIntentBody {
  preOrderId: string;
  tipPercent?: number;
}

interface ConfirmPaymentBody {
  paymentIntentId: string;
  preOrderId: string;
}

interface WebhookBody {
  type: string;
  data: {
    object: any;
  };
}

export async function paymentRoutes(fastify: FastifyInstance) {
  // Create payment intent for pre-order
  fastify.post<{
    Body: CreatePaymentIntentBody;
  }>('/create-payment-intent', async (request, reply) => {
    try {
      const { preOrderId, tipPercent = 18 } = request.body;

      // Get pre-order details
      const preOrder = await preOrderService.getPreOrder(preOrderId);
      
      if (!preOrder) {
        return reply.code(404).send({
          error: 'Pre-order not found',
        });
      }

      if (preOrder.status !== 'DRAFT' && preOrder.status !== 'PENDING') {
        return reply.code(400).send({
          error: 'Pre-order is not in a payable state',
        });
      }

      // Calculate total with tip
      const subtotal = preOrder.subtotal;
      const tax = preOrder.tax;
      const tip = Math.round(subtotal * (tipPercent / 100));
      const total = subtotal + tax + tip;

      // Get or create Stripe customer
      let customerId: string | undefined;
      if (preOrder.userId) {
        const user = await fastify.db.user.findUnique({
          where: { id: preOrder.userId },
        });

        if (user) {
          customerId = await paymentService.createOrRetrieveCustomer(
            user.id,
            user.email,
            user.name
          );
        }
      }

      // Create payment intent
      const paymentIntent = await paymentService.createPaymentIntent({
        amount: total,
        customerId,
        metadata: {
          preOrderId: preOrder.id,
          reservationId: preOrder.reservationId || '',
          restaurantId: preOrder.restaurantId,
          subtotal: subtotal.toString(),
          tax: tax.toString(),
          tip: tip.toString(),
        },
      });

      // Update pre-order with payment intent ID and calculated tip
      await fastify.db.preOrder.update({
        where: { id: preOrderId },
        data: {
          paymentIntentId: paymentIntent.id,
          tip,
          total,
        },
      });

      return {
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: total,
          breakdown: {
            subtotal,
            tax,
            tip,
            total,
          },
        },
      };
    } catch (error) {
      Logger.error('Failed to create payment intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        preOrderId: request.body.preOrderId,
      });

      return reply.code(500).send({
        error: 'Failed to create payment intent',
      });
    }
  });

  // Update payment intent (e.g., tip change)
  fastify.patch<{
    Params: { paymentIntentId: string };
    Body: { tipPercent: number; preOrderId: string };
  }>('/payment-intent/:paymentIntentId', async (request, reply) => {
    try {
      const { paymentIntentId } = request.params;
      const { tipPercent, preOrderId } = request.body;

      // Get pre-order to recalculate
      const preOrder = await preOrderService.getPreOrder(preOrderId);
      
      if (!preOrder) {
        return reply.code(404).send({
          error: 'Pre-order not found',
        });
      }

      // Recalculate with new tip
      const subtotal = preOrder.subtotal;
      const tax = preOrder.tax;
      const tip = Math.round(subtotal * (tipPercent / 100));
      const total = subtotal + tax + tip;

      // Update payment intent
      const updatedIntent = await paymentService.updatePaymentIntent(
        paymentIntentId,
        total
      );

      // Update pre-order
      await fastify.db.preOrder.update({
        where: { id: preOrderId },
        data: {
          tip,
          total,
        },
      });

      return {
        success: true,
        data: {
          paymentIntentId: updatedIntent.id,
          amount: total,
          breakdown: {
            subtotal,
            tax,
            tip,
            total,
          },
        },
      };
    } catch (error) {
      Logger.error('Failed to update payment intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentIntentId: request.params.paymentIntentId,
      });

      return reply.code(500).send({
        error: 'Failed to update payment intent',
      });
    }
  });

  // Confirm payment completion
  fastify.post<{
    Body: ConfirmPaymentBody;
  }>('/confirm-payment', async (request, reply) => {
    try {
      const { paymentIntentId, preOrderId } = request.body;

      // Process payment completion
      const result = await paymentService.processPaymentCompletion({
        paymentIntentId,
        preOrderId,
      });

      // Update reservation status if linked
      if (result.preOrder.reservationId) {
        await fastify.db.reservation.update({
          where: { id: result.preOrder.reservationId },
          data: {
            hasPrepaid: true,
            status: 'CONFIRMED',
          },
        });
      }

      return {
        success: true,
        data: {
          payment: result.payment,
          preOrder: result.preOrder,
          confirmationNumber: `LC${Date.now().toString(36).toUpperCase()}`,
        },
      };
    } catch (error) {
      Logger.error('Failed to confirm payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: request.body,
      });

      return reply.code(500).send({
        error: 'Failed to confirm payment',
      });
    }
  });

  // Cancel payment intent
  fastify.post<{
    Params: { paymentIntentId: string };
    Body: { reason?: string };
  }>('/payment-intent/:paymentIntentId/cancel', async (request, reply) => {
    try {
      const { paymentIntentId } = request.params;
      const { reason } = request.body;

      const cancelledIntent = await paymentService.cancelPaymentIntent(
        paymentIntentId,
        reason
      );

      // Update pre-order status if exists
      const preOrder = await fastify.db.preOrder.findFirst({
        where: { paymentIntentId },
      });

      if (preOrder) {
        await fastify.db.preOrder.update({
          where: { id: preOrder.id },
          data: {
            status: 'CANCELLED',
          },
        });
      }

      return {
        success: true,
        data: {
          paymentIntentId: cancelledIntent.id,
          status: cancelledIntent.status,
        },
      };
    } catch (error) {
      Logger.error('Failed to cancel payment intent', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentIntentId: request.params.paymentIntentId,
      });

      return reply.code(500).send({
        error: 'Failed to cancel payment',
      });
    }
  });

  // Create refund
  fastify.post<{
    Body: {
      paymentIntentId: string;
      amount?: number;
      reason?: string;
    };
  }>('/refund', async (request, reply) => {
    try {
      const { paymentIntentId, amount, reason } = request.body;

      const refund = await paymentService.createRefund(
        paymentIntentId,
        amount,
        reason
      );

      // Update payment record
      const payment = await fastify.db.payment.findFirst({
        where: { stripePaymentIntentId: paymentIntentId },
      });

      if (payment) {
        await fastify.db.payment.update({
          where: { id: payment.id },
          data: {
            status: amount && amount < payment.amount ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
            refundedAmount: refund.amount,
          },
        });

        // Update pre-order status
        await fastify.db.preOrder.update({
          where: { id: payment.preOrderId },
          data: {
            status: 'REFUNDED',
          },
        });
      }

      return {
        success: true,
        data: {
          refundId: refund.id,
          amount: refund.amount,
          status: refund.status,
        },
      };
    } catch (error) {
      Logger.error('Failed to create refund', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: request.body,
      });

      return reply.code(500).send({
        error: 'Failed to create refund',
      });
    }
  });

  // Setup payment method for saved cards
  fastify.post<{
    Body: { userId: string };
  }>('/setup-payment-method', async (request, reply) => {
    try {
      const { userId } = request.body;

      const user = await fastify.db.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return reply.code(404).send({
          error: 'User not found',
        });
      }

      const customerId = await paymentService.createOrRetrieveCustomer(
        user.id,
        user.email,
        user.name
      );

      const setupIntent = await paymentService.setupPaymentMethod(customerId);

      return {
        success: true,
        data: {
          clientSecret: setupIntent.client_secret,
          setupIntentId: setupIntent.id,
        },
      };
    } catch (error) {
      Logger.error('Failed to setup payment method', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: request.body.userId,
      });

      return reply.code(500).send({
        error: 'Failed to setup payment method',
      });
    }
  });

  // List saved payment methods
  fastify.get<{
    Querystring: { userId: string };
  }>('/payment-methods', async (request, reply) => {
    try {
      const { userId } = request.query;

      const user = await fastify.db.user.findUnique({
        where: { id: userId },
        select: { stripeCustomerId: true },
      });

      if (!user?.stripeCustomerId) {
        return {
          success: true,
          data: {
            paymentMethods: [],
          },
        };
      }

      const paymentMethods = await paymentService.listPaymentMethods(
        user.stripeCustomerId
      );

      return {
        success: true,
        data: {
          paymentMethods: paymentMethods.map((pm) => ({
            id: pm.id,
            type: pm.type,
            card: pm.card
              ? {
                  brand: pm.card.brand,
                  last4: pm.card.last4,
                  expMonth: pm.card.exp_month,
                  expYear: pm.card.exp_year,
                }
              : null,
          })),
        },
      };
    } catch (error) {
      Logger.error('Failed to list payment methods', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: request.query.userId,
      });

      return reply.code(500).send({
        error: 'Failed to list payment methods',
      });
    }
  });

  // Stripe webhook handler
  fastify.post<{
    Body: string;
    Headers: {
      'stripe-signature': string;
    };
  }>(
    '/webhook',
    {
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      try {
        const signature = request.headers['stripe-signature'];
        const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

        // Validate webhook signature
        const event = paymentService.validateWebhookSignature(
          request.body,
          signature,
          endpointSecret
        );

        // Handle different event types
        switch (event.type) {
          case 'payment_intent.succeeded':
            const paymentIntent = event.data.object;
            Logger.info('Payment succeeded', {
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount,
            });
            break;

          case 'payment_intent.payment_failed':
            const failedIntent = event.data.object;
            Logger.warn('Payment failed', {
              paymentIntentId: failedIntent.id,
              error: failedIntent.last_payment_error,
            });
            break;

          default:
            Logger.info('Unhandled webhook event', {
              type: event.type,
            });
        }

        return { received: true };
      } catch (error) {
        Logger.error('Webhook processing failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        return reply.code(400).send({
          error: 'Webhook processing failed',
        });
      }
    }
  );
}