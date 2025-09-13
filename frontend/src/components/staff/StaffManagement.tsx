'use client';

import React, { useState, useEffect } from 'react';
import { useStaff } from '../../contexts/StaffContext';
import { ClientLogger } from '../../lib/logger';

interface StaffMember {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

interface InviteStaffData {
  email: string;
  name: string;
  role: 'HOST' | 'SERVER' | 'EXPO' | 'KITCHEN' | 'MANAGER';
  phone?: string;
}

export function StaffManagement() {
  const { staffUser } = useStaff();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [inviteData, setInviteData] = useState<InviteStaffData>({
    email: '',
    name: '',
    role: 'HOST',
    phone: ''
  });

  // Check if user has permission to manage staff
  const canManageStaff = staffUser && ['MANAGER', 'ORG_ADMIN'].includes(staffUser.role);

  useEffect(() => {
    if (canManageStaff) {
      fetchStaffList();
    } else {
      setIsLoading(false);
    }
  }, [canManageStaff]);

  const fetchStaffList = async () => {
    try {
      const token = localStorage.getItem('staff_token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/staff/list`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
      } else {
        setError('Failed to load staff list');
      }
    } catch (error) {
      setError('Network error loading staff');
      ClientLogger.error('Error fetching staff list', { error });
    } finally {
      setIsLoading(false);
    }
  };

  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsInviting(true);

    try {
      const token = localStorage.getItem('staff_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/staff/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteData.email.trim(),
          name: inviteData.name.trim(),
          role: inviteData.role,
          phone: inviteData.phone.trim() || undefined
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(`${inviteData.name} has been invited as ${inviteData.role.toLowerCase()}. Temporary password: ${data.user.temporaryPassword}`);
        setInviteData({ email: '', name: '', role: 'HOST', phone: '' });
        setShowInviteForm(false);
        fetchStaffList(); // Refresh the list
        
        ClientLogger.businessEvent('STAFF_INVITED', {
          invitedUserId: data.user.id,
          role: inviteData.role,
          invitedBy: staffUser?.id
        });
      } else {
        setError(data.error || 'Failed to invite staff member');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      ClientLogger.error('Error inviting staff', { error });
    } finally {
      setIsInviting(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'HOST':
        return 'bg-blue-100 text-blue-800';
      case 'SERVER':
        return 'bg-green-100 text-green-800';
      case 'EXPO':
        return 'bg-yellow-100 text-yellow-800';
      case 'KITCHEN':
        return 'bg-orange-100 text-orange-800';
      case 'MANAGER':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'HOST':
        return '🏛️';
      case 'SERVER':
        return '🍽️';
      case 'EXPO':
        return '📋';
      case 'KITCHEN':
        return '👨‍🍳';
      case 'MANAGER':
        return '👔';
      default:
        return '👥';
    }
  };

  if (!canManageStaff) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-8 border border-gray-100 text-center">
        <div className="text-yellow-600 text-xl mb-4">⚠️</div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Access Restricted
        </h3>
        <p className="text-gray-600">
          Only managers can access staff management features.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Staff Management
            </h2>
            <p className="text-gray-600">
              Invite and manage your restaurant team
            </p>
            {staffUser?.restaurant && (
              <div className="inline-flex items-center bg-blue-50 px-3 py-1 rounded-lg text-sm text-blue-700 mt-2">
                <span className="mr-2">🏪</span>
                {staffUser.restaurant.name}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowInviteForm(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold transform hover:-translate-y-0.5 hover:shadow-lg"
          >
            + Invite Staff
          </button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          {success}
        </div>
      )}

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Invite Staff Member
            </h3>
            
            <form onSubmit={handleInviteStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={inviteData.name}
                  onChange={(e) => setInviteData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="john@restaurant.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role *
                </label>
                <select
                  value={inviteData.role}
                  onChange={(e) => setInviteData(prev => ({ ...prev, role: e.target.value as any }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="HOST">Host</option>
                  <option value="SERVER">Server</option>
                  <option value="EXPO">Expeditor</option>
                  <option value="KITCHEN">Kitchen</option>
                  <option value="MANAGER">Manager</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number (Optional)
                </label>
                <input
                  type="tel"
                  value={inviteData.phone}
                  onChange={(e) => setInviteData(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowInviteForm(false);
                    setError('');
                    setInviteData({ email: '', name: '', role: 'HOST', phone: '' });
                  }}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isInviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Staff List */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            Current Staff ({staff.length})
          </h3>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading staff...</p>
          </div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 text-4xl mb-4">👥</div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No staff members yet</h4>
            <p className="text-gray-600">Start by inviting your first team member!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {staff.map((member) => (
              <div key={member.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="text-2xl">
                      {getRoleIcon(member.role)}
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900">
                        {member.name}
                      </h4>
                      <p className="text-gray-600">{member.email}</p>
                      {member.phone && (
                        <p className="text-sm text-gray-500">{member.phone}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleColor(member.role)}`}>
                      {member.role.toLowerCase()}
                    </span>
                    <div className="text-sm text-gray-500">
                      Added {new Date(member.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}