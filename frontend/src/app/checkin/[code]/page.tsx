'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../../lib/api';

export default function CheckInPage() {
  const params = useParams();
  const router = useRouter();
  const checkInCode = params.code as string;
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const checkInMutation = useMutation({
    mutationFn: (code: string) => api.checkIn(code),
    onSuccess: (response) => {
      setStatus('success');
      setMessage('Check-in successful! Your order has been sent to the kitchen.');
      
      // Redirect to order status page after 3 seconds
      setTimeout(() => {
        router.push(`/order-status/${response.data.reservationId}`);
      }, 3000);
    },
    onError: (error: any) => {
      setStatus('error');
      setMessage(error.message || 'Check-in failed. Please see the host.');
    }
  });

  useEffect(() => {
    // Automatically attempt check-in when page loads
    if (checkInCode) {
      checkInMutation.mutate(checkInCode);
    }
  }, [checkInCode]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo/Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">La Carta</h1>
            <p className="text-gray-600 mt-2">Welcome to your dining experience</p>
          </div>

          {/* Status Display */}
          <div className="text-center">
            {status === 'loading' && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 bg-amber-100 rounded-full mb-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Checking you in...</h2>
                <p className="text-gray-600">Please wait while we confirm your reservation</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <span className="text-4xl">✅</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Welcome!</h2>
                <p className="text-gray-600">{message}</p>
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Your pre-ordered items will be prepared and arrive shortly after you're seated.
                  </p>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                  <span className="text-4xl">❌</span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Check-in Failed</h2>
                <p className="text-gray-600">{message}</p>
                <button
                  onClick={() => checkInMutation.mutate(checkInCode)}
                  className="mt-6 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                >
                  Try Again
                </button>
                <p className="mt-4 text-sm text-gray-500">
                  Need help? Please speak with your host.
                </p>
              </>
            )}
          </div>

          {/* Additional Info */}
          {status === 'success' && (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="font-medium text-gray-900 mb-3">What happens next?</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start">
                  <span className="text-amber-500 mr-2">•</span>
                  Your host will seat you at your table
                </li>
                <li className="flex items-start">
                  <span className="text-amber-500 mr-2">•</span>
                  Pre-ordered items will arrive within 5 minutes
                </li>
                <li className="flex items-start">
                  <span className="text-amber-500 mr-2">•</span>
                  You can order additional items from your server
                </li>
                <li className="flex items-start">
                  <span className="text-amber-500 mr-2">•</span>
                  Payment will be processed automatically when you leave
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}