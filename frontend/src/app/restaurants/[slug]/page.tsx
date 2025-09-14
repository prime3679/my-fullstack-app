'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, MapPin, Phone, Star, ChefHat, ShoppingBag } from 'lucide-react';

export default function RestaurantPage() {
  const params = useParams();
  const slug = params.slug as string;

  // Mock data - replace with API call
  const restaurant = {
    id: '1',
    name: 'The Grand Bistro',
    slug: slug,
    description: 'Contemporary American cuisine with a French twist. Experience fine dining in an elegant atmosphere with dishes crafted from locally-sourced ingredients.',
    image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
    rating: 4.7,
    reviewCount: 328,
    priceRange: '$$$',
    cuisine: 'American, French',
    address: '123 Main Street, Downtown',
    phone: '(555) 123-4567',
    hours: {
      monday: '5:00 PM - 10:00 PM',
      tuesday: '5:00 PM - 10:00 PM',
      wednesday: '5:00 PM - 10:00 PM',
      thursday: '5:00 PM - 10:00 PM',
      friday: '5:00 PM - 11:00 PM',
      saturday: '4:00 PM - 11:00 PM',
      sunday: '4:00 PM - 9:00 PM'
    },
    features: [
      'Outdoor Seating',
      'Private Dining',
      'Full Bar',
      'Valet Parking',
      'Wheelchair Accessible'
    ]
  };

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todayHours = restaurant.hours[today as keyof typeof restaurant.hours];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="relative h-96">
        <img
          src={restaurant.image}
          alt={restaurant.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="max-w-7xl mx-auto">
            <h1 className="text-4xl font-bold text-white mb-2">{restaurant.name}</h1>
            <div className="flex items-center gap-4 text-white">
              <div className="flex items-center gap-1">
                <Star className="fill-yellow-400 text-yellow-400" size={20} />
                <span className="font-semibold">{restaurant.rating}</span>
                <span className="text-white/80">({restaurant.reviewCount} reviews)</span>
              </div>
              <span>•</span>
              <span>{restaurant.priceRange}</span>
              <span>•</span>
              <span>{restaurant.cuisine}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex gap-4">
            <Link
              href={`/restaurants/${slug}/menu`}
              className="flex-1 sm:flex-none bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <ChefHat size={20} />
              <span>View Menu & Pre-order</span>
            </Link>
            <button className="flex-1 sm:flex-none border border-blue-600 text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors flex items-center justify-center gap-2">
              <Calendar size={20} />
              <span>Make Reservation</span>
            </button>
            <Link
              href={`/restaurants/${slug}/menu`}
              className="sm:hidden bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition-colors"
              aria-label="Quick order"
            >
              <ShoppingBag size={20} />
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* About */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-3">About</h2>
              <p className="text-gray-600">{restaurant.description}</p>
            </div>

            {/* Features */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-3">Features</h2>
              <div className="flex flex-wrap gap-2">
                {restaurant.features.map((feature) => (
                  <span
                    key={feature}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-6 text-white">
              <h2 className="text-xl font-semibold mb-3">Skip the Wait</h2>
              <p className="mb-4">
                Pre-order your meal now and have it ready when you arrive. 
                Average prep time: 15-20 minutes after check-in.
              </p>
              <Link
                href={`/restaurants/${slug}/menu`}
                className="inline-block bg-white text-blue-600 px-6 py-2 rounded-lg hover:bg-gray-100 transition-colors font-semibold"
              >
                Start Pre-ordering
              </Link>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-3">Contact & Location</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="text-gray-400 mt-1" size={20} />
                  <div>
                    <p className="text-gray-900">{restaurant.address}</p>
                    <a href="#" className="text-blue-600 text-sm hover:underline">
                      Get directions
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="text-gray-400" size={20} />
                  <a href={`tel:${restaurant.phone}`} className="text-gray-900 hover:text-blue-600">
                    {restaurant.phone}
                  </a>
                </div>
              </div>
            </div>

            {/* Hours */}
            <div className="bg-white rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-3">Hours</h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <Clock size={18} />
                  <span>Open today: {todayHours}</span>
                </div>
                <div className="space-y-1 text-sm">
                  {Object.entries(restaurant.hours).map(([day, hours]) => (
                    <div key={day} className="flex justify-between">
                      <span className="capitalize text-gray-600">{day}</span>
                      <span className={`text-gray-900 ${day === today ? 'font-semibold' : ''}`}>
                        {hours}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}