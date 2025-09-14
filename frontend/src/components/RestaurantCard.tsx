'use client';

import { MapPin, Star, Clock } from 'lucide-react';

interface RestaurantCardProps {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    imageUrl?: string;
    cuisine?: string;
    rating?: number;
    priceRange?: string;
    address?: string;
    openTime?: string;
    closeTime?: string;
  };
  onSelect?: (restaurant: any) => void;
}

export default function RestaurantCard({ restaurant, onSelect }: RestaurantCardProps) {
  return (
    <div 
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect?.(restaurant)}
    >
      <div className="h-48 bg-gray-200">
        {restaurant.imageUrl && (
          <img 
            src={restaurant.imageUrl} 
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900">{restaurant.name}</h3>
          {restaurant.rating && (
            <div className="flex items-center text-yellow-500">
              <Star size={16} className="fill-current" />
              <span className="ml-1 text-sm text-gray-600">{restaurant.rating}</span>
            </div>
          )}
        </div>
        
        <div className="space-y-1 text-sm text-gray-600">
          {restaurant.cuisine && (
            <p>{restaurant.cuisine} {restaurant.priceRange && `• ${restaurant.priceRange}`}</p>
          )}
          
          {restaurant.address && (
            <div className="flex items-center">
              <MapPin size={14} className="mr-1" />
              <span>{restaurant.address}</span>
            </div>
          )}
          
          {(restaurant.openTime || restaurant.closeTime) && (
            <div className="flex items-center">
              <Clock size={14} className="mr-1" />
              <span>
                {restaurant.openTime && restaurant.closeTime 
                  ? `${restaurant.openTime} - ${restaurant.closeTime}`
                  : restaurant.openTime || restaurant.closeTime
                }
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}