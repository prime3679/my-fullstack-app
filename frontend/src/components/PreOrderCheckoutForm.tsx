'use client';

import { useState } from 'react';
import {
  useStripe,
  useElements,
  PaymentElement,
} from '@stripe/react-stripe-js';

interface PreOrderCheckoutFormProps {
  restaurantId: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  partySize: number;
  reservationDate: string;
  reservationTime: string;
  orderItems: Array<{
    menuItemId: string;
    name: string;
    quantity: number;
    price: number;
    modifiers: string[];
    specialInstructions?: string;
  }>;
  totalAmount: number;
  onSuccess: (reservationId: string) => void;
}

export default function PreOrderCheckoutForm({
  restaurantId,
  guestName,
  guestEmail,
  guestPhone,
  partySize,
  reservationDate,
  reservationTime,
  orderItems,
  totalAmount,
  onSuccess,
}: PreOrderCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setErrorMessage(null);

    try {
      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/confirmation`,
        },
        redirect: 'if_required',
      });

      if (stripeError) {
        setErrorMessage(stripeError.message || 'Payment failed');
        setProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Create reservation and pre-order
        const reservationDateTime = new Date(`${reservationDate}T${reservationTime}:00`);

        const response = await fetch(
          'http://localhost:3001/api/v1/reservations/create-with-order',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              restaurantId,
              guestName,
              guestEmail,
              guestPhone,
              partySize,
              startAt: reservationDateTime.toISOString(),
              orderItems: orderItems.map((item) => ({
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                modifiers: item.modifiers,
                specialInstructions: item.specialInstructions,
              })),
              paymentIntentId: paymentIntent.id,
              totalAmount,
            }),
          }
        );

        const data = await response.json();

        if (data.success && data.data.reservation) {
          onSuccess(data.data.reservation.id);
        } else {
          setErrorMessage(data.error || 'Failed to create reservation');
          setProcessing(false);
        }
      }
    } catch (error) {
      console.error('Payment error:', error);
      setErrorMessage('An unexpected error occurred');
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {errorMessage}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded">
        <p className="text-sm text-blue-800">
          <strong>Amount to pay:</strong> ${(totalAmount / 100).toFixed(2)}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          Your payment is secure and encrypted
        </p>
      </div>

      <button
        type="submit"
        disabled={!stripe || processing}
        className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {processing ? 'Processing...' : `Pay $${(totalAmount / 100).toFixed(2)}`}
      </button>

      <p className="text-xs text-gray-500 text-center">
        By completing this reservation, you agree to our terms of service
      </p>
    </form>
  );
}
