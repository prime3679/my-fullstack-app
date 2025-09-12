'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import Link from 'next/link';

export default function HomePage() {
  const { data: restaurantsData, isLoading, error } = useQuery({
    queryKey: ['restaurants'],
    queryFn: api.getRestaurants,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-amber-800">Loading restaurants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Unable to load restaurants
          </h2>
          <p className="text-gray-600 mb-4">
            Please make sure the backend server is running on port 3001
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const restaurants = restaurantsData?.data?.restaurants || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            La Carta
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 mb-2">
            Dinner, accelerated to delight
          </p>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Skip lines, savor time, smile bigger. Reserve your table and pre-order your meal 
            for the ultimate dining experience.
          </p>
        </div>

        {/* Restaurants Section */}
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-gray-900 mb-8 text-center">
            Available Restaurants
          </h2>
          
          {restaurants.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 text-6xl mb-4">🍽️</div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                No restaurants available
              </h3>
              <p className="text-gray-600">
                Please run the database seed command to add demo restaurants.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {restaurants.map((restaurant) => (
                <Link
                  key={restaurant.id}
                  href={`/restaurant/${restaurant.slug}`}
                  className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden group"
                >
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-amber-600 transition-colors">
                      {restaurant.name}
                    </h3>
                    
                    {restaurant.locations.length > 0 && (
                      <div className="text-gray-600 mb-4">
                        <div className="flex items-center text-sm">
                          <span className="mr-2">📍</span>
                          {restaurant.locations[0].address}
                        </div>
                        {restaurant.locations[0].phone && (
                          <div className="flex items-center text-sm mt-1">
                            <span className="mr-2">📞</span>
                            {restaurant.locations[0].phone}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500">
                        {restaurant.capacity ? 
                          `${restaurant.capacity.totalSeats} seats • ${restaurant.capacity.tableCount} tables` :
                          'View details'
                        }
                      </span>
                      <div className="text-amber-600 group-hover:text-amber-700">
                        →
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Features Section */}
        <div className="mt-20 grid gap-8 md:grid-cols-3 max-w-4xl mx-auto">
          <div className="text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Predictive Punctuality
            </h3>
            <p className="text-gray-600">
              Plates appear within 5 minutes of seating through ETA-driven firing
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-4xl mb-4">✨</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Invisible Effort
            </h3>
            <p className="text-gray-600">
              After first setup, it's taps and biometrics only
            </p>
          </div>
          
          <div className="text-center">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Smart Upsell
            </h3>
            <p className="text-gray-600">
              Chef-like suggestions that feel like insider tips
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}