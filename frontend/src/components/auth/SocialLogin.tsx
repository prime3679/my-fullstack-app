'use client';

import React, { useEffect, useState } from 'react';
import { ClientLogger } from '../../lib/logger';

interface SocialLoginProps {
  onSuccess: (response: {
    provider: 'google' | 'apple';
    token: string;
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
    };
    requiresOnboarding?: boolean;
  }) => void;
  onError: (error: string) => void;
  disabled?: boolean;
}

// Declare Google API types
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: any) => void;
        signIn: (config?: any) => Promise<any>;
      };
    };
  }
}

export function SocialLogin({ onSuccess, onError, disabled }: SocialLoginProps) {
  const [isGoogleLoaded, setIsGoogleLoaded] = useState(false);
  const [isAppleLoaded, setIsAppleLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load Google Sign-In
    const loadGoogleSignIn = () => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google) {
          window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || 'demo-client-id',
            callback: handleGoogleResponse,
            auto_select: false,
            cancel_on_tap_outside: false
          });
          setIsGoogleLoaded(true);
        }
      };
      document.head.appendChild(script);
    };

    // Load Apple Sign-In
    const loadAppleSignIn = () => {
      const script = document.createElement('script');
      script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
      script.async = true;
      script.onload = () => {
        if (window.AppleID) {
          window.AppleID.auth.init({
            clientId: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID || 'demo-client-id',
            scope: 'name email',
            redirectURI: process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI || 'http://localhost:3000/auth/apple/callback',
            state: 'signin',
            usePopup: true
          });
          setIsAppleLoaded(true);
        }
      };
      document.head.appendChild(script);
    };

    loadGoogleSignIn();
    loadAppleSignIn();

    return () => {
      // Clean up scripts if needed
      const googleScript = document.querySelector('script[src*="accounts.google.com"]');
      const appleScript = document.querySelector('script[src*="appleid.cdn-apple.com"]');
      if (googleScript) googleScript.remove();
      if (appleScript) appleScript.remove();
    };
  }, []);

  const handleGoogleResponse = async (credentialResponse: any) => {
    if (disabled) return;
    
    setIsLoading(true);
    ClientLogger.userAction('GOOGLE_SIGNIN_ATTEMPTED');

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'google',
          idToken: credentialResponse.credential
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        ClientLogger.businessEvent('SOCIAL_LOGIN_SUCCESS', {
          provider: 'google',
          userId: data.user.id,
          requiresOnboarding: data.requiresOnboarding
        });

        onSuccess({
          provider: 'google',
          token: data.token,
          user: data.user,
          requiresOnboarding: data.requiresOnboarding
        });
      } else {
        throw new Error(data.error || 'Google sign-in failed');
      }
    } catch (error) {
      ClientLogger.error('Google sign-in error', { error });
      onError(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (disabled || !isGoogleLoaded || !window.google) return;
    
    // Use the prompt method to show the Google Sign-In popup
    window.google.accounts.id.prompt();
  };

  const handleAppleSignIn = async () => {
    if (disabled || !isAppleLoaded || !window.AppleID) return;

    setIsLoading(true);
    ClientLogger.userAction('APPLE_SIGNIN_ATTEMPTED');

    try {
      const appleResponse = await window.AppleID.auth.signIn();
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/social`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider: 'apple',
          idToken: appleResponse.authorization.id_token,
          email: appleResponse.user?.email,
          name: appleResponse.user?.name ? `${appleResponse.user.name.firstName} ${appleResponse.user.name.lastName}` : 'Apple User'
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        ClientLogger.businessEvent('SOCIAL_LOGIN_SUCCESS', {
          provider: 'apple',
          userId: data.user.id,
          requiresOnboarding: data.requiresOnboarding
        });

        onSuccess({
          provider: 'apple',
          token: data.token,
          user: data.user,
          requiresOnboarding: data.requiresOnboarding
        });
      } else {
        throw new Error(data.error || 'Apple sign-in failed');
      }
    } catch (error) {
      ClientLogger.error('Apple sign-in error', { error });
      onError(error instanceof Error ? error.message : 'Apple sign-in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Google Sign-In Button */}
      <button
        onClick={handleGoogleSignIn}
        disabled={disabled || !isGoogleLoaded || isLoading}
        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        {isLoading ? 'Signing in...' : 'Continue with Google'}
      </button>

      {/* Apple Sign-In Button */}
      <button
        onClick={handleAppleSignIn}
        disabled={disabled || !isAppleLoaded || isLoading}
        className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-black text-white hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.442 2.320-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
        </svg>
        {isLoading ? 'Signing in...' : 'Continue with Apple'}
      </button>

      {/* Loading indicator */}
      {(!isGoogleLoaded || !isAppleLoaded) && (
        <div className="text-center text-sm text-gray-500">
          Loading social sign-in options...
        </div>
      )}

      {/* Demo Note */}
      <div className="text-center">
        <p className="text-xs text-gray-500 mt-2">
          🔒 Secure sign-in powered by Google and Apple
        </p>
      </div>
    </div>
  );
}