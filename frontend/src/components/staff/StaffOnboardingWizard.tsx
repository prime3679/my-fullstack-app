'use client';

import React, { useState } from 'react';
import { useStaff } from '../../contexts/StaffContext';
import { ClientLogger } from '../../lib/logger';

interface StaffOnboardingWizardProps {
  onComplete?: () => void;
}

export function StaffOnboardingWizard({ onComplete }: StaffOnboardingWizardProps) {
  const { staffUser, completeOnboarding, isLoading } = useStaff();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [preferences, setPreferences] = useState({
    shiftNotifications: true,
    orderNotifications: true,
    marketingOptIn: false
  });
  const [error, setError] = useState('');

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'HOST':
        return {
          title: 'Host Team Member',
          description: 'Welcome guests, manage reservations, and coordinate seating',
          permissions: ['Check-in guests', 'View reservations', 'Manage wait list', 'Assign tables']
        };
      case 'SERVER':
        return {
          title: 'Server',
          description: 'Take orders, serve food, and provide excellent customer service',
          permissions: ['View orders', 'Update order status', 'Process payments', 'Access customer preferences']
        };
      case 'EXPO':
        return {
          title: 'Expeditor',
          description: 'Coordinate between kitchen and service, ensure order accuracy',
          permissions: ['View kitchen orders', 'Update order status', 'Quality control', 'Timing coordination']
        };
      case 'KITCHEN':
        return {
          title: 'Kitchen Team Member',
          description: 'Prepare food, manage kitchen workflow, and maintain quality standards',
          permissions: ['View kitchen tickets', 'Update prep status', 'Mark orders ready', 'Inventory alerts']
        };
      case 'MANAGER':
        return {
          title: 'Restaurant Manager',
          description: 'Oversee operations, manage staff, and ensure smooth service',
          permissions: ['Full access', 'Staff management', 'Analytics dashboard', 'Settings control']
        };
      default:
        return {
          title: 'Staff Member',
          description: 'Team member with specialized access',
          permissions: ['Basic access']
        };
    }
  };

  const roleInfo = staffUser ? getRoleDescription(staffUser.role) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!password.trim() || !confirmPassword.trim() || !phone.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    ClientLogger.userAction('STAFF_ONBOARDING_ATTEMPTED', { 
      role: staffUser?.role,
      userId: staffUser?.id 
    });

    const result = await completeOnboarding({
      password: password.trim(),
      phone: phone.trim(),
      preferences
    });

    if (result.success) {
      ClientLogger.userAction('STAFF_ONBOARDING_SUCCESS', { 
        role: staffUser?.role,
        userId: staffUser?.id 
      });
      onComplete?.();
    } else {
      setError(result.error || 'Onboarding failed');
    }
  };

  if (!staffUser) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
        <div className="text-red-600 text-xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Authentication Required
        </h3>
        <p className="text-gray-600">
          Please sign in to complete your staff onboarding.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl border border-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-8 py-6 rounded-t-2xl border-b border-gray-200">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
            <span className="text-3xl">
              {staffUser.role === 'HOST' && '🏛️'}
              {staffUser.role === 'SERVER' && '🍽️'}
              {staffUser.role === 'EXPO' && '📋'}
              {staffUser.role === 'KITCHEN' && '👨‍🍳'}
              {staffUser.role === 'MANAGER' && '👔'}
              {!['HOST', 'SERVER', 'EXPO', 'KITCHEN', 'MANAGER'].includes(staffUser.role) && '👥'}
            </span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome, {staffUser.name}!
          </h2>
          <p className="text-lg text-gray-600 mb-4">
            Complete your {roleInfo?.title} onboarding
          </p>
          {staffUser.restaurant && (
            <div className="inline-flex items-center bg-white/80 px-4 py-2 rounded-lg text-sm text-gray-700">
              <span className="mr-2">🏪</span>
              {staffUser.restaurant.name}
            </div>
          )}
        </div>
      </div>

      <div className="p-8">
        {/* Role Information */}
        {roleInfo && (
          <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Your Role: {roleInfo.title}
            </h3>
            <p className="text-blue-800 mb-4">
              {roleInfo.description}
            </p>
            <div className="space-y-2">
              <h4 className="font-medium text-blue-900">Your Permissions:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {roleInfo.permissions.map((permission, index) => (
                  <div key={index} className="flex items-center text-sm text-blue-700">
                    <span className="text-green-500 mr-2">✓</span>
                    {permission}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Onboarding Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          {/* Password Setup */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Create Password *
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                placeholder="Minimum 6 characters"
                required
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password *
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                placeholder="Re-enter password"
                required
              />
            </div>
          </div>

          {/* Phone Number */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              placeholder="(555) 123-4567"
              required
            />
            <p className="text-sm text-gray-500 mt-1">
              Used for shift notifications and important updates
            </p>
          </div>

          {/* Notification Preferences */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Notification Preferences</h4>
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.shiftNotifications}
                  onChange={(e) => setPreferences(prev => ({ 
                    ...prev, 
                    shiftNotifications: e.target.checked 
                  }))}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <span className="ml-3 text-sm text-gray-700">
                  Receive shift notifications and schedule updates
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.orderNotifications}
                  onChange={(e) => setPreferences(prev => ({ 
                    ...prev, 
                    orderNotifications: e.target.checked 
                  }))}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <span className="ml-3 text-sm text-gray-700">
                  Receive order updates and kitchen notifications
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={preferences.marketingOptIn}
                  onChange={(e) => setPreferences(prev => ({ 
                    ...prev, 
                    marketingOptIn: e.target.checked 
                  }))}
                  disabled={isLoading}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
                <span className="ml-3 text-sm text-gray-700">
                  Receive La Carta product updates and tips
                </span>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 hover:shadow-lg"
            >
              {isLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Completing Setup...</span>
                </div>
              ) : (
                'Complete Setup & Access Dashboard'
              )}
            </button>
          </div>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-500">
            🔒 Your information is encrypted and secure. By completing setup, you agree to follow 
            restaurant policies and maintain the confidentiality of customer information.
          </p>
        </div>
      </div>
    </div>
  );
}