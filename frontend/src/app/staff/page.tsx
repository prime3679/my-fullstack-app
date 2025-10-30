'use client';

import React, { useState } from 'react';
import { StaffProvider, useStaff } from '../../contexts/StaffContext';
import { StaffLogin } from '../../components/staff/StaffLogin';
import { StaffOnboardingWizard } from '../../components/staff/StaffOnboardingWizard';
import { StaffManagement } from '../../components/staff/StaffManagement';
import { ClientLogger } from '../../lib/logger';

function StaffPortalContent() {
  const { staffUser, isLoading, logout } = useStaff();
  const [showOnboarding, setShowOnboarding] = useState(false);

  React.useEffect(() => {
    ClientLogger.pageView('/staff');
  }, []);

  // Check if user needs onboarding (has temporary password or incomplete setup)
  const needsOnboarding = staffUser && (!staffUser.phone || showOnboarding);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  const handleLoginSuccess = () => {
    // Check if user needs onboarding after login
    if (staffUser && !staffUser.phone) {
      setShowOnboarding(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-800">Loading staff portal...</p>
        </div>
      </div>
    );
  }

  // Not authenticated - show login
  if (!staffUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
              La Carta Staff Portal
            </h1>
            <p className="text-gray-600">
              Access your restaurant dashboard and manage operations
            </p>
          </div>

          <StaffLogin onSuccess={handleLoginSuccess} />
        </div>
      </div>
    );
  }

  // Authenticated but needs onboarding
  if (needsOnboarding) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <StaffOnboardingWizard onComplete={handleOnboardingComplete} />
        </div>
      </div>
    );
  }

  // Authenticated and onboarded - show main dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header with user info and logout */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="text-3xl">
                {staffUser.role === 'HOST' && '🏛️'}
                {staffUser.role === 'SERVER' && '🍽️'}
                {staffUser.role === 'EXPO' && '📋'}
                {staffUser.role === 'KITCHEN' && '👨‍🍳'}
                {staffUser.role === 'MANAGER' && '👔'}
                {!['HOST', 'SERVER', 'EXPO', 'KITCHEN', 'MANAGER'].includes(staffUser.role) && '👥'}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Welcome back, {staffUser.name}
                </h1>
                <div className="flex items-center space-x-4 mt-1">
                  <span className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    {staffUser.role.toLowerCase()}
                  </span>
                  {staffUser.restaurant && (
                    <span className="inline-flex items-center text-gray-600 text-sm">
                      <span className="mr-1">🏪</span>
                      {staffUser.restaurant.name}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowOnboarding(true)}
                className="text-gray-600 hover:text-gray-800 px-3 py-2 text-sm font-medium"
              >
                Settings
              </button>
              <button
                onClick={logout}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="grid gap-6">
          {/* Role-specific quick actions */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {staffUser.role === 'HOST' && (
                <>
                  <button 
                    onClick={() => window.location.href = '/staff/reservations'}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">📋</div>
                    <div className="font-medium">View Reservations</div>
                  </button>
                  <button className="bg-green-50 hover:bg-green-100 text-green-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">✅</div>
                    <div className="font-medium">Check-in Guest</div>
                  </button>
                  <button className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">⏰</div>
                    <div className="font-medium">Manage Wait List</div>
                  </button>
                </>
              )}
              
              {staffUser.role === 'SERVER' && (
                <>
                  <button className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">🍽️</div>
                    <div className="font-medium">My Tables</div>
                  </button>
                  <button className="bg-green-50 hover:bg-green-100 text-green-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">📱</div>
                    <div className="font-medium">Take Order</div>
                  </button>
                  <button className="bg-purple-50 hover:bg-purple-100 text-purple-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">💳</div>
                    <div className="font-medium">Process Payment</div>
                  </button>
                </>
              )}
              
              {staffUser.role === 'KITCHEN' && (
                <>
                  <button 
                    onClick={() => window.location.href = '/kitchen'}
                    className="bg-orange-50 hover:bg-orange-100 text-orange-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">📋</div>
                    <div className="font-medium">Kitchen Dashboard</div>
                  </button>
                  <button className="bg-red-50 hover:bg-red-100 text-red-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">🔥</div>
                    <div className="font-medium">Fire Orders</div>
                  </button>
                  <button className="bg-green-50 hover:bg-green-100 text-green-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">✅</div>
                    <div className="font-medium">Mark Ready</div>
                  </button>
                </>
              )}
              
              {staffUser.role === 'MANAGER' && (
                <>
                  <button 
                    onClick={() => window.location.href = '/staff/reservations'}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">📋</div>
                    <div className="font-medium">Reservations</div>
                  </button>
                  <button 
                    onClick={() => window.location.href = '/kitchen'}
                    className="bg-orange-50 hover:bg-orange-100 text-orange-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">👨‍🍳</div>
                    <div className="font-medium">Kitchen</div>
                  </button>
                  <button className="bg-purple-50 hover:bg-purple-100 text-purple-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">📊</div>
                    <div className="font-medium">Analytics</div>
                  </button>
                  <button className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-4 rounded-lg text-center transition-colors">
                    <div className="text-2xl mb-2">👥</div>
                    <div className="font-medium">Staff Management</div>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Staff Management (for managers only) */}
          {['MANAGER', 'ORG_ADMIN'].includes(staffUser.role) && (
            <StaffManagement />
          )}

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Recent Activity
            </h2>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-green-600">✅</div>
                <div>
                  <div className="font-medium">System operational</div>
                  <div className="text-sm text-gray-600">All systems running normally</div>
                </div>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-blue-600">🔄</div>
                <div>
                  <div className="font-medium">Connected to POS system</div>
                  <div className="text-sm text-gray-600">Real-time order sync active</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StaffPortal() {
  return (
    <StaffProvider>
      <StaffPortalContent />
    </StaffProvider>
  );
}