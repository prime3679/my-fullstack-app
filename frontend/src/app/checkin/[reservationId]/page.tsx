'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';

interface Reservation {
  id: string;
  status: string;
  partySize: number;
  startAt: string;
  user: {
    name: string;
    email: string;
  };
}

interface CheckInResponse {
  success: boolean;
  data?: {
    checkin: {
      id: string;
      scannedAt: string;
      method: string;
    };
    reservation: Reservation;
    kitchenTicket?: {
      id: string;
      estimatedPrepMinutes: number;
      fireAt: string;
    };
  };
  message?: string;
  error?: string;
}

interface CheckInStatusResponse {
  success: boolean;
  data?: {
    reservation: Reservation;
    checkin?: {
      id: string;
      scannedAt: string;
      method: string;
    };
    kitchenTicket?: {
      id: string;
      status: string;
      estimatedPrepMinutes: number;
    };
  };
  error?: string;
}

export default function CheckInPage() {
  const params = useParams();
  const reservationId = params.reservationId as string;
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedTable, setSelectedTable] = useState('');

  // Fetch check-in status
  const { data: statusData, isLoading: loadingStatus } = useQuery({
    queryKey: ['checkin-status', reservationId],
    queryFn: () => fetchCheckInStatus(reservationId),
    enabled: !!reservationId,
  });

  // Check-in mutation
  const checkInMutation = useMutation({
    mutationFn: (data: { locationId: string; tableId?: string }) => 
      performCheckIn(reservationId, data.locationId, data.tableId),
    onSuccess: (data) => {
      if (data.success) {
        setIsCheckedIn(true);
      }
    },
  });

  useEffect(() => {
    if (statusData?.data?.checkin) {
      setIsCheckedIn(true);
    }
  }, [statusData]);

  const handleCheckIn = () => {
    if (!selectedLocation) {
      alert('Please select a location');
      return;
    }

    checkInMutation.mutate({
      locationId: selectedLocation,
      tableId: selectedTable || undefined
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loadingStatus) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
        <p className="text-gray-600">Loading reservation...</p>
      </div>
    );
  }

  if (!statusData?.success || !statusData.data?.reservation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Reservation Not Found</h1>
            <p className="text-gray-600 mb-6">
              We couldn't find a reservation with this ID. Please check with restaurant staff.
            </p>
            <button
              onClick={() => window.history.back()}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  const reservation = statusData.data.reservation;
  const checkin = statusData.data.checkin;

  if (isCheckedIn || checkin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-green-500 text-6xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome!</h1>
            <p className="text-gray-600 mb-6">
              You're successfully checked in, {reservation.user.name}!
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-gray-900 mb-3">Reservation Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Party Size:</span>
                  <span className="font-medium">{reservation.partySize} guests</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Reservation:</span>
                  <span className="font-medium">{formatTime(reservation.startAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Checked In:</span>
                  <span className="font-medium">{formatTime(checkin?.scannedAt || new Date().toISOString())}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium text-green-600">Checked In</span>
                </div>
              </div>
            </div>

            {statusData.data.kitchenTicket && (
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h4 className="font-semibold text-blue-900 mb-2">🍽️ Kitchen Update</h4>
                <p className="text-blue-800 text-sm">
                  Your pre-order has been sent to the kitchen! 
                  Estimated prep time: {statusData.data.kitchenTicket.estimatedPrepMinutes} minutes
                </p>
              </div>
            )}

            <div className="text-center text-gray-600 text-sm">
              Please find your table and a server will be with you shortly.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (reservation.status === 'CHECKED_IN') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-blue-500 text-6xl mb-4">ℹ️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Already Checked In</h1>
            <p className="text-gray-600 mb-6">
              This reservation has already been checked in at {formatTime(checkin?.scannedAt || '')}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (reservation.status !== 'BOOKED') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-orange-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Cannot Check In</h1>
            <p className="text-gray-600 mb-6">
              This reservation is not available for check-in. Current status: {reservation.status}
            </p>
            <p className="text-gray-500 text-sm">
              Please contact restaurant staff for assistance.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow p-8 max-w-md w-full mx-4">
        <div className="text-center mb-6">
          <div className="text-blue-500 text-6xl mb-4">📱</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Check In</h1>
          <p className="text-gray-600">
            Welcome, {reservation.user.name}!
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Reservation Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Party Size:</span>
              <span className="font-medium">{reservation.partySize} guests</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Time:</span>
              <span className="font-medium">{formatTime(reservation.startAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className="font-medium text-blue-600">Ready to Check In</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Location *
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select dining area</option>
              <option value="main-dining">Main Dining Room</option>
              <option value="patio">Outdoor Patio</option>
              <option value="bar">Bar Area</option>
              <option value="private">Private Room</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Table (Optional)
            </label>
            <input
              type="text"
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              placeholder="e.g., Table 12, B3, etc."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {checkInMutation.error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">
              Check-in failed. Please try again or contact staff.
            </p>
          </div>
        )}

        <button
          onClick={handleCheckIn}
          disabled={checkInMutation.isPending || !selectedLocation}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            checkInMutation.isPending || !selectedLocation
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {checkInMutation.isPending ? (
            <span className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Checking In...
            </span>
          ) : (
            'Check In'
          )}
        </button>

        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>Having trouble? Please see your server for assistance.</p>
        </div>
      </div>
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchCheckInStatus(reservationId: string): Promise<CheckInStatusResponse> {
  const response = await fetch(`${API_BASE}/api/v1/checkin/status/${reservationId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch check-in status');
  }
  return response.json();
}

async function performCheckIn(
  reservationId: string, 
  locationId: string, 
  tableId?: string
): Promise<CheckInResponse> {
  const response = await fetch(`${API_BASE}/api/v1/checkin/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      reservationId,
      method: 'QR_SCAN',
      locationId,
      tableId
    }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to check in');
  }
  return response.json();
}
