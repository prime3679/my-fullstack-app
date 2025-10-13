'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingButton } from '../Loading';
import { ClientLogger } from '../../lib/logger';

interface SMSVerificationProps {
  phone: string;
  onSuccess?: () => void;
  onBack?: () => void;
}

export function SMSVerification({ phone, onSuccess, onBack }: SMSVerificationProps) {
  const { verifyPhone, resendVerificationCode } = useAuth();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Format phone for display
  const formatPhoneDisplay = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  // Countdown timer for resend
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  // Auto-focus first input
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleInputChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only take the last character
    setCode(newCode);
    setError(null);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newCode.every(digit => digit !== '')) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, 6);
    
    if (pastedData.length <= 6) {
      const newCode = pastedData.split('').concat(Array(6 - pastedData.length).fill(''));
      setCode(newCode);
      
      // Focus the next empty input or the last input
      const nextIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
      
      // Auto-verify if complete
      if (pastedData.length === 6) {
        handleVerify(pastedData);
      }
    }
  };

  const handleVerify = async (verificationCode: string) => {
    setIsLoading(true);
    setError(null);
    setStatusMessage(null);

    try {
      ClientLogger.userAction('SMS_VERIFICATION_ATTEMPTED', { phone });

      const success = await verifyPhone(phone, verificationCode);
      
      if (success) {
        ClientLogger.businessEvent('PHONE_VERIFIED_SUCCESS', { phone });
        onSuccess?.();
      } else {
        setError('Invalid verification code. Please try again.');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError('Verification failed. Please try again.');
      ClientLogger.error('SMS verification error', { 
        error: { 
          name: (err as Error).name, 
          message: (err as Error).message 
        } 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!canResend || isResending) {
      return;
    }

    ClientLogger.userAction('SMS_CODE_RESEND_REQUESTED', { phone });
    setIsResending(true);
    setError(null);
    setStatusMessage(null);

    try {
      const result = await resendVerificationCode(phone);

      if (result.success) {
        const retryAfter = typeof result.retryAfterSeconds === 'number' ? result.retryAfterSeconds : 60;
        setTimeLeft(retryAfter);
        setCanResend(false);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setStatusMessage('We just sent a new verification code to your phone.');

        if (result.testVerificationCode && process.env.NODE_ENV === 'development') {
          console.info('Test verification code (resend):', result.testVerificationCode);
        }
      } else {
        const retryAfter = typeof result.retryAfterSeconds === 'number' ? result.retryAfterSeconds : null;
        if (retryAfter) {
          setTimeLeft(retryAfter);
          setCanResend(false);
        }
        setError(result.error || 'Unable to resend verification code right now.');
      }
    } catch (err) {
      setError('Failed to resend verification code. Please try again later.');
      ClientLogger.error('SMS resend unexpected error', {
        error: {
          name: (err as Error).name,
          message: (err as Error).message
        }
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <span className="text-2xl">📱</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Check your phone
        </h2>
        <p className="text-gray-600">
          We sent a verification code to{' '}
          <span className="font-semibold">{formatPhoneDisplay(phone)}</span>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {statusMessage && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
          {statusMessage}
        </div>
      )}

      <div className="space-y-6">
        {/* Verification Code Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
            Enter verification code
          </label>
          <div className="flex justify-center space-x-3" onPaste={handlePaste}>
            {code.map((digit, index) => (
              <input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                disabled={isLoading}
              />
            ))}
          </div>
        </div>

        {/* Resend Code */}
        <div className="text-center">
          {!canResend ? (
            <p className="text-sm text-gray-500">
              Resend code in {timeLeft}s
            </p>
          ) : (
            <button
              onClick={handleResendCode}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline disabled:text-blue-300 disabled:no-underline"
              disabled={isResending}
            >
              {isResending ? 'Sending…' : 'Resend verification code'}
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <LoadingButton
            isLoading={isLoading}
            onClick={() => handleVerify(code.join(''))}
            disabled={code.some(digit => digit === '') || isLoading}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Verifying...' : 'Verify Phone Number'}
          </LoadingButton>

          {onBack && (
            <button
              onClick={onBack}
              className="w-full text-gray-600 py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              disabled={isLoading}
            >
              ← Back to signup
            </button>
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <span className="text-blue-500 text-sm">💡</span>
          </div>
          <div className="ml-3">
            <p className="text-xs text-blue-700">
              <strong>Tip:</strong> Check your messages app. The code usually arrives within 30 seconds.
            </p>
          </div>
        </div>
      </div>

      {/* Security Note */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-400">
          🔒 Your phone number is encrypted and secure
        </p>
      </div>
    </div>
  );
}