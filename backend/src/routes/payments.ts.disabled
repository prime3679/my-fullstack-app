import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from '../services/paymentService';
import { db } from '../lib/db';

interface CreatePaymentIntentBody {
  preOrderId: string;
  tipAmount?: number;
}

interface ConfirmPaymentBody {
  paymentIntentId: string;
}

export async function paymentRoutes(fastify: FastifyInstance) {
  
  // Create payment intent for a pre-order
  fastify.post<{
    Body: CreatePaymentIntentBody;
  }>('/payment-intent', async (request, reply) => {
    try {
      const { preOrderId, tipAmount = 0 } = request.body;

      if (!preOrderId) {
        return reply.code(400).send({
          error: 'preOrderId is required'
        });
      }

      const paymentIntent = await paymentService.createPaymentIntent(preOrderId, tipAmount);

      return {
        success: true,
        data: paymentIntent
      };

    } catch (error) {
      console.error('Create payment intent failed:', error);
      return reply.code(500).send({
        error: 'Failed to create payment intent',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Confirm payment completion
  fastify.post<{
    Body: ConfirmPaymentBody;
  }>('/confirm', async (request, reply) => {
    try {
      const { paymentIntentId } = request.body;

      if (!paymentIntentId) {
        return reply.code(400).send({
          error: 'paymentIntentId is required'
        });
      }

      const result = await paymentService.confirmPayment(paymentIntentId);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error
        });
      }

      return {
        success: true,
        data: result.preOrder
      };

    } catch (error) {
      console.error('Confirm payment failed:', error);
      return reply.code(500).send({
        error: 'Failed to confirm payment',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Stripe webhook endpoint
  fastify.post('/webhook', async (request, reply) => {
    try {
      const signature = request.headers['stripe-signature'] as string;
      
      if (!signature) {
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      await paymentService.handleWebhook(request.body, signature);

      return reply.code(200).send({ received: true });

    } catch (error) {
      console.error('Webhook error:', error);
      return reply.code(400).send({
        error: 'Webhook error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Refund a payment
  fastify.post<{
    Body: {
      paymentIntentId: string;
      amount?: number;
      reason?: string;
    };
  }>('/refund', async (request, reply) => {
    try {
      const { paymentIntentId, amount } = request.body;

      if (!paymentIntentId) {
        return reply.code(400).send({
          error: 'paymentIntentId is required'
        });
      }

      const result = await paymentService.processRefund(paymentIntentId, amount);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error
        });
      }

      return {
        success: true,
        data: { refundId: result.refundId }
      };

    } catch (error) {
      console.error('Refund failed:', error);
      return reply.code(500).send({
        error: 'Failed to process refund',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get payment status
  fastify.get<{
    Params: { preOrderId: string };
  }>('/status/:preOrderId', async (request, reply) => {
    try {
      const { preOrderId } = request.params;

      // Get payment status from database
      const payments = await db.payment.findMany({
        where: { preorderId: preOrderId },
        orderBy: { createdAt: 'desc' }
      });

      const latestPayment = payments[0];

      return {
        success: true,
        data: {
          preOrderId,
          hasPaidPayment: payments.length > 0,
          latestPayment: latestPayment ? {
            id: latestPayment.id,
            amount: latestPayment.amount,
            status: latestPayment.status,
            stripePaymentIntentId: latestPayment.stripePaymentIntentId,
            createdAt: latestPayment.createdAt
          } : null,
          totalPaid: payments
            .filter((p: any) => p.status === 'CAPTURED')
            .reduce((sum: number, p: any) => sum + p.amount, 0)
        }
      };

    } catch (error) {
      console.error('Get payment status failed:', error);
      return reply.code(500).send({
        error: 'Failed to get payment status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}