'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import Link from 'next/link';
import { useState } from 'react';
import { LandingHero } from '../components/LandingHero';
import { useAuth } from '../contexts/AuthContext';

interface RestaurantCardProps {
  restaurant: any;
  partySize: number;
  selectedDate: string;
  selectedTime: string;
}

function RestaurantCard({ restaurant, partySize, selectedDate, selectedTime }: RestaurantCardProps) {
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [availability, setAvailability] = useState<{ 
    availableSlots: Array<{ time: string; available: boolean; capacity: number }>; 
    hasAvailability: boolean;
    message?: string;
  } | null>(null);

  const checkAvailability = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsCheckingAvailability(true);
    
    try {
      const response = await api.checkAvailability(restaurant.id, partySize, selectedDate);
      const availableSlots = response.data.availableSlots || [];
      const hasAvailability = availableSlots.some(slot => slot.available);
      
      setAvailability({
        availableSlots,
        hasAvailability,
        message: hasAvailability ? `${availableSlots.filter(s => s.available).length} time slots available` : 'No availability found'
      });
    } catch (error) {
      setAvailability({
        availableSlots: [],
        hasAvailability: false,
        message: 'Unable to check availability'
      });
    } finally {
      setIsCheckingAvailability(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      <div className="p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
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

        <div className="mb-4">
          <span className="text-sm text-gray-500">
            {restaurant.locations[0]?._count?.tables} tables available
          </span>
        </div>

        {/* Availability Status */}
        {availability && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            availability.hasAvailability 
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {availability.hasAvailability ? '✅ Available' : '❌ No Availability'}
            {availability.message && (
              <div className="text-xs mt-1 opacity-80">{availability.message}</div>
            )}
            
            {/* Show available time slots */}
            {availability.hasAvailability && availability.availableSlots.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {availability.availableSlots
                  .filter(slot => slot.available)
                  .slice(0, 4)
                  .map(slot => {
                    const time = new Date(slot.time).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    });
                    return (
                      <span key={slot.time} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        {time}
                      </span>
                    );
                  })}
                {availability.availableSlots.filter(s => s.available).length > 4 && (
                  <span className="text-xs text-green-600">+{availability.availableSlots.filter(s => s.available).length - 4} more</span>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={checkAvailability}
            disabled={isCheckingAvailability}
            className="flex-1 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isCheckingAvailability ? 'Checking...' : 'Check Availability'}
          </button>
          
          <Link
            href={`/restaurant/${restaurant.slug}/reserve?date=${selectedDate}&time=${selectedTime}&party=${partySize}`}
            className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors text-center text-sm font-medium"
          >
            Reserve →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [selectedDate, setSelectedDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedTime, setSelectedTime] = useState('19:00');

  // Must call useQuery before any conditional returns
  const { data: restaurantsData, isLoading, error } = useQuery({
    queryKey: ['restaurants', searchQuery, selectedLocation],
    queryFn: () => searchQuery.trim() 
      ? api.searchRestaurants(searchQuery, selectedLocation || undefined)
      : api.getRestaurants(),
    enabled: !!user, // Only run query if user is authenticated
  });

  // If user is not authenticated, show the landing hero first
  if (!user) {
    return (
      <div>
        <LandingHero />
        {/* Could add additional sections here for non-authenticated users */}
      </div>
    );
  }

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
      {/* Navigation Header */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              La Carta
            </Link>
            <div className="flex items-center space-x-4">
              <Link
                href="/staff"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 text-sm font-medium transition-colors"
              >
                Staff Portal
              </Link>
              {user && (
                <div className="text-sm text-gray-600">
                  Welcome, {user.name}
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            La Carta
          </h1>
          <p className="text-xl md:text-2xl text-gray-700 mb-2">
            Dinner, accelerated to delight
          </p>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            Skip lines, savor time, smile bigger. Reserve your table and pre-order your meal 
            for the ultimate dining experience.
          </p>

          {/* Search & Filter Section */}
          <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-lg p-6 mb-12">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              {/* Search */}
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Restaurant or Cuisine
                </label>
                <input
                  type="text"
                  placeholder="Search restaurants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              {/* Party Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Party Size
                </label>
                <select
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(size => (
                    <option key={size} value={size}>
                      {size} {size === 1 ? 'person' : 'people'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time
                </label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                >
                  <option value="17:00">5:00 PM</option>
                  <option value="17:30">5:30 PM</option>
                  <option value="18:00">6:00 PM</option>
                  <option value="18:30">6:30 PM</option>
                  <option value="19:00">7:00 PM</option>
                  <option value="19:30">7:30 PM</option>
                  <option value="20:00">8:00 PM</option>
                  <option value="20:30">8:30 PM</option>
                  <option value="21:00">9:00 PM</option>
                </select>
              </div>
            </div>
          </div>
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
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  partySize={partySize}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                />
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