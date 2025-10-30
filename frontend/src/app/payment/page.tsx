'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useQuery } from '@tanstack/react-query';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

interface PreOrder {
  id: string;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  status: string;
  reservation: {
    id: string;
    startAt: string;
    partySize: number;
    user: {
      name: string;
      email: string;
    };
    restaurant: {
      name: string;
    };
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

function CheckoutForm({ preOrderId }: { preOrderId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tipPercent, setTipPercent] = useState(18);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  // Fetch pre-order details
  const { data: preOrder, isLoading: loadingPreOrder } = useQuery<PreOrder>({
    queryKey: ['preorder', preOrderId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/preorders/${preOrderId}`);
      if (!response.ok) throw new Error('Failed to fetch pre-order');
      const data = await response.json();
      return data.data;
    },
  });

  // Create payment intent when component mounts
  useEffect(() => {
    if (preOrderId && !clientSecret) {
      createPaymentIntent();
    }
  }, [preOrderId, tipPercent]);

  const createPaymentIntent = async () => {
    try {
      const response = await fetch('/api/v1/payments/create-payment-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preOrderId,
          tipPercent,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();
      setClientSecret(data.data.clientSecret);
    } catch (error) {
      console.error('Payment intent error:', error);
      setErrorMessage('Failed to initialize payment. Please try again.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    // Confirm the payment
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payment/success?preOrderId=${preOrderId}`,
      },
      redirect: 'if_required',
    });

    if (error) {
      setErrorMessage(error.message || 'Payment failed. Please try again.');
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      // Payment successful
      router.push(`/payment/success?preOrderId=${preOrderId}&paymentIntentId=${paymentIntent.id}`);
    } else {
      setErrorMessage('Payment processing failed. Please try again.');
      setIsProcessing(false);
    }
  };

  if (loadingPreOrder || !preOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  const subtotal = preOrder.subtotal / 100;
  const tax = preOrder.tax / 100;
  const calculatedTip = subtotal * (tipPercent / 100);
  const total = subtotal + tax + calculatedTip;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6">
            <h1 className="text-3xl font-bold text-white">Complete Your Payment</h1>
            <p className="text-amber-50 mt-2">
              Secure payment for your pre-order at {preOrder.reservation.restaurant.name}
            </p>
          </div>

          <div className="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {/* Order Summary */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
                
                <div className="space-y-3 mb-6">
                  {preOrder.items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.quantity}x {item.name}
                      </span>
                      <span className="font-medium">${(item.price * item.quantity / 100).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="font-medium">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">${tax.toFixed(2)}</span>
                  </div>
                  
                  {/* Tip Selection */}
                  <div className="pt-3 pb-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Add Tip
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {[15, 18, 20, 25].map((percent) => (
                        <button
                          key={percent}
                          type="button"
                          onClick={() => setTipPercent(percent)}
                          className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                            tipPercent === percent
                              ? 'bg-amber-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {percent}%
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-gray-600">Tip ({tipPercent}%)</span>
                      <span className="font-medium">${calculatedTip.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <div className="flex justify-between text-lg font-semibold">
                      <span>Total</span>
                      <span className="text-amber-600">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Reservation Details */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2">Reservation Details</h3>
                  <div className="text-sm text-blue-700 space-y-1">
                    <div>Guest: {preOrder.reservation.user.name}</div>
                    <div>Party of {preOrder.reservation.partySize}</div>
                    <div>
                      {new Date(preOrder.reservation.startAt).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Form */}
              <div>
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Information</h2>
                
                {clientSecret ? (
                  <form onSubmit={handleSubmit}>
                    <PaymentElement 
                      options={{
                        layout: 'tabs',
                      }}
                    />
                    
                    {errorMessage && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-600">{errorMessage}</p>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={!stripe || isProcessing}
                      className={`mt-6 w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
                        isProcessing
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-amber-600 hover:bg-amber-700'
                      }`}
                    >
                      {isProcessing ? (
                        <span className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Processing...
                        </span>
                      ) : (
                        `Pay $${total.toFixed(2)}`
                      )}
                    </button>

                    <div className="mt-4 flex items-center justify-center space-x-2 text-xs text-gray-500">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <span>Secure payment powered by Stripe</span>
                    </div>
                  </form>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Initializing payment...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PaymentPage() {
  const searchParams = useSearchParams();
  const preOrderId = searchParams.get('preOrderId');

  if (!preOrderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Invalid Payment Link</h1>
          <p className="text-gray-600 mt-2">Please use a valid payment link from your pre-order.</p>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm preOrderId={preOrderId} />
    </Elements>
  );
}