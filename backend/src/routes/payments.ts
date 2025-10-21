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
  // IMPORTANT: Stripe requires raw body for signature verification
  fastify.post('/webhook', {
    // Custom body parser to preserve raw body for signature verification
    bodyLimit: 1048576, // 1mb
  }, async (request, reply) => {
    try {
      const signature = request.headers['stripe-signature'] as string;

      if (!signature) {
        console.error('Webhook failed: Missing stripe-signature header');
        return reply.code(400).send({ error: 'Missing stripe-signature header' });
      }

      // For signature verification, we need the raw body
      // If body is already parsed, stringify it back
      // In production, you'd want to use rawBody plugin or custom parser
      let rawBody: string | Buffer;

      if (Buffer.isBuffer(request.body)) {
        rawBody = request.body;
      } else if (typeof request.body === 'string') {
        rawBody = request.body;
      } else {
        // Fallback: convert parsed object back to string
        // Note: This may not match the original payload exactly
        rawBody = JSON.stringify(request.body);
      }

      // Verify signature and process webhook
      await paymentService.handleWebhook(rawBody, signature);

      console.log('Webhook processed successfully');
      return reply.code(200).send({ received: true });

    } catch (error) {
      console.error('Webhook processing error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        headers: request.headers
      });

      // Return 400 for signature verification failures
      if (error instanceof Error && error.message.includes('signature')) {
        return reply.code(400).send({
          error: 'Webhook signature verification failed'
        });
      }

      // Return 500 for other processing errors (Stripe will retry)
      return reply.code(500).send({
        error: 'Webhook processing failed',
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