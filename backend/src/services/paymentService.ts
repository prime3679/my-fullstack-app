import Stripe from 'stripe';
import { db } from '../lib/db';

// Initialize Stripe with test keys for development
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51234...', {
  apiVersion: '2024-11-20.acacia'
});

export class PaymentService {

  async createPaymentIntent(preOrderId: string, tipAmount: number = 0): Promise<{
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
  }> {
    // Get the pre-order details
    const preOrder = await db.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        reservation: {
          include: {
            user: true,
            restaurant: true
          }
        }
      }
    });

    if (!preOrder) {
      throw new Error('Pre-order not found');
    }

    if (!preOrder.reservation.user) {
      throw new Error('Reservation must have an associated user for payment');
    }

    // Calculate final amount with tip
    const finalAmount = preOrder.total + tipAmount;

    // Create Stripe customer if doesn't exist
    let customerId = preOrder.reservation.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: preOrder.reservation.user.email,
        name: preOrder.reservation.user.name,
        metadata: {
          userId: preOrder.reservation.user.id
        }
      });

      // Update user with Stripe customer ID
      await db.user.update({
        where: { id: preOrder.reservation.user.id },
        data: { stripeCustomerId: customer.id }
      });

      customerId = customer.id;
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount, // Amount in cents
      currency: preOrder.currency.toLowerCase(),
      customer: customerId,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        preOrderId: preOrder.id,
        reservationId: preOrder.reservationId,
        restaurantId: preOrder.reservation.restaurantId,
        userId: preOrder.reservation.userId
      }
    });

    return {
      clientSecret: paymentIntent.client_secret!,
      paymentIntentId: paymentIntent.id,
      amount: finalAmount
    };
  }

  async confirmPayment(paymentIntentId: string): Promise<{
    success: boolean;
    preOrder?: any;
    error?: string;
  }> {
    try {
      // Retrieve the payment intent from Stripe
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      if (paymentIntent.status !== 'succeeded') {
        return {
          success: false,
          error: 'Payment not completed'
        };
      }

      const preOrderId = paymentIntent.metadata.preOrderId;
      if (!preOrderId) {
        return {
          success: false,
          error: 'Pre-order ID not found'
        };
      }

      // Check if payment record already exists (idempotency)
      const existingPayment = await db.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntentId }
      });

      if (existingPayment) {
        // Payment already processed, return existing pre-order
        const preOrder = await db.preOrder.findUnique({
          where: { id: preOrderId },
          include: {
            items: true,
            payments: true,
            reservation: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                },
                restaurant: true
              }
            }
          }
        });

        return {
          success: true,
          preOrder
        };
      }

      // Get pre-order to calculate tip
      const currentPreOrder = await db.preOrder.findUnique({
        where: { id: preOrderId },
        select: { total: true, tip: true }
      });

      if (!currentPreOrder) {
        return {
          success: false,
          error: 'Pre-order not found'
        };
      }

      // Calculate tip: payment amount minus original order total
      const tipAmount = paymentIntent.amount - currentPreOrder.total;

      // Create payment record and update pre-order in a transaction
      const result = await db.$transaction(async (tx) => {
        // Create payment record
        await tx.payment.create({
          data: {
            preorderId: preOrderId,
            stripePaymentIntentId: paymentIntentId,
            amount: paymentIntent.amount,
            status: 'CAPTURED',
            capturedAt: new Date()
          }
        });

        // Update pre-order status and tip
        const updatedPreOrder = await tx.preOrder.update({
          where: { id: preOrderId },
          data: {
            status: 'AUTHORIZED',
            tip: tipAmount >= 0 ? tipAmount : 0, // Ensure non-negative tip
            total: paymentIntent.amount // Update total to include tip
          },
          include: {
            items: true,
            payments: true,
            reservation: {
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                },
                restaurant: true
              }
            }
          }
        });

        // Log event
        await tx.event.create({
          data: {
            kind: 'payment_captured',
            actorId: updatedPreOrder.reservation.userId,
            restaurantId: updatedPreOrder.reservation.restaurantId,
            reservationId: updatedPreOrder.reservationId,
            payloadJson: {
              paymentIntentId,
              amount: paymentIntent.amount,
              preOrderId
            }
          }
        });

        return updatedPreOrder;
      });

      // Create kitchen ticket (outside transaction to avoid blocking)
      try {
        await this.createKitchenTicket(preOrderId);
      } catch (error) {
        console.error('Failed to create kitchen ticket:', error);
        // Don't fail the whole payment if kitchen ticket creation fails
        // It can be created manually or via retry
      }

      return {
        success: true,
        preOrder: result
      };

    } catch (error) {
      console.error('Payment confirmation error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process payment confirmation'
      };
    }
  }

  private async createKitchenTicket(preOrderId: string): Promise<void> {
    const preOrder = await db.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        items: true,
        reservation: {
          include: {
            restaurant: true
          }
        }
      }
    });

    if (!preOrder) {
      throw new Error('Pre-order not found');
    }

    // Check if kitchen ticket already exists
    const existingTicket = await db.kitchenTicket.findUnique({
      where: { reservationId: preOrder.reservationId }
    });

    if (existingTicket) {
      // Kitchen ticket already exists, skip creation
      return;
    }

    // Calculate estimated prep time from actual menu item prep times
    let totalPrepTime = 0;
    for (const item of preOrder.items) {
      const menuItem = await db.menuItem.findUnique({
        where: {
          restaurantId_sku: {
            restaurantId: preOrder.reservation.restaurantId,
            sku: item.sku
          }
        },
        select: { prepTimeMinutes: true }
      });

      const prepTime = menuItem?.prepTimeMinutes || 10; // Default to 10 minutes if not set
      totalPrepTime += prepTime * item.quantity;
    }

    // Create kitchen ticket
    await db.kitchenTicket.create({
      data: {
        reservationId: preOrder.reservationId,
        status: 'PENDING',
        estimatedPrepMinutes: totalPrepTime,
        fireAt: preOrder.reservation.startAt,
        itemsJson: preOrder.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          modifiers: item.modifiersJson,
          notes: item.notes,
          allergens: item.allergensJson
        }))
      }
    });
  }

  async processRefund(paymentIntentId: string, amount?: number): Promise<{
    success: boolean;
    refundId?: string;
    error?: string;
  }> {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount // If not specified, refunds full amount
      });

      return {
        success: true,
        refundId: refund.id
      };

    } catch (error) {
      console.error('Refund error:', error);
      return {
        success: false,
        error: 'Failed to process refund'
      };
    }
  }

  async handleWebhook(body: string | Buffer, signature: string): Promise<void> {
    // Stripe webhook handling for payment events
    let event;

    // Validate webhook secret is configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured');
      throw new Error('Webhook secret not configured');
    }

    try {
      // Verify webhook signature using Stripe
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );

      console.log('Webhook signature verified successfully', {
        eventId: event.id,
        eventType: event.type
      });

    } catch (err) {
      console.error('Webhook signature verification failed:', {
        error: err instanceof Error ? err.message : 'Unknown error',
        signatureProvided: !!signature,
        bodyType: typeof body
      });
      throw new Error('Invalid webhook signature');
    }

    // Handle the event based on type
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          const successIntent = event.data.object;
          console.log('Processing payment_intent.succeeded', {
            paymentIntentId: successIntent.id,
            amount: successIntent.amount
          });
          await this.confirmPayment(successIntent.id);
          break;

        case 'payment_intent.payment_failed':
          const failedIntent = event.data.object;
          console.log('Processing payment_intent.payment_failed', {
            paymentIntentId: failedIntent.id,
            failureCode: failedIntent.last_payment_error?.code
          });
          await this.handleFailedPayment(failedIntent);
          break;

        case 'payment_intent.canceled':
          const canceledIntent = event.data.object;
          console.log('Processing payment_intent.canceled', {
            paymentIntentId: canceledIntent.id
          });
          // Could add specific handling for cancellations if needed
          break;

        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      console.log('Webhook event processed successfully', {
        eventId: event.id,
        eventType: event.type
      });

    } catch (processingError) {
      console.error('Error processing webhook event:', {
        eventId: event.id,
        eventType: event.type,
        error: processingError instanceof Error ? processingError.message : 'Unknown error'
      });
      // Re-throw so Stripe knows to retry
      throw processingError;
    }
  }

  private async handleFailedPayment(paymentIntent: any): Promise<void> {
    try {
      const preOrderId = paymentIntent.metadata.preOrderId;

      if (!preOrderId) {
        console.error('Failed payment missing preOrderId:', paymentIntent.id);
        return;
      }

      // Check if payment record exists
      const existingPayment = await db.payment.findUnique({
        where: { stripePaymentIntentId: paymentIntent.id }
      });

      if (existingPayment) {
        // Update existing payment to FAILED
        await db.payment.update({
          where: { id: existingPayment.id },
          data: { status: 'FAILED' }
        });
      } else {
        // Create payment record with FAILED status
        await db.payment.create({
          data: {
            preorderId: preOrderId,
            stripePaymentIntentId: paymentIntent.id,
            amount: paymentIntent.amount,
            status: 'FAILED'
          }
        });
      }

      // Log event
      const preOrder = await db.preOrder.findUnique({
        where: { id: preOrderId },
        include: { reservation: true }
      });

      if (preOrder) {
        await db.event.create({
          data: {
            kind: 'payment_failed',
            actorId: preOrder.reservation.userId,
            restaurantId: preOrder.reservation.restaurantId,
            reservationId: preOrder.reservationId,
            payloadJson: {
              paymentIntentId: paymentIntent.id,
              amount: paymentIntent.amount,
              preOrderId,
              failureCode: paymentIntent.last_payment_error?.code,
              failureMessage: paymentIntent.last_payment_error?.message
            }
          }
        });
      }

      console.log('Payment failed:', {
        paymentIntentId: paymentIntent.id,
        preOrderId,
        error: paymentIntent.last_payment_error
      });

    } catch (error) {
      console.error('Error handling failed payment:', error);
      // Don't throw - webhook should still return 200
    }
  }
}

export const paymentService = new PaymentService();