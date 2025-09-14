'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../../../../../../lib/stripe';
import { api } from '../../../../../../lib/api';
import Link from 'next/link';
import { CheckoutForm } from '../../../../../../components/CheckoutForm';

export default function PreOrderPaymentPage() {
  const params = useParams();
  const router = useRouter();
  const preOrderId = params.id as string;
  const restaurantSlug = params.slug as string;

  const [clientSecret, setClientSecret] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

  // Fetch pre-order details
  const { data: preOrderData, isLoading, error } = useQuery({
    queryKey: ['preorder', preOrderId],
    queryFn: () => api.getPreOrder(preOrderId),
  });

  const preOrder = preOrderData?.data;

  // Create payment intent when component mounts or tip changes
  useEffect(() => {
    if (preOrder && !clientSecret) {
      createPaymentIntent();
    }
  }, [preOrder, tipAmount]);

  const createPaymentIntent = async () => {
    if (isCreatingPayment) return;
    
    setIsCreatingPayment(true);
    try {
      const response = await fetch(`/api/v1/payments/payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preOrderId: preOrder.id,
          tipAmount: tipAmount
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create payment intent');
      }

      const data = await response.json();
      setClientSecret(data.data.clientSecret);
      setPaymentIntentId(data.data.paymentIntentId);
    } catch (error) {
      console.error('Error creating payment intent:', error);
    } finally {
      setIsCreatingPayment(false);
    }
  };

  const handleTipChange = (amount: number) => {
    setTipAmount(amount);
    setClientSecret(''); // Reset client secret to trigger new payment intent
  };

  const onPaymentSuccess = () => {
    router.push(`/restaurant/${restaurantSlug}/preorder/${preOrderId}/confirmation`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-amber-800">Loading payment...</p>
        </div>
      </div>
    );
  }

  if (error || !preOrder) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Order not found</h2>
          <p className="text-gray-600 mb-4">
            The pre-order you're trying to pay for could not be found.
          </p>
          <Link href="/" className="text-amber-600 hover:text-amber-700">← Back to restaurants</Link>
        </div>
      </div>
    );
  }

  const subtotal = preOrder.subtotal / 100;
  const tax = preOrder.tax / 100;
  const tip = tipAmount / 100;
  const total = subtotal + tax + tip;

  const tipOptions = [
    { label: 'No tip', value: 0 },
    { label: '15%', value: Math.round(subtotal * 0.15 * 100) },
    { label: '18%', value: Math.round(subtotal * 0.18 * 100) },
    { label: '20%', value: Math.round(subtotal * 0.20 * 100) },
    { label: '25%', value: Math.round(subtotal * 0.25 * 100) },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Payment</h1>
          <p className="text-lg text-gray-600">
            Pre-pay for your meal at {preOrder.reservation.restaurant.name}
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Order Summary */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Order Summary</h2>
              
              {/* Items */}
              <div className="space-y-3 mb-6">
                {preOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-medium">${(item.price / 100).toFixed(2)}</p>
                  </div>
                ))}
              </div>

              {/* Tip Selection */}
              <div className="border-t border-gray-200 pt-4 mb-4">
                <h3 className="font-medium text-gray-900 mb-3">Add Tip</h3>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {tipOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleTipChange(option.value)}
                      className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                        tipAmount === option.value
                          ? 'bg-amber-600 text-white border-amber-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-amber-600'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                
                {/* Custom tip input */}
                <div className="flex items-center space-x-2">
                  <label htmlFor="custom-tip" className="text-sm text-gray-600">Custom:</label>
                  <div className="flex items-center">
                    <span className="text-gray-600">$</span>
                    <input
                      type="number"
                      id="custom-tip"
                      min="0"
                      step="0.01"
                      value={tip.toFixed(2)}
                      onChange={(e) => handleTipChange(Math.round(parseFloat(e.target.value || '0') * 100))}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 rounded ml-1"
                    />
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className="border-t border-gray-200 pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                {tip > 0 && (
                  <div className="flex justify-between">
                    <span>Tip</span>
                    <span>${tip.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-300 pt-2 font-semibold">
                  <div className="flex justify-between text-lg">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Form */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Details</h2>
              
              {clientSecret && (
                <Elements stripe={stripePromise} options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#d97706',
                    },
                  },
                }}>
                  <CheckoutForm
                    paymentIntentId={paymentIntentId}
                    onSuccess={onPaymentSuccess}
                    amount={Math.round(total * 100)}
                  />
                </Elements>
              )}

              {!clientSecret && !isCreatingPayment && (
                <div className="text-center py-8">
                  <button
                    onClick={createPaymentIntent}
                    className="bg-amber-600 text-white px-6 py-2 rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Initialize Payment
                  </button>
                </div>
              )}

              {isCreatingPayment && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-2"></div>
                  <p className="text-gray-600">Setting up payment...</p>
                </div>
              )}
            </div>
          </div>

          {/* Security Notice */}
          <div className="text-center mt-8 text-sm text-gray-600">
            <p>🔒 Your payment information is secure and encrypted by Stripe</p>
          </div>
        </div>
      </div>
    </div>
  );
}