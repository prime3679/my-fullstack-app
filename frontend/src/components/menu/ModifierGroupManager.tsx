'use client';

import { useState, useEffect } from 'react';

interface Modifier {
  id: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
}

interface ModifierGroup {
  id: string;
  name: string;
  description?: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  modifiers: Modifier[];
  _count?: {
    menuItems: number;
  };
}

export function ModifierGroupManager({ restaurantId }: { restaurantId: string }) {
  const [groups, setGroups] = useState<ModifierGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGroupEditor, setShowGroupEditor] = useState(false);
  const [showModifierEditor, setShowModifierEditor] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ModifierGroup | null>(null);
  const [editingModifier, setEditingModifier] = useState<Modifier | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    minSelections: '0',
    maxSelections: '1',
    isRequired: false,
  });

  const [modifierFormData, setModifierFormData] = useState({
    name: '',
    description: '',
    price: '',
  });

  useEffect(() => {
    fetchGroups();
  }, [restaurantId]);

  const fetchGroups = async () => {
    try {
      const response = await fetch(`${getApiBase()}/admin/menu/modifier-groups/${restaurantId}`);
      if (response.ok) {
        const data = await response.json();
        setGroups(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching modifier groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // Group handlers
  const handleCreateGroup = () => {
    setEditingGroup(null);
    setGroupFormData({
      name: '',
      description: '',
      minSelections: '0',
      maxSelections: '1',
      isRequired: false,
    });
    setShowGroupEditor(true);
  };

  const handleEditGroup = (group: ModifierGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      description: group.description || '',
      minSelections: group.minSelections.toString(),
      maxSelections: group.maxSelections.toString(),
      isRequired: group.isRequired,
    });
    setShowGroupEditor(true);
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      restaurantId,
      name: groupFormData.name,
      description: groupFormData.description || undefined,
      minSelections: parseInt(groupFormData.minSelections),
      maxSelections: parseInt(groupFormData.maxSelections),
      isRequired: groupFormData.isRequired,
    };

    try {
      const url = editingGroup
        ? `${getApiBase()}/admin/menu/modifier-groups/${editingGroup.id}`
        : `${getApiBase()}/admin/menu/modifier-groups`;

      const response = await fetch(url, {
        method: editingGroup ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchGroups();
        setShowGroupEditor(false);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to save modifier group');
      }
    } catch (error) {
      console.error('Error saving modifier group:', error);
      alert('Failed to save modifier group');
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Are you sure you want to delete this modifier group?')) return;

    try {
      const response = await fetch(`${getApiBase()}/admin/menu/modifier-groups/${groupId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchGroups();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to delete modifier group');
      }
    } catch (error) {
      console.error('Error deleting modifier group:', error);
    }
  };

  // Modifier handlers
  const handleCreateModifier = (groupId: string) => {
    setSelectedGroupId(groupId);
    setEditingModifier(null);
    setModifierFormData({
      name: '',
      description: '',
      price: '',
    });
    setShowModifierEditor(true);
  };

  const handleEditModifier = (groupId: string, modifier: Modifier) => {
    setSelectedGroupId(groupId);
    setEditingModifier(modifier);
    setModifierFormData({
      name: modifier.name,
      description: modifier.description || '',
      price: (modifier.price / 100).toString(),
    });
    setShowModifierEditor(true);
  };

  const handleModifierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGroupId) return;

    const payload = {
      modifierGroupId: selectedGroupId,
      name: modifierFormData.name,
      description: modifierFormData.description || undefined,
      price: Math.round(parseFloat(modifierFormData.price || '0') * 100),
    };

    try {
      const url = editingModifier
        ? `${getApiBase()}/admin/menu/modifiers/${editingModifier.id}`
        : `${getApiBase()}/admin/menu/modifiers`;

      const response = await fetch(url, {
        method: editingModifier ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchGroups();
        setShowModifierEditor(false);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to save modifier');
      }
    } catch (error) {
      console.error('Error saving modifier:', error);
      alert('Failed to save modifier');
    }
  };

  const handleDeleteModifier = async (modifierId: string) => {
    if (!confirm('Are you sure you want to delete this modifier?')) return;

    try {
      const response = await fetch(`${getApiBase()}/admin/menu/modifiers/${modifierId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchGroups();
      }
    } catch (error) {
      console.error('Error deleting modifier:', error);
    }
  };

  const toggleModifierAvailability = async (modifier: Modifier) => {
    try {
      const response = await fetch(`${getApiBase()}/admin/menu/modifiers/${modifier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !modifier.isAvailable }),
      });

      if (response.ok) {
        await fetchGroups();
      }
    } catch (error) {
      console.error('Error toggling modifier availability:', error);
    }
  };

  const formatPrice = (cents: number) => {
    if (cents === 0) return 'No charge';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };

  if (loading) {
    return <div className="text-center py-8">Loading modifier groups...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Modifier Groups</h2>
          <p className="text-sm text-gray-600">Create customization options for menu items</p>
        </div>
        <button
          onClick={handleCreateGroup}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + Add Group
        </button>
      </div>

      {/* Groups List */}
      <div className="space-y-4">
        {groups.map(group => (
          <div key={group.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            {/* Group Header */}
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    {expandedGroups.has(group.id) ? '▼' : '▶'}
                  </button>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{group.name}</h3>
                    {group.description && (
                      <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                    )}
                    <div className="flex gap-4 text-xs text-gray-500 mt-2">
                      <span>Min: {group.minSelections}</span>
                      <span>Max: {group.maxSelections}</span>
                      {group.isRequired && <span className="text-orange-600 font-medium">Required</span>}
                      <span>{group.modifiers.length} modifiers</span>
                      <span>Used in {group._count?.menuItems || 0} items</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEditGroup(group)}
                    className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                  >
                    Edit Group
                  </button>
                  <button
                    onClick={() => handleCreateModifier(group.id)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200"
                  >
                    + Add Modifier
                  </button>
                  <button
                    onClick={() => handleDeleteGroup(group.id)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>

            {/* Modifiers List */}
            {expandedGroups.has(group.id) && (
              <div className="p-4">
                {group.modifiers.length > 0 ? (
                  <div className="space-y-2">
                    {group.modifiers.map(modifier => (
                      <div
                        key={modifier.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{modifier.name}</span>
                            <span className="text-sm text-gray-600">{formatPrice(modifier.price)}</span>
                            {!modifier.isAvailable && (
                              <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded">Unavailable</span>
                            )}
                          </div>
                          {modifier.description && (
                            <p className="text-sm text-gray-600 mt-1">{modifier.description}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditModifier(group.id, modifier)}
                            className="px-3 py-1 bg-white border border-gray-300 text-gray-700 rounded text-sm hover:bg-gray-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleModifierAvailability(modifier)}
                            className={`px-3 py-1 rounded text-sm ${
                              modifier.isAvailable
                                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {modifier.isAvailable ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => handleDeleteModifier(modifier.id)}
                            className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No modifiers yet. Click "Add Modifier" to create one.
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {groups.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No modifier groups found. Click "Add Group" to create one.
        </div>
      )}

      {/* Group Editor Modal */}
      {showGroupEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {editingGroup ? 'Edit Modifier Group' : 'Create Modifier Group'}
            </h2>

            <form onSubmit={handleGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  required
                  placeholder="e.g., Size, Temperature, Add-ons"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Selections</label>
                  <input
                    type="number"
                    min="0"
                    value={groupFormData.minSelections}
                    onChange={(e) => setGroupFormData({ ...groupFormData, minSelections: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Selections</label>
                  <input
                    type="number"
                    min="1"
                    value={groupFormData.maxSelections}
                    onChange={(e) => setGroupFormData({ ...groupFormData, maxSelections: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={groupFormData.isRequired}
                    onChange={(e) => setGroupFormData({ ...groupFormData, isRequired: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Required selection</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingGroup ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowGroupEditor(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modifier Editor Modal */}
      {showModifierEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-4">
              {editingModifier ? 'Edit Modifier' : 'Create Modifier'}
            </h2>

            <form onSubmit={handleModifierSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={modifierFormData.name}
                  onChange={(e) => setModifierFormData({ ...modifierFormData, name: e.target.value })}
                  required
                  placeholder="e.g., Large, Extra Hot, Add Bacon"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={modifierFormData.description}
                  onChange={(e) => setModifierFormData({ ...modifierFormData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={modifierFormData.price}
                  onChange={(e) => setModifierFormData({ ...modifierFormData, price: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Leave at 0.00 for no additional charge</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingModifier ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModifierEditor(false)}
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
