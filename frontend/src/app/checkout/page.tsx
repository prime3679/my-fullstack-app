'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useCartStore } from '@/store/cartStore';
import { ShoppingCart, CreditCard, Loader2, ChevronLeft } from 'lucide-react';
import { format } from 'date-fns';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items, getSubtotal, getTax, getTotal, clearCart } = useCartStore();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tipPercent, setTipPercent] = useState(18);

  const preOrderId = searchParams.get('preOrderId');
  const reservationId = searchParams.get('reservationId');

  const subtotal = getSubtotal();
  const tax = getTax();
  const tip = Math.round(subtotal * (tipPercent / 100));
  const total = getTotal() + tip;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation`,
      },
    });

    if (error) {
      setErrorMessage(error.message || 'An error occurred during payment.');
      setIsProcessing(false);
    } else {
      // Payment succeeded, Stripe will redirect to return_url
      clearCart();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-lg mb-4">Payment Details</h3>
        <PaymentElement 
          options={{
            layout: 'tabs',
            wallets: {
              applePay: 'auto',
              googlePay: 'auto',
            },
          }}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-lg mb-4">Add Tip</h3>
        <div className="grid grid-cols-4 gap-2">
          {[15, 18, 20, 25].map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => setTipPercent(percent)}
              className={`py-2 px-4 rounded-lg border transition-colors ${
                tipPercent === percent
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {percent}%
            </button>
          ))}
        </div>
        <div className="mt-3 text-sm text-gray-600">
          Tip amount: ${(tip / 100).toFixed(2)}
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="font-semibold text-lg mb-4">Order Summary</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${(subtotal / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tax</span>
            <span>${(tax / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Tip ({tipPercent}%)</span>
            <span>${(tip / 100).toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 mt-2 font-semibold text-base">
            <div className="flex justify-between">
              <span>Total</span>
              <span>${(total / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || !elements || isProcessing || items.length === 0}
        className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <CreditCard className="w-5 h-5 mr-2" />
            Pay ${(total / 100).toFixed(2)}
          </>
        )}
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { items, restaurantId } = useCartStore();
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const preOrderId = searchParams.get('preOrderId');

  useEffect(() => {
    if (items.length === 0) {
      router.push('/');
      return;
    }

    // Create payment intent
    const createPaymentIntent = async () => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/payments/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            preOrderId: preOrderId || `temp-${Date.now()}`,
            tipPercent: 18,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to create payment intent');
        }

        const data = await response.json();
        setClientSecret(data.data.clientSecret);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize payment');
      } finally {
        setLoading(false);
      }
    };

    createPaymentIntent();
  }, [items, preOrderId, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg">
            {error}
          </div>
          <button
            onClick={() => router.back()}
            className="mt-4 text-blue-600 hover:text-blue-700 flex items-center"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 text-gray-600 hover:text-gray-700 flex items-center"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to menu
        </button>

        <h1 className="text-3xl font-bold mb-8">Complete Your Order</h1>

        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-lg mb-4 flex items-center">
              <ShoppingCart className="w-5 h-5 mr-2" />
              Order Items ({items.length})
            </h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={`${item.sku}-${item.modifiers?.join(',')}`} className="flex justify-between text-sm">
                  <div>
                    <span className="font-medium">{item.quantity}x</span> {item.name}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        {item.modifiers.join(', ')}
                      </div>
                    )}
                  </div>
                  <span>${((item.price * item.quantity) / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {clientSecret && (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: 'stripe',
                variables: {
                  colorPrimary: '#2563eb',
                },
              },
            }}
          >
            <CheckoutForm />
          </Elements>
        )}
      </div>
    </div>
  );
}