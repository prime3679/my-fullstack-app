'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../../lib/api';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';

export default function ReservationConfirmationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const restaurantSlug = params.slug as string;
  const reservationId = params.reservationId as string;
  const hasPreOrder = searchParams.get('preorder') === 'success';

  // Fetch reservation details
  const { data: reservation, isLoading: loadingReservation } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: () => api.getReservation(reservationId),
  });

  if (loadingReservation) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-green-800">Loading reservation...</p>
        </div>
      </div>
    );
  }

  if (!reservation?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-100 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reservation Not Found</h1>
          <p className="text-gray-600 mb-4">The reservation you're looking for doesn't exist.</p>
          <Link href="/" className="text-blue-600 hover:text-blue-700 font-medium">
            ← Back to restaurants
          </Link>
        </div>
      </div>
    );
  }

  const reservationData = reservation.data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Reservation Confirmed!</h1>
            <p className="text-green-600 font-medium">
              {hasPreOrder ? 'Your table is reserved and pre-order is complete!' : 'Your table is reserved'}
            </p>
          </div>

          {/* Reservation Details */}
          <div className="space-y-6">
            {/* Restaurant Info */}
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">{reservationData.restaurant.name}</h2>
              {reservationData.restaurant.locations?.[0] && (
                <p className="text-gray-600">{reservationData.restaurant.locations[0].address}</p>
              )}
            </div>

            {/* QR Code Check-in */}
            {reservationData.checkInCode && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border-2 border-amber-200">
                <div className="text-center">
                  <h3 className="font-semibold text-amber-900 mb-3 text-lg">Quick Check-In</h3>
                  <p className="text-sm text-amber-800 mb-4">
                    Scan this QR code when you arrive at the restaurant for instant check-in
                  </p>

                  {/* QR Code */}
                  <div className="bg-white p-4 rounded-lg inline-block shadow-sm">
                    <QRCodeSVG
                      value={`${window.location.origin}/checkin/${reservationData.checkInCode}`}
                      size={200}
                      level="M"
                      includeMargin={true}
                    />
                  </div>

                  {/* Check-in Code */}
                  <div className="mt-4">
                    <p className="text-xs text-amber-700 mb-1">Or use code:</p>
                    <p className="text-2xl font-mono font-bold text-amber-900 tracking-wider">
                      {reservationData.checkInCode}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Reservation Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Date & Time</h3>
                <p className="text-gray-700">
                  {new Date(reservationData.startAt).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
                <p className="text-gray-700">
                  {new Date(reservationData.startAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-1">Party Size</h3>
                <p className="text-gray-700">{reservationData.partySize} {reservationData.partySize === 1 ? 'person' : 'people'}</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-1">Reservation ID</h3>
                <p className="text-gray-700 font-mono text-sm">{reservationData.id}</p>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 mb-1">Status</h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Confirmed
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="border-t border-gray-200 pt-6 mt-8">
            <div className="space-y-3">
              {/* Pre-order option - only show if no pre-order yet */}
              {!hasPreOrder && (
                <Link
                  href={`/restaurant/${restaurantSlug}/reserve/${reservationId}/preorder`}
                  className="w-full block text-center px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
                >
                  Pre-Order Food & Drinks →
                </Link>
              )}

              {/* View reservation */}
              <div className="text-center">
                <Link
                  href={`/reservation/${reservationId}`}
                  className="text-blue-600 hover:text-blue-700 font-medium text-sm"
                >
                  View full reservation details
                </Link>
              </div>
            </div>
          </div>

          {/* Important Information */}
          <div className="mt-8 bg-blue-50 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-blue-500 text-lg">ℹ️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-900">Important Information</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="space-y-1">
                    <li>• Please arrive 5-10 minutes before your reservation time</li>
                    <li>• Use the QR code above for quick check-in when you arrive</li>
                    <li>• A confirmation email with your QR code has been sent to your email</li>
                    <li>• You can modify or cancel your reservation up to 2 hours before</li>
                    <li>• Contact the restaurant directly for special requests</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="text-gray-500 hover:text-gray-700 text-sm"
            >
              ← Back to restaurants
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}