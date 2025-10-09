'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../../lib/api';
import Link from 'next/link';

export default function ReservationConfirmationPage() {
  const params = useParams();
  const reservationId = params.id as string;
  const restaurantSlug = params.slug as string;

  // Fetch reservation details
  const { data: reservationData, isLoading, error } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: () => api.getReservation(reservationId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-amber-800">Loading reservation...</p>
        </div>
      </div>
    );
  }

  if (error || !reservationData?.data || !reservationData.data.restaurant || !reservationData.data.user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Reservation not found</h2>
          <p className="text-gray-600 mb-4">
            The reservation you&apos;re looking for could not be found.
          </p>
          <Link href="/" className="text-amber-600 hover:text-amber-700">← Back to restaurants</Link>
        </div>
      </div>
    );
  }

  const reservation = reservationData.data;
  const restaurant = reservation.restaurant!; // Safe because we checked above
  const user = reservation.user!; // Safe because we checked above
  const reservationDate = new Date(reservation.startAt);
  const confirmationCode = reservation.confirmationCode || reservation.id.slice(-8).toUpperCase();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Reservation Confirmed!</h1>
          <p className="text-lg text-gray-600">
            Your table has been reserved at {restaurant.name}
          </p>
        </div>

        {/* Reservation Details Card */}
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-amber-600 text-white p-6">
            <h2 className="text-xl font-semibold mb-2">Reservation Details</h2>
            <p className="text-amber-100">Confirmation Code: <span className="font-mono font-bold">{confirmationCode}</span></p>
          </div>

          <div className="p-6 space-y-6">
            {/* Guest Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Guest Information</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-medium">{user.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{user.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium">{user.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Party Size</p>
                  <p className="font-medium">{reservation.partySize} {reservation.partySize === 1 ? 'person' : 'people'}</p>
                </div>
              </div>
            </div>

            {/* Date & Time */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Date & Time</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-medium text-lg">
                      {reservationDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Time</p>
                    <p className="font-medium text-lg">
                      {reservationDate.toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Restaurant Information */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Restaurant</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-lg mb-2">{restaurant.name}</h4>
                {/* Note: Restaurant address would come from restaurant data if needed */}
                <p className="text-gray-600 text-sm">
                  Timezone: {restaurant.timezone}
                </p>
              </div>
            </div>

            {/* QR Code Section */}
            {reservation.qrUrl && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Quick Check-in</h3>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-amber-800 text-sm mb-3">
                    Save this QR code for quick check-in when you arrive at the restaurant.
                  </p>
                  <div className="text-center">
                    <div className="inline-block bg-white p-4 rounded-lg shadow-sm">
                      <div className="w-32 h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                        <span className="text-gray-500 text-xs text-center">QR Code<br/>(Would be generated here)</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      <a href={reservation.qrUrl} className="text-amber-600 hover:text-amber-700">
                        {reservation.qrUrl}
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">What&apos;s Next?</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium">Pre-order your meal (optional)</p>
                    <p className="text-sm text-gray-600">Browse the menu and place your order ahead of time for faster service.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <p className="font-medium">Arrive at the restaurant</p>
                    <p className="text-sm text-gray-600">Please arrive on time for your reservation. Late arrivals may result in table reassignment.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium">Check in</p>
                    <p className="text-sm text-gray-600">Use the QR code above or provide your confirmation code to the host.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 px-6 py-4 flex gap-3">
            <Link
              href={`/restaurant/${restaurantSlug}/menu?reservationId=${reservationId}`}
              className="flex-1 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors text-center font-medium"
            >
              🍽️ Pre-order Menu →
            </Link>
            <Link
              href="/"
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-center font-medium"
            >
              Book Another Restaurant
            </Link>
          </div>
        </div>

        {/* Additional Information */}
        <div className="max-w-2xl mx-auto mt-8 text-center">
          <p className="text-sm text-gray-600">
            Need to modify or cancel your reservation? Contact the restaurant directly or manage your reservation through your email confirmation.
          </p>
        </div>
      </div>
    </div>
  );
}
