'use client';

import { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';

interface CheckoutFormProps {
  paymentIntentId: string;
  onSuccess: () => void;
  amount: number;
  onRetry?: () => void;
}

interface PaymentError {
  message: string;
  code?: string;
  type: 'card_error' | 'validation_error' | 'api_error' | 'network_error' | 'unknown';
  canRetry: boolean;
  suggestion?: string;
}

export function CheckoutForm({ paymentIntentId, onSuccess, amount, onRetry }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<PaymentError | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);

  // Categorize Stripe errors into actionable types
  const categorizeError = (stripeError: any): PaymentError => {
    const errorCode = stripeError.code;
    const errorType = stripeError.type;

    // Card errors (user can fix)
    if (errorType === 'card_error') {
      const cardErrorMessages: Record<string, PaymentError> = {
        'card_declined': {
          message: 'Your card was declined.',
          code: errorCode,
          type: 'card_error',
          canRetry: true,
          suggestion: 'Please try a different payment method or contact your bank.'
        },
        'insufficient_funds': {
          message: 'Your card has insufficient funds.',
          code: errorCode,
          type: 'card_error',
          canRetry: true,
          suggestion: 'Please use a different card or add funds to your account.'
        },
        'expired_card': {
          message: 'Your card has expired.',
          code: errorCode,
          type: 'card_error',
          canRetry: true,
          suggestion: 'Please use a different card with a valid expiration date.'
        },
        'incorrect_cvc': {
          message: 'Your card\'s security code is incorrect.',
          code: errorCode,
          type: 'card_error',
          canRetry: true,
          suggestion: 'Please check the 3-4 digit code on the back of your card and try again.'
        },
        'processing_error': {
          message: 'An error occurred while processing your card.',
          code: errorCode,
          type: 'card_error',
          canRetry: true,
          suggestion: 'Please try again or use a different card.'
        }
      };

      return cardErrorMessages[errorCode] || {
        message: stripeError.message || 'There was a problem with your card.',
        code: errorCode,
        type: 'card_error',
        canRetry: true,
        suggestion: 'Please check your card details and try again, or use a different payment method.'
      };
    }

    // Validation errors (user input issue)
    if (errorType === 'validation_error') {
      return {
        message: stripeError.message || 'Please check your payment details.',
        code: errorCode,
        type: 'validation_error',
        canRetry: true,
        suggestion: 'Make sure all required fields are filled in correctly.'
      };
    }

    // API/Network errors (system issue)
    if (errorType === 'api_error' || errorCode === 'api_error') {
      return {
        message: 'We\'re having trouble processing payments right now.',
        code: errorCode,
        type: 'api_error',
        canRetry: true,
        suggestion: 'Please try again in a few moments.'
      };
    }

    // Default unknown error
    return {
      message: stripeError.message || 'An unexpected error occurred.',
      code: errorCode,
      type: 'unknown',
      canRetry: true,
      suggestion: 'Please try again or contact support if the problem persists.'
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setAttemptCount(prev => prev + 1);

    try {
      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (stripeError) {
        setError(categorizeError(stripeError));
        setIsLoading(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Confirm payment with our backend
        const response = await fetch('/api/v1/payments/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentIntentId: paymentIntent.id
          })
        });

        if (!response.ok) {
          throw new Error('Failed to confirm payment with server');
        }

        const data = await response.json();

        if (data.success) {
          onSuccess();
        } else {
          setError({
            message: data.error || 'Payment confirmation failed',
            type: 'api_error',
            canRetry: true,
            suggestion: 'Your payment was processed but we had trouble confirming it. Please contact support.'
          });
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError({
        message: err instanceof Error ? err.message : 'Payment failed',
        type: 'network_error',
        canRetry: true,
        suggestion: 'Please check your internet connection and try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setAttemptCount(0);
    if (onRetry) {
      onRetry();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {attemptCount > 0 && attemptCount < 3 && !error && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            {attemptCount === 1 ? 'Processing your payment...' : `Retry attempt ${attemptCount} of 3`}
          </p>
        </div>
      )}

      <div className="space-y-4">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <span className="text-red-500 text-xl">⚠️</span>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-1">
                Payment Failed
              </h3>
              <p className="text-sm text-red-700 mb-2">
                {error.message}
              </p>
              {error.suggestion && (
                <p className="text-xs text-red-600 mb-3">
                  💡 {error.suggestion}
                </p>
              )}
              {error.canRetry && attemptCount < 3 && (
                <button
                  type="button"
                  onClick={handleRetry}
                  className="text-xs font-medium text-red-700 hover:text-red-900 underline"
                >
                  Try again with different payment method
                </button>
              )}
              {attemptCount >= 3 && (
                <div className="text-xs text-red-600 bg-red-100 rounded p-2 mt-2">
                  <p className="font-medium">Multiple failed attempts detected</p>
                  <p className="mt-1">
                    Please contact support at support@lacarta.app or try again later.
                  </p>
                </div>
              )}
              {error.code && (
                <p className="text-xs text-red-500 mt-2">
                  Error code: {error.code}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="border-t border-gray-200 pt-4">
        <button
          type="submit"
          disabled={!stripe || isLoading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            isLoading || !stripe
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-amber-600 text-white hover:bg-amber-700'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span>Processing...</span>
            </div>
          ) : (
            `Pay $${(amount / 100).toFixed(2)}`
          )}
        </button>
      </div>

      <div className="text-center text-xs text-gray-500">
        <p>By clicking &quot;Pay&quot;, you agree to our terms and authorize the charge.</p>
      </div>
    </form>
  );
}