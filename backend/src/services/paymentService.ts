import Stripe from 'stripe';
import { db } from '../lib/db';

// Initialize Stripe with test keys for development
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_51234...', {
  apiVersion: '2025-08-27.basil'
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

    // Calculate final amount with tip
    const finalAmount = preOrder.total + tipAmount;

    if (!preOrder.reservation.user) {
      throw new Error('User not found for reservation');
    }

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

      // Create payment record
      const payment = await db.payment.create({
        data: {
          preorderId: preOrderId,
          stripePaymentIntentId: paymentIntentId,
          amount: paymentIntent.amount,
          status: 'CAPTURED',
          capturedAt: new Date()
        }
      });

      // Update pre-order status
      const preOrder = await db.preOrder.update({
        where: { id: preOrderId },
        data: { 
          status: 'AUTHORIZED',
          // Update tip if it was included in payment
          tip: paymentIntent.amount - (paymentIntent.metadata.originalAmount ? 
            parseInt(paymentIntent.metadata.originalAmount) : paymentIntent.amount)
        },
        include: {
          items: true,
          payments: true,
          reservation: {
            include: {
              user: true,
              restaurant: true
            }
          }
        }
      });

      // Create kitchen ticket
      await this.createKitchenTicket(preOrderId);

      return {
        success: true,
        preOrder
      };

    } catch (error) {
      console.error('Payment confirmation error:', error);
      return {
        success: false,
        error: 'Failed to process payment confirmation'
      };
    }
  }

  private async createKitchenTicket(preOrderId: string): Promise<void> {
    const preOrder = await db.preOrder.findUnique({
      where: { id: preOrderId },
      include: {
        items: true,
        reservation: true
      }
    });

    if (!preOrder) {
      throw new Error('Pre-order not found');
    }

    // Calculate estimated prep time (sum of all item prep times)
    const totalPrepTime = preOrder.items.reduce((total, item) => {
      // This would normally come from the menu item data
      const estimatedPrepTime = 10; // minutes per item as default
      return total + (estimatedPrepTime * item.quantity);
    }, 0);

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

  async handleWebhook(body: any, signature: string): Promise<void> {
    // Stripe webhook handling for payment events
    let event;

    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_123...'
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      throw new Error('Invalid webhook signature');
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        await this.confirmPayment(paymentIntent.id);
        break;
      
      case 'payment_intent.payment_failed':
        // Handle failed payment
        console.log('Payment failed:', event.data.object);
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  }
}

export const paymentService = new PaymentService();
