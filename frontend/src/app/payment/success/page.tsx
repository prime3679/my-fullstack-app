'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preOrderId = searchParams.get('preOrderId');
  const paymentIntentId = searchParams.get('paymentIntentId');
  const [confirmationCode, setConfirmationCode] = useState<string>('');

  useEffect(() => {
    // Generate a confirmation code
    if (preOrderId) {
      const code = `LC${preOrderId.slice(-8).toUpperCase()}`;
      setConfirmationCode(code);
    }
  }, [preOrderId]);

  if (!preOrderId) {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Success Icon */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Payment Successful!</h1>
            <p className="text-gray-600 mt-2">Your pre-order has been confirmed</p>
          </div>

          {/* Confirmation Details */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-500 mb-1">Confirmation Code</p>
              <p className="text-2xl font-mono font-bold text-gray-900">{confirmationCode}</p>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Order ID:</span>
                <span className="font-medium text-gray-900">{preOrderId.slice(-8).toUpperCase()}</span>
              </div>
              {paymentIntentId && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Transaction ID:</span>
                  <span className="font-medium text-gray-900">{paymentIntentId.slice(-12)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">What's Next?</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>You'll receive a confirmation email shortly</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Show your confirmation code at the restaurant</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">✓</span>
                <span>Your pre-ordered items will be ready when you arrive</span>
              </li>
            </ul>
          </div>

          {/* Important Info */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-amber-900 mb-2">Important Information</h3>
            <ul className="space-y-2 text-sm text-amber-800">
              <li className="flex items-start">
                <span className="text-amber-600 mr-2">•</span>
                <span>Arrive within 15 minutes of your reservation time</span>
              </li>
              <li className="flex items-start">
                <span className="text-amber-600 mr-2">•</span>
                <span>Additional items can be ordered at the restaurant</span>
              </li>
              <li className="flex items-start">
                <span className="text-amber-600 mr-2">•</span>
                <span>Cancellations must be made at least 2 hours in advance</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Link
              href={`/reservations/${preOrderId}`}
              className="block w-full bg-amber-600 text-white text-center py-3 px-4 rounded-lg font-medium hover:bg-amber-700 transition-colors"
            >
              View Reservation Details
            </Link>
            <Link
              href="/"
              className="block w-full bg-gray-100 text-gray-700 text-center py-3 px-4 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Back to Home
            </Link>
          </div>

          {/* Support */}
          <div className="mt-6 text-center text-sm text-gray-500">
            Need help? <a href="#" className="text-amber-600 hover:text-amber-700">Contact Support</a>
          </div>
        </div>
      </div>
    </div>
  );
}