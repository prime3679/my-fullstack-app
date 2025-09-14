'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../../../lib/api';
import Link from 'next/link';

interface ReservationFormData {
  partySize: number;
  selectedDate: string;
  selectedTime: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  specialRequests: string;
}

export default function ReservePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const restaurantSlug = params.slug as string;

  // Get URL params
  const [formData, setFormData] = useState<ReservationFormData>({
    partySize: parseInt(searchParams.get('party') || '2'),
    selectedDate: searchParams.get('date') || (() => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow.toISOString().split('T')[0];
    })(),
    selectedTime: searchParams.get('time') || '19:00',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    specialRequests: ''
  });

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [isRefreshingAvailability, setIsRefreshingAvailability] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Fetch restaurant details
  const { data: restaurantData, isLoading: loadingRestaurant } = useQuery({
    queryKey: ['restaurant', restaurantSlug],
    queryFn: () => api.getRestaurant(restaurantSlug),
  });

  // Check availability for selected date
  const { data: availabilityData, isLoading: loadingAvailability, refetch: refetchAvailability } = useQuery({
    queryKey: ['availability', restaurantData?.data?.id, formData.partySize, formData.selectedDate],
    queryFn: () => restaurantData?.data?.id 
      ? api.checkAvailability(restaurantData.data.id, formData.partySize, formData.selectedDate)
      : Promise.reject('No restaurant ID'),
    enabled: !!restaurantData?.data?.id,
  });

  // Create reservation mutation
  const createReservationMutation = useMutation({
    mutationFn: (data: any) => api.createReservation(data),
    onSuccess: (response) => {
      const reservationId = response.data.id;
      router.push(`/restaurant/${restaurantSlug}/reservation/${reservationId}/confirmation`);
    },
    onError: (error) => {
      console.error('Reservation failed:', error);
      alert('Failed to create reservation. Please try again.');
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (!restaurantData?.data?.id) {
      setValidationErrors({ general: 'Restaurant information is not loaded. Please refresh the page.' });
      return;
    }

    // Show confirmation step
    setShowConfirmation(true);
  };

  const handleConfirmReservation = () => {
    if (!restaurantData?.data?.id) return;

    const reservationData = {
      restaurantId: restaurantData.data.id,
      partySize: formData.partySize,
      startAt: selectedTimeSlot,
      guestName: formData.guestName,
      guestEmail: formData.guestEmail,
      guestPhone: formData.guestPhone,
      specialRequests: formData.specialRequests || undefined
    };

    createReservationMutation.mutate(reservationData);
  };

  const updateFormData = (field: keyof ReservationFormData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationErrors(prev => ({ ...prev, [field]: '' })); // Clear validation error for this field
    
    if (field === 'partySize' || field === 'selectedDate') {
      setSelectedTimeSlot(null); // Reset time selection when changing date/party size
      
      // Auto-refresh availability when date/party changes
      if (restaurantData?.data?.id) {
        setIsRefreshingAvailability(true);
        setTimeout(() => {
          refetchAvailability();
          setIsRefreshingAvailability(false);
        }, 300); // Small debounce
      }
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!formData.guestName.trim()) {
      errors.guestName = 'Name is required';
    }
    
    if (!formData.guestEmail.trim()) {
      errors.guestEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.guestEmail)) {
      errors.guestEmail = 'Please enter a valid email';
    }
    
    if (!formData.guestPhone.trim()) {
      errors.guestPhone = 'Phone number is required';
    } else if (!/^[\+]?[\s\-\(\)]*([0-9][\s\-\(\)]*){10,}$/.test(formData.guestPhone)) {
      errors.guestPhone = 'Please enter a valid phone number';
    }
    
    if (!selectedTimeSlot) {
      errors.timeSlot = 'Please select a time slot';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  if (loadingRestaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-amber-800">Loading restaurant...</p>
        </div>
      </div>
    );
  }

  const restaurant = restaurantData?.data;
  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-600 text-xl mb-4">❌</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Restaurant not found</h2>
          <Link href="/" className="text-amber-600 hover:text-amber-700">← Back to restaurants</Link>
        </div>
      </div>
    );
  }

  const availableSlots = availabilityData?.data?.availableSlots?.filter(slot => slot.available) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="text-amber-600 hover:text-amber-700 text-sm font-medium">
            ← Back to restaurants
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4 mb-2">Make a Reservation</h1>
          <h2 className="text-xl text-gray-700">{restaurant.name}</h2>
          {restaurant.locations[0] && (
            <p className="text-gray-600">{restaurant.locations[0].address}</p>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Reservation Form */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Reservation Details</h3>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* General error message */}
              {validationErrors.general && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {validationErrors.general}
                </div>
              )}

              {/* Date and Party Size */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="reservation-date" className="block text-sm font-medium text-gray-700 mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    id="reservation-date"
                    value={formData.selectedDate}
                    onChange={(e) => updateFormData('selectedDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                      validationErrors.selectedDate ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                  />
                  {validationErrors.selectedDate && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.selectedDate}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="party-size" className="block text-sm font-medium text-gray-700 mb-2">
                    Party Size
                  </label>
                  <select
                    id="party-size"
                    value={formData.partySize}
                    onChange={(e) => updateFormData('partySize', Number(e.target.value))}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                      validationErrors.partySize ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(size => (
                      <option key={size} value={size}>
                        {size} {size === 1 ? 'person' : 'people'}
                      </option>
                    ))}
                  </select>
                  {validationErrors.partySize && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.partySize}</p>
                  )}
                </div>
              </div>

              {/* Guest Information */}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="guest-name" className="block text-sm font-medium text-gray-700 mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    id="guest-name"
                    value={formData.guestName}
                    onChange={(e) => updateFormData('guestName', e.target.value)}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                      validationErrors.guestName ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                  />
                  {validationErrors.guestName && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.guestName}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="guest-phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    id="guest-phone"
                    value={formData.guestPhone}
                    onChange={(e) => updateFormData('guestPhone', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                      validationErrors.guestPhone ? 'border-red-300' : 'border-gray-300'
                    }`}
                    required
                  />
                  {validationErrors.guestPhone && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.guestPhone}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="guest-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  id="guest-email"
                  value={formData.guestEmail}
                  onChange={(e) => updateFormData('guestEmail', e.target.value)}
                  placeholder="you@example.com"
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent ${
                    validationErrors.guestEmail ? 'border-red-300' : 'border-gray-300'
                  }`}
                  required
                />
                {validationErrors.guestEmail && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.guestEmail}</p>
                )}
              </div>

              <div>
                <label htmlFor="special-requests" className="block text-sm font-medium text-gray-700 mb-2">
                  Special Requests
                </label>
                <textarea
                  id="special-requests"
                  value={formData.specialRequests}
                  onChange={(e) => updateFormData('specialRequests', e.target.value)}
                  rows={3}
                  placeholder="Allergies, dietary restrictions, special occasions..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedTimeSlot || createReservationMutation.isPending}
                className="w-full bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {createReservationMutation.isPending ? 'Creating Reservation...' : 'Review Reservation'}
              </button>
            </form>
          </div>

          {/* Available Times */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Available Times</h3>
              {isRefreshingAvailability && (
                <div className="flex items-center text-amber-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 mr-2"></div>
                  <span className="text-sm">Updating...</span>
                </div>
              )}
            </div>

            {validationErrors.timeSlot && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {validationErrors.timeSlot}
              </div>
            )}
            
            {loadingAvailability || isRefreshingAvailability ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
                <p className="text-gray-600">
                  {isRefreshingAvailability ? 'Updating availability...' : 'Checking availability...'}
                </p>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">📅</div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No availability</h4>
                <p className="text-gray-600 mb-4">No time slots available for the selected date and party size.</p>
                <p className="text-sm text-gray-500">Try selecting a different date or reducing party size.</p>
              </div>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {availableSlots.map(slot => {
                  const time = new Date(slot.time).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  });
                  const isSelected = selectedTimeSlot === slot.time;
                  
                  return (
                    <button
                      key={slot.time}
                      onClick={() => {
                        setSelectedTimeSlot(slot.time);
                        setValidationErrors(prev => ({ ...prev, timeSlot: '' }));
                      }}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        isSelected 
                          ? 'bg-amber-50 border-amber-500 text-amber-900'
                          : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <div className="font-medium">{time}</div>
                      <div className="text-sm text-gray-600">{slot.capacity} seats available</div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Review Your Reservation</h3>
                <button
                  onClick={() => setShowConfirmation(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <div className="space-y-6">
                {/* Restaurant Info */}
                <div className="border-b border-gray-200 pb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">{restaurant.name}</h4>
                  {restaurant.locations[0] && (
                    <p className="text-gray-600">{restaurant.locations[0].address}</p>
                  )}
                </div>

                {/* Reservation Details */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h5 className="font-medium text-gray-900 mb-1">Date & Time</h5>
                    <p className="text-gray-700">
                      {new Date(formData.selectedDate).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                    <p className="text-gray-700">
                      {selectedTimeSlot && new Date(selectedTimeSlot).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true
                      })}
                    </p>
                  </div>

                  <div>
                    <h5 className="font-medium text-gray-900 mb-1">Party Size</h5>
                    <p className="text-gray-700">{formData.partySize} {formData.partySize === 1 ? 'person' : 'people'}</p>
                  </div>
                </div>

                {/* Guest Information */}
                <div className="border-t border-gray-200 pt-6">
                  <h5 className="font-medium text-gray-900 mb-3">Guest Information</h5>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="text-gray-700">{formData.guestName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Email</p>
                      <p className="text-gray-700">{formData.guestEmail}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Phone</p>
                      <p className="text-gray-700">{formData.guestPhone}</p>
                    </div>
                    {formData.specialRequests && (
                      <div>
                        <p className="text-sm text-gray-500">Special Requests</p>
                        <p className="text-gray-700">{formData.specialRequests}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="border-t border-gray-200 pt-6 flex gap-4">
                  <button
                    onClick={() => setShowConfirmation(false)}
                    className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    ← Edit Details
                  </button>
                  <button
                    onClick={handleConfirmReservation}
                    disabled={createReservationMutation.isPending}
                    className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {createReservationMutation.isPending ? 'Creating Reservation...' : 'Confirm Reservation'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}