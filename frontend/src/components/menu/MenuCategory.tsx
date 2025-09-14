'use client';

import MenuItem from './MenuItem';

interface MenuCategoryProps {
  category: {
    id: string;
    name: string;
    description?: string;
    displayOrder: number;
    items: Array<{
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
    }>;
  };
  restaurantId: string;
}

export default function MenuCategory({ category, restaurantId }: MenuCategoryProps) {
  const availableItems = category.items.filter(item => !item.is86 && item.isAvailable !== false);
  const unavailableItems = category.items.filter(item => item.is86 || item.isAvailable === false);

  return (
    <div className="mb-12">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">{category.name}</h2>
        {category.description && (
          <p className="text-gray-600">{category.description}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Show available items first */}
        {availableItems.map(item => (
          <MenuItem
            key={item.id}
            item={item}
            restaurantId={restaurantId}
          />
        ))}
        
        {/* Show unavailable items at the end */}
        {unavailableItems.map(item => (
          <MenuItem
            key={item.id}
            item={item}
            restaurantId={restaurantId}
          />
        ))}
      </div>

      {category.items.length === 0 && (
        <p className="text-gray-500 italic">No items available in this category</p>
      )}
    </div>
  );
}