'use client';

import { useState, useEffect } from 'react';
import { ReservationCard } from '../../../components/host/ReservationCard';
import { TableSelector } from '../../../components/host/TableSelector';

interface Reservation {
  id: string;
  startAt: string;
  partySize: number;
  status: 'BOOKED' | 'CHECKED_IN' | 'COMPLETED' | 'NO_SHOW' | 'CANCELED';
  specialRequests?: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  table?: {
    id: string;
    number: string;
    seats: number;
    zone?: string;
  };
  preOrder?: {
    id: string;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      menuItem: {
        name: string;
        course?: string;
      };
    }>;
    payments: Array<{
      id: string;
      status: string;
      totalAmount: number;
    }>;
  };
  checkin?: {
    id: string;
    checkedInAt: string;
  };
  kitchenTicket?: {
    id: string;
    status: string;
  };
}

interface Summary {
  totalReservations: number;
  totalCovers: number;
  withPreOrders: number;
  checkedIn: number;
  seated: number;
  completed: number;
  noShows: number;
}

interface Table {
  id: string;
  number: string;
  seats: number;
  zone?: string;
  locationId: string;
  locationName: string;
  isAvailable: boolean;
  assignedReservation?: {
    id: string;
    guestName: string;
    startAt: string;
    partySize: number;
  };
}

export default function HostDashboard({
  params: routeParams,
}: {
  params: { restaurantId: string };
}) {
  const { restaurantId } = routeParams;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [timeSlotFilter, setTimeSlotFilter] = useState<string>('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Fetch today's reservations
  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (timeSlotFilter) params.append('timeSlot', timeSlotFilter);

      const response = await fetch(
        `${getApiBase()}/host/reservations/${restaurantId}?${params}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch reservations');
      }

      const result = await response.json();
      if (result.success) {
        setReservations(result.data.reservations);
        setSummary(result.data.summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reservations');
      console.error('Error fetching reservations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch available tables
  const fetchTables = async () => {
    try {
      const response = await fetch(`${getApiBase()}/host/tables/${restaurantId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch tables');
      }

      const result = await response.json();
      if (result.success) {
        setTables(result.data);
      }
    } catch (err) {
      console.error('Error fetching tables:', err);
    }
  };

  // Assign table to reservation
  const assignTable = async (reservationId: string, tableId: string) => {
    try {
      const response = await fetch(
        `${getApiBase()}/host/reservations/${reservationId}/assign-table`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tableId }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to assign table');
      }

      const result = await response.json();
      if (result.success) {
        // Update the reservation in state
        setReservations(prev =>
          prev.map(r => (r.id === reservationId ? result.data : r))
        );
      }
    } catch (err) {
      console.error('Error assigning table:', err);
      alert('Failed to assign table. Please try again.');
    }
  };

  // Update reservation status
  const updateStatus = async (reservationId: string, status: string) => {
    try {
      const response = await fetch(
        `${getApiBase()}/host/reservations/${reservationId}/status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      const result = await response.json();
      if (result.success) {
        // Update the reservation in state
        setReservations(prev =>
          prev.map(r => (r.id === reservationId ? result.data : r))
        );
      }
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status. Please try again.');
    }
  };

  // WebSocket connection for real-time updates
  useEffect(() => {
    const wsUrl = `${getWsBase()}/ws/host/${restaurantId}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected to host dashboard');
      setIsConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'reservation_update') {
          // Update specific reservation
          if (message.data.reservation) {
            setReservations(prev =>
              prev.map(r =>
                r.id === message.data.reservation.id ? message.data.reservation : r
              )
            );
          }
        } else if (message.type === 'new_reservation') {
          // Add new reservation
          if (message.reservation) {
            setReservations(prev => [...prev, message.reservation]);
            // Refetch to update summary
            fetchReservations();
          }
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsConnected(false);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, [restaurantId]);

  // Initial fetch
  useEffect(() => {
    fetchReservations();
    fetchTables();
  }, [restaurantId, statusFilter, timeSlotFilter]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isConnected) {
        fetchReservations();
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'BOOKED':
        return 'bg-blue-100 text-blue-800';
      case 'CHECKED_IN':
        return 'bg-green-100 text-green-800';
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-800';
      case 'NO_SHOW':
        return 'bg-red-100 text-red-800';
      case 'CANCELED':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Group reservations by time slot
  const groupedReservations = reservations.reduce((acc, reservation) => {
    const time = formatTime(reservation.startAt);
    if (!acc[time]) {
      acc[time] = [];
    }
    acc[time].push(reservation);
    return acc;
  }, {} as Record<string, Reservation[]>);

  const timeSlots = Object.keys(groupedReservations).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Host Dashboard</h1>
              <p className="text-gray-600">
                Today's reservations and table management
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Live' : 'Reconnecting...'}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 mb-1">
                Total Reservations
              </h3>
              <p className="text-2xl font-bold text-gray-900">
                {summary.totalReservations}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 mb-1">Total Covers</h3>
              <p className="text-2xl font-bold text-blue-600">{summary.totalCovers}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 mb-1">Pre-Orders</h3>
              <p className="text-2xl font-bold text-purple-600">
                {summary.withPreOrders}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 mb-1">Checked In</h3>
              <p className="text-2xl font-bold text-green-600">{summary.checkedIn}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 mb-1">Seated</h3>
              <p className="text-2xl font-bold text-teal-600">{summary.seated}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 mb-1">Completed</h3>
              <p className="text-2xl font-bold text-gray-600">{summary.completed}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 mb-1">No Shows</h3>
              <p className="text-2xl font-bold text-red-600">{summary.noShows}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Status
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setStatusFilter('')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    statusFilter === ''
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {['BOOKED', 'CHECKED_IN', 'COMPLETED', 'NO_SHOW'].map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      statusFilter === status
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Reservations List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading reservations...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">Error: {error}</p>
            <button
              onClick={fetchReservations}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : reservations.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 text-lg">No reservations found for today</p>
          </div>
        ) : (
          <div className="space-y-8">
            {timeSlots.map(timeSlot => (
              <div key={timeSlot}>
                <h2 className="text-xl font-bold text-gray-900 mb-4">{timeSlot}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedReservations[timeSlot].map(reservation => (
                    <ReservationCard
                      key={reservation.id}
                      reservation={reservation}
                      tables={tables}
                      onAssignTable={assignTable}
                      onUpdateStatus={updateStatus}
                      getStatusColor={getStatusColor}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function getApiBase() {
  const rawBase = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  const fallback = 'http://localhost:3001/api/v1';

  const baseWithoutTrailingSlash = (rawBase || fallback).replace(/\/+$/, '');

  if (baseWithoutTrailingSlash.endsWith('/api/v1')) {
    return baseWithoutTrailingSlash;
  }

  return `${baseWithoutTrailingSlash}/api/v1`;
}

function getWsBase() {
  const rawBase = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  const fallback = 'ws://localhost:3001';

  const baseWithoutTrailingSlash = (rawBase || fallback)
    .replace(/\/+$/, '')
    .replace('http://', 'ws://')
    .replace('https://', 'wss://');

  // Remove /api/v1 if present
  return baseWithoutTrailingSlash.replace(/\/api\/v1$/, '');
}
