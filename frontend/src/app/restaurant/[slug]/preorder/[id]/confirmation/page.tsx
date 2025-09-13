'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../../lib/api';
import Link from 'next/link';

export default function PreOrderConfirmationPage() {
  const params = useParams();
  const preOrderId = params.id as string;
  const restaurantSlug = params.slug as string;

  // Fetch pre-order details
  const { data: preOrderData, isLoading, error } = useQuery({
    queryKey: ['preorder', preOrderId],
    queryFn: () => api.getPreOrder(preOrderId),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-amber-800">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (error || !preOrderData?.data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Order not found</h2>
          <p className="text-gray-600 mb-4">
            The pre-order you're looking for could not be found.
          </p>
          <Link href="/" className="text-amber-600 hover:text-amber-700">← Back to restaurants</Link>
        </div>
      </div>
    );
  }

  const preOrder = preOrderData.data;
  const reservation = preOrder.reservation;
  const reservationDate = new Date(reservation.startAt);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🍽️</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pre-Order Confirmed!</h1>
          <p className="text-lg text-gray-600">
            Your food will be ready when you arrive at {reservation.restaurant.name}
          </p>
        </div>

        {/* Order Details Card */}
        <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-green-600 text-white p-6">
            <h2 className="text-xl font-semibold mb-2">Pre-Order Summary</h2>
            <p className="text-green-100">Order ID: <span className="font-mono font-bold">{preOrder.id}</span></p>
          </div>

          <div className="p-6 space-y-6">
            {/* Order Items */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Order</h3>
              <div className="space-y-3">
                {preOrder.items.map((item, index) => (
                  <div key={index} className="flex justify-between items-start border-b border-gray-100 pb-3 last:border-b-0">
                    <div className="flex-1">
                      <h4 className="font-medium">{item.name}</h4>
                      <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      {item.notes && (
                        <p className="text-sm text-gray-600 italic">Note: {item.notes}</p>
                      )}
                      {item.modifiersJson && item.modifiersJson.length > 0 && (
                        <div className="text-sm text-gray-600 mt-1">
                          {item.modifiersJson.map((mod: any, modIndex: number) => (
                            <span key={modIndex} className="inline-block bg-gray-100 rounded-full px-2 py-1 mr-1 mb-1">
                              {mod.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${(item.price / 100).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${(preOrder.subtotal / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${(preOrder.tax / 100).toFixed(2)}</span>
                </div>
                {preOrder.tip > 0 && (
                  <div className="flex justify-between">
                    <span>Tip</span>
                    <span>${(preOrder.tip / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t border-gray-300 pt-2 font-semibold">
                  <div className="flex justify-between text-lg">
                    <span>Total</span>
                    <span>${(preOrder.total / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reservation Details */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Reservation</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <p className="text-sm text-gray-600">Restaurant</p>
                    <p className="font-medium">{reservation.restaurant.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Party Size</p>
                    <p className="font-medium">{reservation.partySize} {reservation.partySize === 1 ? 'person' : 'people'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-medium">
                      {reservationDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Time</p>
                    <p className="font-medium">
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

            {/* Status */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Status</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold">📝</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-medium text-blue-900">Order Received</p>
                    <p className="text-sm text-blue-700">
                      Your order has been confirmed. The kitchen will start preparing your food when you check in.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Next Steps */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">What's Next?</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <p className="font-medium">Arrive at the restaurant on time</p>
                    <p className="text-sm text-gray-600">Please arrive at your scheduled reservation time.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <p className="font-medium">Check in with the host</p>
                    <p className="text-sm text-gray-600">Let them know you have a pre-order and provide your confirmation code.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <p className="font-medium">Enjoy your meal!</p>
                    <p className="text-sm text-gray-600">Your food will be prepared and served shortly after you're seated.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 px-6 py-4 flex gap-3">
            <Link
              href={`/restaurant/${restaurantSlug}/reservation/${reservation.id}/confirmation`}
              className="flex-1 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors text-center font-medium"
            >
              View Reservation
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
            Questions about your order? Contact the restaurant directly or email us at support@lacarta.app
          </p>
        </div>
      </div>
    </div>
  );
}