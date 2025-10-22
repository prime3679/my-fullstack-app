'use client';

import { useState, useEffect, use } from 'react';
import { MenuItemList } from '../../../../components/menu/MenuItemList';
import { CategoryManager } from '../../../../components/menu/CategoryManager';
import { ModifierGroupManager } from '../../../../components/menu/ModifierGroupManager';

type Tab = 'items' | 'categories' | 'modifiers';

export default function MenuManagementPage({ params }: { params: Promise<{ restaurantId: string }> }) {
  const { restaurantId } = use(params);
  const [activeTab, setActiveTab] = useState<Tab>('items');
  const [restaurant, setRestaurant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Fetch restaurant details
  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        const response = await fetch(`${getApiBase()}/restaurants/${restaurantId}`);
        if (response.ok) {
          const data = await response.json();
          setRestaurant(data.restaurant || data);
        }
      } catch (error) {
        console.error('Error fetching restaurant:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRestaurant();
  }, [restaurantId]);

  const tabs = [
    { id: 'items' as Tab, label: 'Menu Items', icon: '🍽️' },
    { id: 'categories' as Tab, label: 'Categories', icon: '📋' },
    { id: 'modifiers' as Tab, label: 'Modifiers', icon: '⚙️' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading menu management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Menu Management</h1>
          <p className="text-gray-600">
            {restaurant?.name || 'Restaurant'} - Manage menu items, categories, and modifiers
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'items' && <MenuItemList restaurantId={restaurantId} />}
            {activeTab === 'categories' && <CategoryManager restaurantId={restaurantId} />}
            {activeTab === 'modifiers' && <ModifierGroupManager restaurantId={restaurantId} />}
          </div>
        </div>
      </div>
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
