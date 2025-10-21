'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Reservation {
  id: string;
  startAt: string;
  partySize: number;
  status: string;
  checkInToken: string | null;
  restaurant: {
    name: string;
    slug: string;
  };
  user: {
    name: string;
    email: string;
  };
  preOrder: {
    id: string;
    total: number;
    items: Array<{
      quantity: number;
      menuItem: {
        name: string;
      };
      modifiers: string[];
    }>;
  } | null;
}

export default function ConfirmationPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = use(params);
  const router = useRouter();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);

  useEffect(() => {
    fetchReservation();
  }, [reservationId]);

  const fetchReservation = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/v1/reservations/${reservationId}`
      );
      const data = await response.json();

      if (data.success && data.data) {
        setReservation(data.data);

        // Generate QR code if we have a check-in token
        if (data.data.checkInToken) {
          const qrRes = await fetch(
            `http://localhost:3001/api/v1/checkin/qr/${reservationId}`
          );
          const qrData = await qrRes.json();

          if (qrData.success && qrData.data.qrCodeDataUrl) {
            setQrCodeUrl(qrData.data.qrCodeDataUrl);
          }
        }

        setError(null);
      } else {
        setError('Reservation not found');
      }
    } catch (err) {
      setError('Failed to load reservation');
      console.error('Confirmation fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading confirmation...</p>
        </div>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error || 'Reservation not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const reservationDate = new Date(reservation.startAt);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Header */}
      <div className="bg-green-600 text-white text-center py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-6xl mb-4">✓</div>
          <h1 className="text-3xl font-bold mb-2">Reservation Confirmed!</h1>
          <p className="text-green-100">
            Your table is reserved and your meal is pre-ordered
          </p>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Reservation Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Restaurant & Time */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Reservation Details
              </h2>

              <div className="space-y-3">
                <div className="flex justify-between border-b pb-3">
                  <span className="text-gray-600">Restaurant</span>
                  <span className="font-semibold">{reservation.restaurant.name}</span>
                </div>

                <div className="flex justify-between border-b pb-3">
                  <span className="text-gray-600">Date & Time</span>
                  <span className="font-semibold">
                    {reservationDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}{' '}
                    at{' '}
                    {reservationDate.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="flex justify-between border-b pb-3">
                  <span className="text-gray-600">Party Size</span>
                  <span className="font-semibold">
                    {reservation.partySize}{' '}
                    {reservation.partySize === 1 ? 'guest' : 'guests'}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Guest</span>
                  <div className="text-right">
                    <div className="font-semibold">{reservation.user.name}</div>
                    <div className="text-sm text-gray-500">{reservation.user.email}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pre-Order Summary */}
            {reservation.preOrder && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Your Pre-Order
                </h2>

                <div className="space-y-3 mb-4">
                  {reservation.preOrder.items.map((item, index) => (
                    <div key={index} className="flex justify-between">
                      <div className="flex-1">
                        <span className="font-medium">
                          {item.quantity}x {item.menuItem.name}
                        </span>
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="text-sm text-gray-500">
                            {item.modifiers.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Paid</span>
                    <span className="text-green-600">
                      ${(reservation.preOrder.total / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* What's Next */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">
                What happens next?
              </h3>
              <ol className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start">
                  <span className="font-bold mr-2">1.</span>
                  <span>
                    You'll receive a confirmation email with your QR code
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2">2.</span>
                  <span>
                    When you arrive, scan the QR code at the host stand
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2">3.</span>
                  <span>
                    Your order will be sent to the kitchen immediately
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="font-bold mr-2">4.</span>
                  <span>
                    Your food will arrive within 5 minutes of being seated!
                  </span>
                </li>
              </ol>
            </div>
          </div>

          {/* QR Code Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 text-center">
                Check-In QR Code
              </h2>

              {qrCodeUrl ? (
                <div className="text-center">
                  <div className="bg-gray-100 p-4 rounded-lg mb-4">
                    <img
                      src={qrCodeUrl}
                      alt="Check-in QR Code"
                      className="w-full max-w-xs mx-auto"
                    />
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Show this QR code when you arrive at the restaurant
                  </p>

                  <a
                    href={qrCodeUrl}
                    download={`lacarta-reservation-${reservationId}.png`}
                    className="block w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium mb-2"
                  >
                    Download QR Code
                  </a>

                  <button
                    onClick={() => window.print()}
                    className="block w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 font-medium"
                  >
                    Print QR Code
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-500">Generating QR code...</p>
                </div>
              )}

              <div className="mt-6 text-xs text-gray-500 text-center">
                Reservation #{reservationId.slice(0, 8)}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
