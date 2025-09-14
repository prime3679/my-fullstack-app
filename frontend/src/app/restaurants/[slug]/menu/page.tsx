'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import MenuCategory from '@/components/menu/MenuCategory';
import Cart from '@/components/cart/Cart';

interface MenuItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  allergens?: string[];
  dietaryTags?: string[];
  calories?: number;
  is86?: boolean;
  isAvailable?: boolean;
}

interface MenuCategoryData {
  id: string;
  name: string;
  description?: string;
  displayOrder: number;
  items: MenuItem[];
}

interface MenuData {
  restaurant: {
    id: string;
    name: string;
    description?: string;
  };
  categories: MenuCategoryData[];
}

export default function MenuPage() {
  const params = useParams();
  const slug = params.slug as string;
  
  const [menu, setMenu] = useState<MenuData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);

  useEffect(() => {
    fetchMenu();
  }, [slug]);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      
      // For now, using mock data. Replace with actual API call
      const mockMenu: MenuData = {
        restaurant: {
          id: '1',
          name: 'The Grand Bistro',
          description: 'Contemporary American cuisine with a French twist'
        },
        categories: [
          {
            id: '1',
            name: 'Appetizers',
            description: 'Start your meal right',
            displayOrder: 1,
            items: [
              {
                id: '1',
                sku: 'APP001',
                name: 'Truffle Fries',
                description: 'Hand-cut fries with truffle oil and parmesan',
                price: 1200,
                imageUrl: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400',
                dietaryTags: ['Vegetarian'],
                calories: 420,
                isAvailable: true
              },
              {
                id: '2',
                sku: 'APP002',
                name: 'Caesar Salad',
                description: 'Crisp romaine, parmesan, croutons, classic dressing',
                price: 1400,
                imageUrl: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400',
                allergens: ['Gluten', 'Dairy', 'Eggs'],
                calories: 380,
                isAvailable: true
              },
              {
                id: '3',
                sku: 'APP003',
                name: 'Calamari',
                description: 'Crispy fried squid with marinara sauce',
                price: 1600,
                imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=400',
                allergens: ['Shellfish', 'Gluten'],
                calories: 520,
                is86: true
              }
            ]
          },
          {
            id: '2',
            name: 'Main Courses',
            description: 'Signature dishes from our chef',
            displayOrder: 2,
            items: [
              {
                id: '4',
                sku: 'MAIN001',
                name: 'Grilled Salmon',
                description: 'Atlantic salmon with lemon butter, seasonal vegetables',
                price: 2800,
                imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
                dietaryTags: ['Gluten-Free'],
                allergens: ['Fish'],
                calories: 650,
                isAvailable: true
              },
              {
                id: '5',
                sku: 'MAIN002',
                name: 'Ribeye Steak',
                description: '12oz prime cut, herb butter, garlic mashed potatoes',
                price: 4200,
                imageUrl: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400',
                dietaryTags: ['Gluten-Free'],
                calories: 890,
                isAvailable: true
              },
              {
                id: '6',
                sku: 'MAIN003',
                name: 'Pasta Primavera',
                description: 'Fresh vegetables, garlic, olive oil, parmesan',
                price: 2200,
                imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=400',
                dietaryTags: ['Vegetarian'],
                allergens: ['Gluten', 'Dairy'],
                calories: 580,
                isAvailable: true
              }
            ]
          },
          {
            id: '3',
            name: 'Desserts',
            description: 'Sweet endings',
            displayOrder: 3,
            items: [
              {
                id: '7',
                sku: 'DES001',
                name: 'Chocolate Lava Cake',
                description: 'Warm chocolate cake with molten center, vanilla ice cream',
                price: 900,
                imageUrl: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?w=400',
                allergens: ['Gluten', 'Dairy', 'Eggs'],
                calories: 480,
                isAvailable: true
              },
              {
                id: '8',
                sku: 'DES002',
                name: 'Crème Brûlée',
                description: 'Classic French custard with caramelized sugar',
                price: 800,
                imageUrl: 'https://images.unsplash.com/photo-1470124182917-cc6e71b22ecc?w=400',
                dietaryTags: ['Gluten-Free'],
                allergens: ['Dairy', 'Eggs'],
                calories: 320,
                isAvailable: true
              }
            ]
          }
        ]
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setMenu(mockMenu);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  const dietaryOptions = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free'];

  const filteredCategories = menu?.categories.map(category => ({
    ...category,
    items: category.items.filter(item => {
      // Search filter
      if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !item.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Dietary filter
      if (selectedDietary.length > 0) {
        const hasAllTags = selectedDietary.every(tag => 
          item.dietaryTags?.includes(tag)
        );
        if (!hasAllTags) return false;
      }
      
      return true;
    })
  })).filter(category => category.items.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Menu not found</p>
          <Link href={`/restaurants/${slug}`} className="text-blue-600 hover:underline mt-2 inline-block">
            Back to restaurant
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <Link
                  href={`/restaurants/${slug}`}
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft size={24} />
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{menu.restaurant.name}</h1>
                  {menu.restaurant.description && (
                    <p className="text-sm text-gray-600">{menu.restaurant.description}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Filter size={18} className="text-gray-500" />
                {dietaryOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => {
                      setSelectedDietary(prev =>
                        prev.includes(option)
                          ? prev.filter(o => o !== option)
                          : [...prev, option]
                      );
                    }}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedDietary.includes(option)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {option}
                  </button>
                ))}
                {selectedDietary.length > 0 && (
                  <button
                    onClick={() => setSelectedDietary([])}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredCategories && filteredCategories.length > 0 ? (
          filteredCategories.map(category => (
            <MenuCategory
              key={category.id}
              category={category}
              restaurantId={menu.restaurant.id}
            />
          ))
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No items match your filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedDietary([]);
              }}
              className="mt-2 text-blue-600 hover:text-blue-700"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Cart */}
      <Cart />
    </div>
  );
}