'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ClientLogger } from '../lib/logger';

interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  restaurantId?: string;
  dinerProfile?: {
    dietaryTags: string[];
    allergensJson: string[];
  };
  marketingOptIn: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  signin: (identifier: string, password?: string, verificationCode?: string) => Promise<boolean>;
  signup: (data: SignupData) => Promise<boolean>;
  quickSignup: (phone: string, name: string) => Promise<{ success: boolean; userId?: string; verificationRequired?: boolean }>;
  verifyPhone: (phone: string, code: string) => Promise<boolean>;
  resendVerificationCode: (phone: string) => Promise<{
    success: boolean;
    retryAfterSeconds?: number;
    testVerificationCode?: string;
    error?: string;
  }>;
  signout: () => void;
  updateProfile: (data: Partial<User>) => Promise<boolean>;
  setUser: (user: User | null) => void;
}

interface SignupData {
  phone: string;
  name: string;
  email?: string;
  password?: string;
  dietaryPreferences?: string[];
  allergies?: string[];
  marketingOptIn?: boolean;
  referralSource?: string;
  restaurantId?: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      // Verify token is still valid
      fetchCurrentUser(storedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchCurrentUser = async (authToken: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        ClientLogger.info('User session restored', { userId: data.user.id });
      } else {
        // Token is invalid, clear auth state
        clearAuthState();
      }
    } catch (error) {
      ClientLogger.error('Failed to fetch current user', { 
        error: { 
          name: (error as Error).name, 
          message: (error as Error).message 
        } 
      });
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuthState = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
  };

  const signin = async (identifier: string, password?: string, verificationCode?: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/signin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, verificationCode }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setUser(data.user);
        setToken(data.token);
        localStorage.setItem('auth_token', data.token);
        localStorage.setItem('auth_user', JSON.stringify(data.user));
        
        ClientLogger.businessEvent('USER_SIGNED_IN', { 
          userId: data.user.id, 
          method: password ? 'password' : 'sms' 
        });
        
        return true;
      } else {
        ClientLogger.error('Sign in failed', { error: data.error });
        return false;
      }
    } catch (error) {
      ClientLogger.error('Sign in error', { 
        error: { 
          name: (error as Error).name, 
          message: (error as Error).message 
        } 
      });
      return false;
    }
  };

  const signup = async (data: SignupData): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        if (!result.verificationRequired) {
          setUser(result.user);
          setToken(result.token);
          localStorage.setItem('auth_token', result.token);
          localStorage.setItem('auth_user', JSON.stringify(result.user));
        }
        
        ClientLogger.businessEvent('USER_SIGNED_UP', { 
          userId: result.user.id,
          referralSource: data.referralSource,
          restaurantId: data.restaurantId
        });
        
        return true;
      } else {
        ClientLogger.error('Sign up failed', { error: result.error });
        return false;
      }
    } catch (error) {
      ClientLogger.error('Sign up error', { 
        error: { 
          name: (error as Error).name, 
          message: (error as Error).message 
        } 
      });
      return false;
    }
  };

  const quickSignup = async (phone: string, name: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/signup/quick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        ClientLogger.businessEvent('USER_QUICK_SIGNUP', { userId: result.userId });
        return {
          success: true,
          userId: result.userId,
          verificationRequired: result.verificationRequired
        };
      } else {
        ClientLogger.error('Quick signup failed', { error: result.error });
        return { success: false };
      }
    } catch (error) {
      ClientLogger.error('Quick signup error', { 
        error: { 
          name: (error as Error).name, 
          message: (error as Error).message 
        } 
      });
      return { success: false };
    }
  };

  const verifyPhone = async (phone: string, code: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/verify-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setUser(result.user);
        setToken(result.token);
        localStorage.setItem('auth_token', result.token);
        localStorage.setItem('auth_user', JSON.stringify(result.user));
        
        ClientLogger.businessEvent('PHONE_VERIFIED', { userId: result.user.id });
        return true;
      } else {
        ClientLogger.error('Phone verification failed', { error: result.error });
        return false;
      }
    } catch (error) {
      ClientLogger.error('Phone verification error', { 
        error: { 
          name: (error as Error).name, 
          message: (error as Error).message 
        } 
      });
      return false;
    }
  };

  const resendVerificationCode = async (phone: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/verify-phone/resend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        ClientLogger.businessEvent('SMS_CODE_RESENT', { phone });
        return {
          success: true,
          retryAfterSeconds: result.retryAfterSeconds,
          testVerificationCode: result.testVerificationCode,
        };
      }

      ClientLogger.error('SMS resend failed', { error: result.error, reason: result.reason });
      return {
        success: false,
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
      };
    } catch (error) {
      ClientLogger.error('SMS resend error', {
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
        },
      });
      return {
        success: false,
        error: 'Failed to resend verification code.',
      };
    }
  };

  const signout = () => {
    clearAuthState();
    ClientLogger.businessEvent('USER_SIGNED_OUT', { userId: user?.id });
  };

  const updateProfile = async (data: Partial<User>): Promise<boolean> => {
    // TODO: Implement profile update API endpoint
    // For now, update local state
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
      ClientLogger.businessEvent('PROFILE_UPDATED', { userId: user.id });
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        signin,
        signup,
        quickSignup,
        verifyPhone,
        resendVerificationCode,
        signout,
        updateProfile,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}