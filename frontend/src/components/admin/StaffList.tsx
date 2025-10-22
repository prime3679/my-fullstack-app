'use client';

import { useState, useEffect } from 'react';

interface StaffMember {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  createdAt: string;
  _count: {
    events: number;
    auditLogs: number;
  };
}

interface Role {
  value: string;
  label: string;
  description: string;
}

export function StaffList({ restaurantId }: { restaurantId: string }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: ''
  });

  useEffect(() => {
    fetchStaff();
    fetchRoles();
  }, [restaurantId]);

  const fetchStaff = async () => {
    try {
      const response = await fetch(`${getApiBase()}/admin/staff/${restaurantId}`);
      if (response.ok) {
        const data = await response.json();
        setStaff(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching staff:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await fetch(`${getApiBase()}/admin/roles`);
      if (response.ok) {
        const data = await response.json();
        setRoles(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`${getApiBase()}/admin/staff/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          restaurantId
        })
      });

      if (response.ok) {
        await fetchStaff();
        setShowInviteModal(false);
        setFormData({ email: '', name: '', role: '' });
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to invite staff member');
      }
    } catch (error) {
      console.error('Error inviting staff:', error);
      alert('Failed to invite staff member');
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!confirm('Are you sure you want to change this staff member\'s role?')) return;

    try {
      const response = await fetch(`${getApiBase()}/admin/staff/${userId}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId,
          role: newRole
        })
      });

      if (response.ok) {
        await fetchStaff();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update role');
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;

    try {
      const response = await fetch(`${getApiBase()}/admin/staff/${userId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId })
      });

      if (response.ok) {
        await fetchStaff();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to remove staff member');
      }
    } catch (error) {
      console.error('Error removing staff:', error);
      alert('Failed to remove staff member');
    }
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      HOST: 'bg-blue-100 text-blue-800',
      SERVER: 'bg-green-100 text-green-800',
      EXPO: 'bg-purple-100 text-purple-800',
      KITCHEN: 'bg-orange-100 text-orange-800',
      MANAGER: 'bg-indigo-100 text-indigo-800',
      ORG_ADMIN: 'bg-red-100 text-red-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return <div className="text-center py-8">Loading staff...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
          <p className="text-sm text-gray-600">Manage staff access and permissions</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Invite Staff
        </button>
      </div>

      {/* Staff List */}
      <div className="space-y-3">
        {staff.map(member => (
          <div
            key={member.id}
            className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-4 flex-1">
              {/* Avatar */}
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                {member.name.charAt(0).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900">{member.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                    {member.role}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{member.email}</p>
                <div className="flex gap-4 text-xs text-gray-500 mt-1">
                  <span>Joined {formatDate(member.createdAt)}</span>
                  <span>{member._count.events} actions</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <select
                value={member.role}
                onChange={(e) => handleRoleChange(member.id, e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {roles.map(role => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleRemove(member.id)}
                className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {staff.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No staff members yet. Click "Invite Staff" to get started.
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">Invite Staff Member</h2>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="staff@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  placeholder="Full name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a role</option>
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label} - {role.description}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  An invitation email will be sent to this address with instructions to set up their account.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Send Invitation
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function getApiBase() {
  const rawBase = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  const fallback = 'http://localhost:3001/api/v1';
  const baseWithoutTrailingSlash = (rawBase || fallback).replace(/\/+$/, '');
  if (baseWithoutTrailingSlash.endsWith('/api/v1')) {
    return baseWithoutTrailingSlash;
  }
  return `${baseWithoutTrailingSlash}/api/v1`;
}
