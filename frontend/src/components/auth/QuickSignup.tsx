'use client';

import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoadingButton } from '../Loading';
import { SocialLogin } from './SocialLogin';
import { ClientLogger } from '../../lib/logger';

interface QuickSignupProps {
  restaurantId?: string;
  referralSource?: string;
  onSuccess?: (userId: string) => void;
  onVerificationNeeded?: (phone: string) => void;
}

export function QuickSignup({ 
  restaurantId, 
  referralSource = 'direct',
  onSuccess,
  onVerificationNeeded 
}: QuickSignupProps) {
  const { quickSignup, setUser } = useAuth();
  const [formData, setFormData] = useState({
    phone: '',
    name: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [socialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 6) return `(${numbers.slice(0, 3)}) ${numbers.slice(3)}`;
    return `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setFormData({ ...formData, phone: formatted });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Extract raw phone number
    const rawPhone = formData.phone.replace(/\D/g, '');
    
    if (rawPhone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      setIsLoading(false);
      return;
    }

    if (formData.name.trim().length < 2) {
      setError('Please enter your name');
      setIsLoading(false);
      return;
    }

    try {
      ClientLogger.userAction('QUICK_SIGNUP_ATTEMPTED', { 
        phone: `+1${rawPhone}`,
        referralSource,
        restaurantId 
      });

      const result = await quickSignup(`+1${rawPhone}`, formData.name.trim());
      
      if (result.success) {
        if (result.verificationRequired && result.userId) {
          onVerificationNeeded?.(`+1${rawPhone}`);
        } else if (result.userId) {
          onSuccess?.(result.userId);
        }
      } else {
        setError('Signup failed. Please try again.');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
      ClientLogger.error('Quick signup error', { 
        error: { 
          name: (err as Error).name, 
          message: (err as Error).message 
        } 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSocialSuccess = async (response: {
    provider: 'google' | 'apple';
    token: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    requiresOnboarding?: boolean;
  }) => {
    try {
      // Store auth token
      localStorage.setItem('auth_token', response.token);
      
      // Set user in context
      setUser({
        id: response.user.id,
        email: response.user.email,
        name: response.user.name,
        role: response.user.role,
        phone: '',
        marketingOptIn: false
      });

      ClientLogger.businessEvent('SOCIAL_SIGNUP_SUCCESS', {
        provider: response.provider,
        userId: response.user.id,
        requiresOnboarding: response.requiresOnboarding,
        referralSource,
        restaurantId
      });

      // Call success callback
      onSuccess?.(response.user.id);
      
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error('Unknown error');
      ClientLogger.error('Social signup success handler error', { 
        error: {
          name: errorObj.name,
          message: errorObj.message,
          stack: errorObj.stack
        }
      });
      setError('Authentication successful but setup failed. Please try again.');
    }
  };

  const handleSocialError = (error: string) => {
    setError(`Social sign-in failed: ${error}`);
    ClientLogger.error('Social signup error', { 
      error: {
        name: 'SocialSignupError',
        message: error,
      }
    });
  };

  return (
    <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
          <span className="text-2xl">🍽️</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Skip the line, savor the moment
        </h2>
        <p className="text-gray-600">
          Reserve your table and pre-order in under 90 seconds
        </p>
      </div>

      {/* Social Login Options */}
      <div className="mb-6">
        <SocialLogin
          onSuccess={handleSocialSuccess}
          onError={handleSocialError}
          disabled={isLoading || socialLoading}
        />
      </div>

      {/* Divider */}
      <div className="flex items-center my-6">
        <div className="flex-1 border-t border-gray-300"></div>
        <div className="mx-4 text-sm text-gray-500 font-medium">or continue with phone</div>
        <div className="flex-1 border-t border-gray-300"></div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Your Name
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            placeholder="Enter your name"
            required
            autoComplete="given-name"
            disabled={isLoading}
          />
        </div>

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <input
            type="tel"
            id="phone"
            value={formData.phone}
            onChange={handlePhoneChange}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            placeholder="(555) 123-4567"
            required
            autoComplete="tel"
            disabled={isLoading}
            maxLength={14}
          />
          <p className="text-xs text-gray-500 mt-1">
            We&apos;ll send a verification code via SMS
          </p>
        </div>

        <LoadingButton
          isLoading={isLoading}
          onClick={() => {}}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 text-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          type="submit"
        >
          {isLoading ? 'Creating Account...' : 'Get Started →'}
        </LoadingButton>
      </form>

      <div className="mt-6 text-center">
        <p className="text-xs text-gray-500">
          By continuing, you agree to our{' '}
          <a href="/terms" className="text-blue-600 hover:underline">Terms</a> and{' '}
          <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>
        </p>
      </div>

      <div className="mt-6 flex items-center justify-center space-x-6 text-sm text-gray-500">
        <div className="flex items-center">
          <span className="text-green-500 mr-1">✓</span>
          No waiting
        </div>
        <div className="flex items-center">
          <span className="text-green-500 mr-1">✓</span>
          Pre-order ahead
        </div>
        <div className="flex items-center">
          <span className="text-green-500 mr-1">✓</span>
          VIP treatment
        </div>
      </div>
    </div>
  );
}
