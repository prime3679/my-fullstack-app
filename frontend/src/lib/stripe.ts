import { loadStripe } from '@stripe/stripe-js';

const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_51234...';

// Initialize Stripe
export const stripePromise = loadStripe(stripePublishableKey);