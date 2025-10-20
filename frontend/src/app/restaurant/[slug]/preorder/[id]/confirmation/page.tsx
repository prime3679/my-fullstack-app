'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../../../../lib/api';
import Link from 'next/link';
import QRCode from 'qrcode.react';

export default function PreOrderConfirmationPage() {
  const params = useParams();
  const preOrderId = params.id as string;
  const restaurantSlug = params.slug as string;

  // Fetch pre-order details
  const { data: preOrderData, isLoading, error } = useQuery({
    queryKey: ['preorder', preOrderId],
    queryFn: () => api.getPreOrder(preOrderId),
  });

  // Fetch payment status
  const { data: paymentData } = useQuery({
    queryKey: ['payment-status', preOrderId],
    queryFn: () => api.getPaymentStatus(preOrderId),
    enabled: !!preOrderId,
  });

  const generateCalendarLink = () => {
    if (!preOrder) return '';
    const reservation = preOrder.reservation;
    const startDate = new Date(reservation.startAt);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // 2 hours later

    const formatDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const title = `Dinner at ${reservation.restaurant.name}`;
    const description = `Pre-order confirmed! Party of ${reservation.partySize}. Order ID: ${preOrder.id}`;
    const location = reservation.restaurant.name;

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatDate(startDate)}/${formatDate(endDate)}&details=${encodeURIComponent(description)}&location=${encodeURIComponent(location)}`;
  };

  const handleShare = async () => {
    const shareData = {
      title: `Pre-order at ${preOrder?.reservation.restaurant.name}`,
      text: `I have a reservation and pre-order confirmed for ${preOrder?.reservation.restaurant.name}!`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        alert('Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

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
  const paymentStatus = paymentData?.data?.latestPayment?.status;
  const isPaid = paymentStatus === 'CAPTURED' || paymentStatus === 'AUTHORIZED';

  const checkinUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/checkin/${reservation.id}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {isPaid ? 'Payment Confirmed!' : 'Pre-Order Confirmed!'}
          </h1>
          <p className="text-lg text-gray-600">
            Your food will be ready when you arrive at {reservation.restaurant.name}
          </p>
        </div>

        {/* Main Content Grid */}
        <div className="max-w-4xl mx-auto grid gap-6 lg:grid-cols-3">

          {/* Left Column: Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Details Card */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-green-600 text-white p-6">
                <h2 className="text-xl font-semibold mb-2">Pre-Order Summary</h2>
                <p className="text-green-100">Order ID: <span className="font-mono font-bold">{preOrder.id.slice(0, 12)}</span></p>
              </div>

              <div className="p-6 space-y-6">
                {/* Payment Status */}
                {isPaid && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
                          <span className="text-sm">✓</span>
                        </div>
                      </div>
                      <div>
                        <p className="font-medium text-green-900">Payment Successful</p>
                        <p className="text-sm text-green-700">
                          ${(preOrder.total / 100).toFixed(2)} charged to your card
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Order Items */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Your Order</h3>
                  <div className="space-y-3">
                    {preOrder.items.map((item: any, index: number) => (
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
                                  {mod.name} {mod.price > 0 && `+$${(mod.price / 100).toFixed(2)}`}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4">
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
                        <span>Total Paid</span>
                        <span className="text-green-600">${(preOrder.total / 100).toFixed(2)}</span>
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
              </div>
            </div>

            {/* Next Steps */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Next?</h3>
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
                    <p className="font-medium">Scan your QR code to check in</p>
                    <p className="text-sm text-gray-600">Show the QR code to your host or scan it yourself when you arrive.</p>
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

          {/* Right Column: QR Code & Actions */}
          <div className="lg:col-span-1 space-y-6">
            {/* QR Code Card */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 text-center">Check-In QR Code</h3>
              <div className="flex justify-center mb-4">
                <div className="bg-white p-4 rounded-lg border-4 border-amber-600">
                  <QRCode value={checkinUrl} size={200} />
                </div>
              </div>
              <p className="text-sm text-gray-600 text-center mb-4">
                Scan this code when you arrive at the restaurant
              </p>
              <Link
                href={`/checkin/${reservation.id}`}
                className="block w-full bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors text-center font-medium"
              >
                Manual Check-In
              </Link>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <a
                  href={generateCalendarLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
                >
                  📅 Add to Calendar
                </a>
                <button
                  onClick={handleShare}
                  className="block w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-center font-medium"
                >
                  📤 Share Confirmation
                </button>
                <Link
                  href={`/restaurant/${restaurantSlug}`}
                  className="block w-full bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors text-center font-medium"
                >
                  View Menu
                </Link>
              </div>
            </div>

            {/* Order Status */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Order Confirmed</p>
                    <p className="text-xs text-gray-600">{new Date(preOrder.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                {isPaid && (
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center">
                      ✓
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">Payment Received</p>
                      <p className="text-xs text-gray-600">Paid in full</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-300 text-gray-600 rounded-full flex items-center justify-center">
                    ⏱
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">Awaiting Check-In</p>
                    <p className="text-xs text-gray-600">Scan QR code when you arrive</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="max-w-4xl mx-auto mt-8 text-center">
          <p className="text-sm text-gray-600">
            Questions about your order? Contact the restaurant directly or email us at support@lacarta.app
          </p>
        </div>
      </div>
    </div>
  );
}
