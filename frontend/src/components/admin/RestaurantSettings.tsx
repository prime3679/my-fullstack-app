'use client';

import { useState, useEffect } from 'react';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  taxRate: number;
  posType?: string;
  openTableId?: string;
  settingsJson?: any;
  locations?: Array<{
    id: string;
    address: string;
    phone?: string;
    _count: {
      tables: number;
    };
  }>;
}

export function RestaurantSettings({
  restaurantId,
  restaurant: initialRestaurant
}: {
  restaurantId: string;
  restaurant: Restaurant | null;
}) {
  const [restaurant, setRestaurant] = useState(initialRestaurant);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'basic' | 'operations' | 'pos'>('basic');

  const [basicInfo, setBasicInfo] = useState({
    name: restaurant?.name || '',
    timezone: restaurant?.timezone || 'America/New_York',
    currency: restaurant?.currency || 'USD',
    taxRate: ((restaurant?.taxRate || 0) * 100).toString()
  });

  const [operationalSettings, setOperationalSettings] = useState({
    maxPartySize: '8',
    minPartySize: '1',
    bookingWindowDays: '30',
    timeSlotDuration: '30',
    requirePrePayment: false
  });

  const [posSettings, setPosSettings] = useState({
    provider: restaurant?.posType || 'none',
    enabled: false,
    autoSync: false
  });

  useEffect(() => {
    if (restaurant?.settingsJson) {
      const settings = restaurant.settingsJson;
      if (settings.reservationRules) {
        setOperationalSettings({
          maxPartySize: settings.reservationRules.maxPartySize?.toString() || '8',
          minPartySize: settings.reservationRules.minPartySize?.toString() || '1',
          bookingWindowDays: settings.reservationRules.bookingWindowDays?.toString() || '30',
          timeSlotDuration: settings.reservationRules.timeSlotDuration?.toString() || '30',
          requirePrePayment: settings.reservationRules.requirePrePayment || false
        });
      }
      if (settings.posIntegration) {
        setPosSettings({
          provider: settings.posIntegration.provider || 'none',
          enabled: settings.posIntegration.enabled || false,
          autoSync: settings.posIntegration.autoSync || false
        });
      }
    }
  }, [restaurant]);

  const handleSaveBasicInfo = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${getApiBase()}/admin/restaurant/${restaurantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: basicInfo.name,
          timezone: basicInfo.timezone,
          currency: basicInfo.currency,
          taxRate: parseFloat(basicInfo.taxRate) / 100
        })
      });

      if (response.ok) {
        const data = await response.json();
        setRestaurant(data.data);
        alert('Basic information updated successfully');
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOperationalSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${getApiBase()}/admin/settings/${restaurantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            reservationRules: {
              maxPartySize: parseInt(operationalSettings.maxPartySize),
              minPartySize: parseInt(operationalSettings.minPartySize),
              bookingWindowDays: parseInt(operationalSettings.bookingWindowDays),
              timeSlotDuration: parseInt(operationalSettings.timeSlotDuration),
              requirePrePayment: operationalSettings.requirePrePayment
            }
          }
        })
      });

      if (response.ok) {
        alert('Operational settings updated successfully');
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePosSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${getApiBase()}/admin/settings/${restaurantId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            posIntegration: posSettings
          }
        })
      });

      if (response.ok) {
        // Also update the posType field
        await fetch(`${getApiBase()}/admin/restaurant/${restaurantId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            posType: posSettings.provider !== 'none' ? posSettings.provider : null
          })
        });
        alert('POS settings updated successfully');
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const timezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Phoenix',
    'America/Anchorage',
    'Pacific/Honolulu'
  ];

  const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];

  return (
    <div>
      {/* Section Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveSection('basic')}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeSection === 'basic'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Basic Information
          </button>
          <button
            onClick={() => setActiveSection('operations')}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeSection === 'operations'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Operations
          </button>
          <button
            onClick={() => setActiveSection('pos')}
            className={`px-4 py-2 border-b-2 font-medium text-sm ${
              activeSection === 'pos'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            POS Integration
          </button>
        </nav>
      </div>

      {/* Basic Information */}
      {activeSection === 'basic' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Restaurant Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  value={basicInfo.name}
                  onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <select
                  value={basicInfo.timezone}
                  onChange={(e) => setBasicInfo({ ...basicInfo, timezone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {timezones.map(tz => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <select
                  value={basicInfo.currency}
                  onChange={(e) => setBasicInfo({ ...basicInfo, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {currencies.map(curr => (
                    <option key={curr} value={curr}>{curr}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={basicInfo.taxRate}
                  onChange={(e) => setBasicInfo({ ...basicInfo, taxRate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <button
              onClick={handleSaveBasicInfo}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Basic Information'}
            </button>
          </div>

          {/* Locations */}
          {restaurant?.locations && restaurant.locations.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Locations</h3>
              <div className="space-y-3">
                {restaurant.locations.map(location => (
                  <div key={location.id} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{location.address}</p>
                        {location.phone && (
                          <p className="text-sm text-gray-600">{location.phone}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {location._count.tables} tables
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Operations */}
      {activeSection === 'operations' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reservation Rules</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Minimum Party Size
                </label>
                <input
                  type="number"
                  min="1"
                  value={operationalSettings.minPartySize}
                  onChange={(e) => setOperationalSettings({ ...operationalSettings, minPartySize: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Party Size
                </label>
                <input
                  type="number"
                  min="1"
                  value={operationalSettings.maxPartySize}
                  onChange={(e) => setOperationalSettings({ ...operationalSettings, maxPartySize: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Booking Window (days ahead)
                </label>
                <input
                  type="number"
                  min="1"
                  value={operationalSettings.bookingWindowDays}
                  onChange={(e) => setOperationalSettings({ ...operationalSettings, bookingWindowDays: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Slot Duration (minutes)
                </label>
                <select
                  value={operationalSettings.timeSlotDuration}
                  onChange={(e) => setOperationalSettings({ ...operationalSettings, timeSlotDuration: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="60">60 minutes</option>
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={operationalSettings.requirePrePayment}
                  onChange={(e) => setOperationalSettings({ ...operationalSettings, requirePrePayment: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Require pre-payment for reservations
                </span>
              </label>
            </div>

            <button
              onClick={handleSaveOperationalSettings}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save Operational Settings'}
            </button>
          </div>
        </div>
      )}

      {/* POS Integration */}
      {activeSection === 'pos' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">POS Integration</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  POS Provider
                </label>
                <select
                  value={posSettings.provider}
                  onChange={(e) => setPosSettings({ ...posSettings, provider: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">None</option>
                  <option value="toast">Toast POS</option>
                  <option value="square">Square POS</option>
                </select>
              </div>

              {posSettings.provider !== 'none' && (
                <>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={posSettings.enabled}
                        onChange={(e) => setPosSettings({ ...posSettings, enabled: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Enable POS integration
                      </span>
                    </label>
                  </div>

                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={posSettings.autoSync}
                        onChange={(e) => setPosSettings({ ...posSettings, autoSync: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Automatically sync menu and orders
                      </span>
                    </label>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      To complete the POS integration, you'll need to connect your {posSettings.provider} account.
                      Contact support for integration credentials.
                    </p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleSavePosSettings}
              disabled={saving}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? 'Saving...' : 'Save POS Settings'}
            </button>
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
