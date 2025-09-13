'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';
import { ClientLogger } from '../lib/logger';

interface StaffUser {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'HOST' | 'SERVER' | 'EXPO' | 'KITCHEN' | 'MANAGER' | 'ORG_ADMIN' | 'SUPPORT';
  restaurant?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface StaffContextType {
  staffUser: StaffUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  completeOnboarding: (data: { 
    password: string; 
    phone: string; 
    preferences?: { 
      shiftNotifications?: boolean; 
      orderNotifications?: boolean; 
      marketingOptIn?: boolean; 
    } 
  }) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: { 
    name?: string; 
    phone?: string; 
    preferences?: { 
      shiftNotifications?: boolean; 
      orderNotifications?: boolean; 
      marketingOptIn?: boolean; 
    } 
  }) => Promise<{ success: boolean; error?: string }>;
}

const StaffContext = createContext<StaffContextType | undefined>(undefined);

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('staff_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Check if token is expired
        if (payload.exp * 1000 > Date.now()) {
          // Token is valid, set user from token payload
          const userData = localStorage.getItem('staff_user');
          if (userData) {
            setStaffUser(JSON.parse(userData));
          }
        } else {
          // Token expired, clear storage
          localStorage.removeItem('staff_token');
          localStorage.removeItem('staff_user');
        }
      } catch (error) {
        // Invalid token, clear storage
        localStorage.removeItem('staff_token');
        localStorage.removeItem('staff_user');
        ClientLogger.error('Invalid staff token found', { error });
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/staff/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        ClientLogger.error('Staff login failed', { 
          email, 
          error: data.error,
          statusCode: response.status 
        });
        return { success: false, error: data.error || 'Login failed' };
      }

      // Store token and user data
      localStorage.setItem('staff_token', data.token);
      localStorage.setItem('staff_user', JSON.stringify(data.user));
      setStaffUser(data.user);

      ClientLogger.userAction('STAFF_LOGIN_SUCCESS', {
        userId: data.user.id,
        role: data.user.role,
        restaurantId: data.user.restaurant?.id
      });

      return { success: true };
    } catch (error) {
      ClientLogger.error('Staff login error', { error });
      return { success: false, error: 'Network error' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('staff_token');
    localStorage.removeItem('staff_user');
    setStaffUser(null);
    
    if (staffUser) {
      ClientLogger.userAction('STAFF_LOGOUT', {
        userId: staffUser.id,
        role: staffUser.role
      });
    }
  };

  const completeOnboarding = async (data: { 
    password: string; 
    phone: string; 
    preferences?: { 
      shiftNotifications?: boolean; 
      orderNotifications?: boolean; 
      marketingOptIn?: boolean; 
    } 
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = localStorage.getItem('staff_token');
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/staff/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        ClientLogger.error('Staff onboarding failed', { 
          error: result.error,
          statusCode: response.status 
        });
        return { success: false, error: result.error || 'Onboarding failed' };
      }

      // Update stored user data
      localStorage.setItem('staff_user', JSON.stringify(result.user));
      setStaffUser(result.user);

      ClientLogger.businessEvent('STAFF_ONBOARDING_COMPLETE', {
        userId: result.user.id,
        role: result.user.role,
        restaurantId: result.user.restaurant?.id
      });

      return { success: true };
    } catch (error) {
      ClientLogger.error('Staff onboarding error', { error });
      return { success: false, error: 'Network error' };
    }
  };

  const updateProfile = async (data: { 
    name?: string; 
    phone?: string; 
    preferences?: { 
      shiftNotifications?: boolean; 
      orderNotifications?: boolean; 
      marketingOptIn?: boolean; 
    } 
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const token = localStorage.getItem('staff_token');
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/staff/profile`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        ClientLogger.error('Staff profile update failed', { 
          error: result.error,
          statusCode: response.status 
        });
        return { success: false, error: result.error || 'Profile update failed' };
      }

      // Update stored user data
      localStorage.setItem('staff_user', JSON.stringify(result.user));
      setStaffUser(result.user);

      ClientLogger.userAction('STAFF_PROFILE_UPDATED', {
        userId: result.user.id,
        role: result.user.role
      });

      return { success: true };
    } catch (error) {
      ClientLogger.error('Staff profile update error', { error });
      return { success: false, error: 'Network error' };
    }
  };

  const value: StaffContextType = {
    staffUser,
    isLoading,
    login,
    logout,
    completeOnboarding,
    updateProfile,
  };

  return <StaffContext.Provider value={value}>{children}</StaffContext.Provider>;
}

export function useStaff() {
  const context = useContext(StaffContext);
  if (context === undefined) {
    throw new Error('useStaff must be used within a StaffProvider');
  }
  return context;
}