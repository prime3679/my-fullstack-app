'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { ClientLogger } from '../../../lib/logger';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        const token = searchParams.get('token');
        const provider = searchParams.get('provider');
        const error = searchParams.get('error');

        if (error) {
          setError(getErrorMessage(error));
          setIsProcessing(false);
          return;
        }

        if (!token) {
          setError('No authentication token received');
          setIsProcessing(false);
          return;
        }

        // Store the token
        localStorage.setItem('auth_token', token);

        // Get user profile
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setUser(data.user);
            
            ClientLogger.businessEvent('SOCIAL_AUTH_CALLBACK_SUCCESS', {
              provider,
              userId: data.user.id
            });

            // Redirect to appropriate page
            const redirectTo = localStorage.getItem('auth_redirect_after') || '/';
            localStorage.removeItem('auth_redirect_after');
            
            router.replace(redirectTo);
            return;
          }
        }

        throw new Error('Failed to get user profile');

      } catch (err) {
        ClientLogger.error('OAuth callback error', { err });
        setError('Authentication failed. Please try again.');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, setUser, router]);

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'google_auth_failed':
        return 'Google authentication failed. Please try again.';
      case 'apple_auth_failed':
        return 'Apple authentication failed. Please try again.';
      case 'token_generation_failed':
        return 'Authentication successful but token generation failed. Please try again.';
      default:
        return 'Authentication failed. Please try again.';
    }
  };

  const handleRetry = () => {
    router.push('/join');
  };

  if (isProcessing) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Completing Sign In
          </h2>
          <p className="text-gray-600 mb-4">
            Please wait while we finish setting up your account...
          </p>
          
          {/* Progress dots */}
          <div className="flex justify-center space-x-2 mt-6">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-orange-50 flex items-center justify-center">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-3xl">⚠️</span>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Error
          </h2>
          
          <p className="text-gray-600 mb-6">
            {error}
          </p>

          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold"
            >
              Try Again
            </button>
            
            <button
              onClick={() => router.push('/')}
              className="w-full text-gray-600 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null; // Should not reach here, but just in case
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}