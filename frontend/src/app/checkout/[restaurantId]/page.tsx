'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import PreOrderCheckoutForm from '@/components/PreOrderCheckoutForm';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = use(params);
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [reservationDate, setReservationDate] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [step, setStep] = useState<'details' | 'payment'>('details');

  useEffect(() => {
    if (items.length === 0) {
      router.push(`/order/${restaurantId}`);
      return;
    }

    fetchRestaurant();
  }, [restaurantId]);

  const fetchRestaurant = async () => {
    try {
      const res = await fetch(
        `http://localhost:3001/api/v1/restaurants/${restaurantId}`
      );
      const data = await res.json();

      if (data.success) {
        setRestaurant(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch restaurant:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!guestName || !guestEmail || !reservationDate || !reservationTime) {
      alert('Please fill in all required fields');
      return;
    }

    // Create payment intent
    try {
      const response = await fetch(
        'http://localhost:3001/api/v1/payments/create-intent',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount: totalPrice,
            currency: 'usd',
            metadata: {
              restaurantId,
              guestName,
              guestEmail,
            },
          }),
        }
      );

      const data = await response.json();

      if (data.success && data.data.clientSecret) {
        setClientSecret(data.data.clientSecret);
        setStep('payment');
      } else {
        alert('Failed to initialize payment');
      }
    } catch (error) {
      console.error('Payment intent creation failed:', error);
      alert('Failed to initialize payment');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600">Restaurant not found</p>
      </div>
    );
  }

  // Generate time slots (6pm - 10pm in 30min intervals)
  const timeSlots = [];
  for (let hour = 18; hour <= 22; hour++) {
    for (let min of [0, 30]) {
      if (hour === 22 && min === 30) break;
      const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
      timeSlots.push(time);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold text-gray-900">
            Checkout - {restaurant.name}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Order Summary
              </h2>

              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div
                    key={`${item.menuItemId}-${JSON.stringify(item.modifiers)}`}
                    className="flex justify-between text-sm"
                  >
                    <div className="flex-1">
                      <span className="font-medium">{item.quantity}x</span>{' '}
                      {item.name}
                      {item.modifiers.length > 0 && (
                        <div className="text-xs text-gray-500">
                          {item.modifiers.join(', ')}
                        </div>
                      )}
                    </div>
                    <span className="font-semibold ml-2">
                      ${((item.price * item.quantity) / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-green-600">
                    ${(totalPrice / 100).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Checkout Form */}
          <div className="lg:col-span-2">
            {step === 'details' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Reservation Details
                </h2>

                <form onSubmit={handleDetailsSubmit} className="space-y-6">
                  {/* Guest Information */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-4">
                      Guest Information
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="John Doe"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Email *
                        </label>
                        <input
                          type="email"
                          required
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="john@example.com"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Phone
                        </label>
                        <input
                          type="tel"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="(555) 123-4567"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Reservation Details */}
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-4">
                      Reservation Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Date *
                        </label>
                        <input
                          type="date"
                          required
                          value={reservationDate}
                          onChange={(e) => setReservationDate(e.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Time *
                        </label>
                        <select
                          required
                          value={reservationTime}
                          onChange={(e) => setReservationTime(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select time</option>
                          {timeSlots.map((time) => (
                            <option key={time} value={time}>
                              {time}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Party Size *
                        </label>
                        <select
                          required
                          value={partySize}
                          onChange={(e) => setPartySize(parseInt(e.target.value))}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                            <option key={size} value={size}>
                              {size} {size === 1 ? 'guest' : 'guests'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
                  >
                    Continue to Payment
                  </button>
                </form>
              </div>
            )}

            {step === 'payment' && clientSecret && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                  Payment
                </h2>

                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PreOrderCheckoutForm
                    restaurantId={restaurantId}
                    guestName={guestName}
                    guestEmail={guestEmail}
                    guestPhone={guestPhone}
                    partySize={partySize}
                    reservationDate={reservationDate}
                    reservationTime={reservationTime}
                    orderItems={items}
                    totalAmount={totalPrice}
                    onSuccess={(reservationId) => {
                      clearCart();
                      router.push(`/confirmation/${reservationId}`);
                    }}
                  />
                </Elements>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
