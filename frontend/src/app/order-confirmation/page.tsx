'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, MapPin, Clock, Receipt, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeCanvas } from 'qrcode.react';

interface ConfirmationData {
  confirmationNumber: string;
  preOrderId: string;
  reservationId?: string;
  restaurant: {
    name: string;
    address: string;
  };
  reservation?: {
    date: string;
    time: string;
    partySize: number;
  };
  payment: {
    amount: number;
    breakdown: {
      subtotal: number;
      tax: number;
      tip: number;
      total: number;
    };
  };
}

export default function OrderConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [confirmationData, setConfirmationData] = useState<ConfirmationData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real app, we'd fetch confirmation details from the API
    // For now, we'll use URL params from Stripe redirect
    const paymentIntent = searchParams.get('payment_intent');
    const paymentIntentClientSecret = searchParams.get('payment_intent_client_secret');
    const redirectStatus = searchParams.get('redirect_status');

    if (redirectStatus === 'succeeded') {
      // Mock confirmation data - in production, fetch from API
      const mockData: ConfirmationData = {
        confirmationNumber: `LC${Date.now().toString(36).toUpperCase()}`,
        preOrderId: searchParams.get('preOrderId') || 'temp-order',
        reservationId: searchParams.get('reservationId') || undefined,
        restaurant: {
          name: 'Le Bernardin',
          address: '155 West 51st Street, New York, NY 10019',
        },
        reservation: {
          date: new Date().toISOString(),
          time: '7:00 PM',
          partySize: 2,
        },
        payment: {
          amount: 25000, // $250.00
          breakdown: {
            subtotal: 20000,
            tax: 1750,
            tip: 3250,
            total: 25000,
          },
        },
      };
      setConfirmationData(mockData);
    }
    setLoading(false);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="w-16 h-16 bg-gray-200 rounded-full" />
        </div>
      </div>
    );
  }

  if (!confirmationData) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto text-center py-12">
          <p className="text-gray-600 mb-4">No confirmation data found</p>
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-700"
          >
            Return to home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-2xl mx-auto p-4 py-8">
        {/* Success Animation */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Order Confirmed!
          </h1>
          <p className="text-gray-600">
            Your pre-order has been successfully placed
          </p>
        </div>

        {/* Confirmation Number */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-1">Confirmation Number</p>
            <p className="text-2xl font-mono font-bold text-gray-900">
              {confirmationData.confirmationNumber}
            </p>
          </div>
        </div>

        {/* Restaurant Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Restaurant Details</h3>
          <div className="space-y-3">
            <div className="flex items-start">
              <MapPin className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
              <div>
                <p className="font-medium">{confirmationData.restaurant.name}</p>
                <p className="text-sm text-gray-600">
                  {confirmationData.restaurant.address}
                </p>
              </div>
            </div>
            {confirmationData.reservation && (
              <div className="flex items-start">
                <Clock className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                <div>
                  <p className="font-medium">
                    {format(new Date(confirmationData.reservation.date), 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="text-sm text-gray-600">
                    {confirmationData.reservation.time} • Party of {confirmationData.reservation.partySize}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-4 flex items-center">
            <Receipt className="w-5 h-5 mr-2" />
            Payment Summary
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>${(confirmationData.payment.breakdown.subtotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <span>${(confirmationData.payment.breakdown.tax / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tip</span>
              <span>${(confirmationData.payment.breakdown.tip / 100).toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 mt-2 font-semibold text-base">
              <div className="flex justify-between">
                <span>Total Paid</span>
                <span className="text-green-600">
                  ${(confirmationData.payment.breakdown.total / 100).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* QR Code for Check-in */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="font-semibold text-lg mb-4">Check-in QR Code</h3>
          <p className="text-sm text-gray-600 mb-4">
            Show this code at the restaurant for express check-in
          </p>
          <div className="flex justify-center">
            <QRCodeCanvas
              value={JSON.stringify({
                type: 'CHECK_IN',
                confirmationNumber: confirmationData.confirmationNumber,
                preOrderId: confirmationData.preOrderId,
                reservationId: confirmationData.reservationId,
              })}
              size={200}
              level="H"
              includeMargin
            />
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-blue-50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">What's Next?</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start">
              <ChevronRight className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>We've sent a confirmation email with your order details</span>
            </li>
            <li className="flex items-start">
              <ChevronRight className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>Your food will start being prepared when you check in at the restaurant</span>
            </li>
            <li className="flex items-start">
              <ChevronRight className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>Show your QR code to the host for express seating</span>
            </li>
            <li className="flex items-start">
              <ChevronRight className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>Your meal will be ready within 5 minutes of being seated</span>
            </li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => router.push('/reservations')}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            View My Reservations
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-white text-gray-700 py-3 px-4 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}