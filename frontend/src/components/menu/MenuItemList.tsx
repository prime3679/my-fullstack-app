'use client';

import { useState, useEffect } from 'react';

interface MenuItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  prepTimeMinutes?: number;
  isAvailable: boolean;
  is86: boolean;
  dietaryTags: string[];
  sortOrder: number;
  category: {
    id: string;
    name: string;
  };
}

interface Category {
  id: string;
  name: string;
}

export function MenuItemList({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    price: '',
    categoryId: '',
    prepTimeMinutes: '',
    imageUrl: '',
    dietaryTags: [] as string[],
  });

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, [restaurantId]);

  const fetchItems = async () => {
    try {
      const response = await fetch(`${getApiBase()}/admin/menu/items/${restaurantId}?includeInactive=true`);
      if (response.ok) {
        const data = await response.json();
        setItems(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch(`${getApiBase()}/admin/menu/categories/${restaurantId}`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleCreate = () => {
    setEditingItem(null);
    setFormData({
      sku: '',
      name: '',
      description: '',
      price: '',
      categoryId: categories[0]?.id || '',
      prepTimeMinutes: '',
      imageUrl: '',
      dietaryTags: [],
    });
    setShowEditor(true);
  };

  const handleEdit = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      sku: item.sku,
      name: item.name,
      description: item.description || '',
      price: (item.price / 100).toString(),
      categoryId: item.category.id,
      prepTimeMinutes: item.prepTimeMinutes?.toString() || '',
      imageUrl: item.imageUrl || '',
      dietaryTags: item.dietaryTags || [],
    });
    setShowEditor(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const payload = {
      restaurantId,
      sku: formData.sku,
      name: formData.name,
      description: formData.description || undefined,
      price: Math.round(parseFloat(formData.price) * 100),
      categoryId: formData.categoryId,
      prepTimeMinutes: formData.prepTimeMinutes ? parseInt(formData.prepTimeMinutes) : undefined,
      imageUrl: formData.imageUrl || undefined,
      dietaryTags: formData.dietaryTags,
    };

    try {
      const url = editingItem
        ? `${getApiBase()}/admin/menu/items/${editingItem.id}`
        : `${getApiBase()}/admin/menu/items`;

      const response = await fetch(url, {
        method: editingItem ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        await fetchItems();
        setShowEditor(false);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to save item');
      }
    } catch (error) {
      console.error('Error saving item:', error);
      alert('Failed to save item');
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetch(`${getApiBase()}/admin/menu/items/${itemId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchItems();
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const toggleAvailability = async (item: MenuItem) => {
    try {
      const response = await fetch(`${getApiBase()}/admin/menu/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });

      if (response.ok) {
        await fetchItems();
      }
    } catch (error) {
      console.error('Error toggling availability:', error);
    }
  };

  const toggle86Status = async (item: MenuItem) => {
    try {
      const response = await fetch(`${getApiBase()}/admin/menu/items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is86: !item.is86 }),
      });

      if (response.ok) {
        await fetchItems();
      }
    } catch (error) {
      console.error('Error toggling 86 status:', error);
    }
  };

  const toggleDietaryTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      dietaryTags: prev.dietaryTags.includes(tag)
        ? prev.dietaryTags.filter(t => t !== tag)
        : [...prev.dietaryTags, tag],
    }));
  };

  const filteredItems = items.filter(item => {
    const matchesCategory = !filterCategory || item.category.id === filterCategory;
    const matchesSearch = !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatPrice = (cents: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
  };

  const dietaryOptions = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Low-Carb'];

  if (loading) {
    return <div className="text-center py-8">Loading menu items...</div>;
  }

  return (
    <div>
      {/* Header with Actions */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4">
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleCreate}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Item
        </button>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map(item => (
          <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{item.name}</h3>
                <p className="text-sm text-gray-600">{item.category.name}</p>
              </div>
              <span className="text-lg font-bold text-gray-900">{formatPrice(item.price)}</span>
            </div>

            {item.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">{item.description}</p>
            )}

            <div className="flex flex-wrap gap-1 mb-3">
              {item.dietaryTags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                  {tag}
                </span>
              ))}
              {item.is86 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">86'd</span>
              )}
              {!item.isAvailable && (
                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">Unavailable</span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(item)}
                className="flex-1 px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200"
              >
                Edit
              </button>
              <button
                onClick={() => toggleAvailability(item)}
                className={`px-3 py-1 rounded text-sm ${
                  item.isAvailable
                    ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                    : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
              >
                {item.isAvailable ? 'Disable' : 'Enable'}
              </button>
              <button
                onClick={() => toggle86Status(item)}
                className={`px-3 py-1 rounded text-sm ${
                  item.is86
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                }`}
              >
                {item.is86 ? 'Un-86' : '86'}
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm hover:bg-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          No menu items found. Click "Add Item" to create one.
        </div>
      )}

      {/* Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">
              {editingItem ? 'Edit Menu Item' : 'Create Menu Item'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU *</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    disabled={!!editingItem}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prep Time (min)</label>
                  <input
                    type="number"
                    value={formData.prepTimeMinutes}
                    onChange={(e) => setFormData({ ...formData, prepTimeMinutes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Dietary Tags</label>
                <div className="flex flex-wrap gap-2">
                  {dietaryOptions.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleDietaryTag(tag)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        formData.dietaryTags.includes(tag)
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {editingItem ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditor(false)}
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
