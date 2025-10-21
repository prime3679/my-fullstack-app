'use client';

import { use, useEffect, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import MenuItemCard from '@/components/MenuItemCard';
import CartSidebar from '@/components/CartSidebar';
import MenuFilters from '@/components/MenuFilters';

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cuisine: string | null;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  course: string | null;
  allergens: string[];
  dietaryTags: string[];
  available: boolean;
  prepTimeMinutes: number | null;
  modifierGroups: Array<{
    id: string;
    name: string;
    required: boolean;
    options: Array<{
      id: string;
      name: string;
      priceAdjustment: number;
    }>;
  }>;
}

export default function OrderPage({
  params,
}: {
  params: Promise<{ restaurantSlug: string }>;
}) {
  const { restaurantSlug } = use(params);
  const { totalItems, totalPrice } = useCart();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);

  useEffect(() => {
    fetchRestaurantAndMenu();
  }, [restaurantSlug]);

  const fetchRestaurantAndMenu = async () => {
    try {
      setLoading(true);

      // Fetch restaurant
      const restaurantRes = await fetch(
        `http://localhost:3001/api/v1/restaurants?slug=${restaurantSlug}`
      );
      const restaurantData = await restaurantRes.json();

      if (!restaurantData.success || !restaurantData.data.length) {
        setError('Restaurant not found');
        return;
      }

      const rest = restaurantData.data[0];
      setRestaurant(rest);

      // Fetch menu
      const menuRes = await fetch(
        `http://localhost:3001/api/v1/menu/${rest.id}`
      );
      const menuData = await menuRes.json();

      if (menuData.success) {
        setMenuItems(menuData.data.items || []);
      }

      setError(null);
    } catch (err) {
      setError('Failed to load menu');
      console.error('Menu fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter menu items
  const filteredItems = menuItems.filter((item) => {
    // Search filter
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Course filter
    if (selectedCourse && item.course !== selectedCourse) {
      return false;
    }

    // Dietary filter
    if (selectedDietary.length > 0) {
      const hasAllTags = selectedDietary.every((tag) =>
        item.dietaryTags.includes(tag)
      );
      if (!hasAllTags) return false;
    }

    return item.available;
  });

  // Group items by course
  const itemsByCourse = filteredItems.reduce((acc, item) => {
    const course = item.course || 'Main';
    if (!acc[course]) {
      acc[course] = [];
    }
    acc[course].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const courseOrder = ['Appetizers', 'Salads', 'Main', 'Sides', 'Desserts', 'Beverages'];
  const sortedCourses = Object.keys(itemsByCourse).sort((a, b) => {
    const indexA = courseOrder.indexOf(a);
    const indexB = courseOrder.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error || 'Restaurant not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
              {restaurant.description && (
                <p className="text-sm text-gray-600 mt-1">{restaurant.description}</p>
              )}
              {restaurant.cuisine && (
                <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                  {restaurant.cuisine}
                </span>
              )}
            </div>

            {/* Cart Button */}
            <button
              onClick={() => setCartOpen(true)}
              className="relative bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              View Cart
              {totalItems > 0 && (
                <>
                  <span className="ml-2">({totalItems})</span>
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center">
                    {totalItems}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <MenuFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCourse={selectedCourse}
          onCourseChange={setSelectedCourse}
          selectedDietary={selectedDietary}
          onDietaryChange={setSelectedDietary}
          availableCourses={Object.keys(itemsByCourse)}
        />

        {/* Menu Items by Course */}
        {sortedCourses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No items match your filters</p>
          </div>
        ) : (
          sortedCourses.map((course) => (
            <div key={course} className="mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b pb-2">
                {course}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {itemsByCourse[course].map((item) => (
                  <MenuItemCard
                    key={item.id}
                    item={item}
                    onSelect={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        restaurantId={restaurant.id}
        restaurantName={restaurant.name}
      />

      {/* Item Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedItem.name}</h2>
                  <p className="text-lg text-green-600 font-semibold mt-1">
                    ${(selectedItem.price / 100).toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {selectedItem.description && (
                <p className="text-gray-600 mb-4">{selectedItem.description}</p>
              )}

              {selectedItem.allergens && selectedItem.allergens.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Allergens:</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.allergens.map((allergen) => (
                      <span
                        key={allergen}
                        className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded"
                      >
                        {allergen}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedItem.dietaryTags && selectedItem.dietaryTags.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.dietaryTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Simplified Add to Cart - full customization coming next */}
              <button
                onClick={() => {
                  const { addItem } = useCart();
                  addItem({
                    menuItemId: selectedItem.id,
                    name: selectedItem.name,
                    price: selectedItem.price,
                    quantity: 1,
                    modifiers: [],
                    course: selectedItem.course || undefined,
                  });
                  setSelectedItem(null);
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium"
              >
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
