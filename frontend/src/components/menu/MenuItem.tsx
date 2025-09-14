'use client';

import { useState } from 'react';
import { Plus, Minus, Info } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';

interface MenuItemProps {
  item: {
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
  };
  restaurantId: string;
}

export default function MenuItem({ item, restaurantId }: MenuItemProps) {
  const [quantity, setQuantity] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const { addItem, setRestaurant } = useCartStore();

  const handleAddToCart = () => {
    setRestaurant(restaurantId);
    
    for (let i = 0; i < quantity; i++) {
      addItem({
        sku: item.sku,
        name: item.name,
        description: item.description,
        price: item.price,
        quantity: 1,
        modifiers: [],
        imageUrl: item.imageUrl
      });
    }
    
    // Reset quantity after adding
    setQuantity(1);
    
    // Show a toast or feedback (you can add a toast library later)
    console.log(`Added ${quantity} × ${item.name} to cart`);
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const isUnavailable = item.is86 || !item.isAvailable;

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md ${isUnavailable ? 'opacity-60' : ''}`}>
      {item.imageUrl && (
        <div className="relative h-48 bg-gray-100">
          <img
            src={item.imageUrl}
            alt={item.name}
            className="w-full h-full object-cover"
          />
          {isUnavailable && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <span className="text-white font-semibold text-lg">
                {item.is86 ? 'Out of Stock' : 'Currently Unavailable'}
              </span>
            </div>
          )}
        </div>
      )}
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
          <span className="text-lg font-bold text-blue-600">
            {formatPrice(item.price)}
          </span>
        </div>

        {item.description && (
          <p className="text-sm text-gray-600 mb-3">{item.description}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          {item.dietaryTags?.map(tag => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full"
            >
              {tag}
            </span>
          ))}
          {item.calories && (
            <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
              {item.calories} cal
            </span>
          )}
        </div>

        {item.allergens && item.allergens.length > 0 && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
          >
            <Info size={14} />
            <span>Allergen info</span>
          </button>
        )}

        {showDetails && item.allergens && (
          <div className="mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <strong className="text-yellow-800">Contains:</strong>{' '}
            <span className="text-yellow-700">{item.allergens.join(', ')}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!isUnavailable && (
            <>
              <div className="flex items-center border border-gray-200 rounded-lg">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-2 hover:bg-gray-50 transition-colors"
                  disabled={quantity <= 1}
                >
                  <Minus size={16} className={quantity <= 1 ? 'text-gray-300' : 'text-gray-600'} />
                </button>
                <span className="px-3 font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="p-2 hover:bg-gray-50 transition-colors"
                >
                  <Plus size={16} className="text-gray-600" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={18} />
                <span>Add to Cart</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}