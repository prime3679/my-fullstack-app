'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useKitchenWebSocket } from '../../hooks/useKitchenWebSocket';

interface KitchenTicket {
  id: string;
  status: 'PENDING' | 'HOLD' | 'FIRED' | 'READY' | 'SERVED';
  estimatedPrepMinutes: number;
  fireAt: string;
  firedAt?: string;
  readyAt?: string;
  servedAt?: string;
  itemsJson: Array<{
    name: string;
    quantity: number;
    modifiers?: Array<{ name: string }>;
    notes?: string;
    allergens?: Array<{ name: string }>;
  }>;
  reservation: {
    id: string;
    partySize: number;
    startAt: string;
    user: {
      name: string;
      email: string;
    };
    preOrder?: {
      id: string;
      items: Array<{
        name: string;
        quantity: number;
        modifiers?: string[];
        notes?: string;
        allergens?: string[];
      }>;
    };
  };
}

interface DashboardStats {
  ticketCounts: Record<string, number>;
  averagePrepTime: number;
  activeTickets: number;
}

const RESTAURANT_ID = 'cmfhahzn10000un0ifrqljetp'; // Default restaurant for demo

export default function KitchenDashboard() {
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [notifications, setNotifications] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // WebSocket connection for real-time updates
  const { isConnected, connectionError } = useKitchenWebSocket({
    restaurantId: RESTAURANT_ID,
    onNewTicket: (ticket) => {
      setNotifications(prev => [
        ...prev.slice(-4), // Keep only last 5 notifications
        `New order from ${ticket.reservation?.user?.name || 'Guest'} - Table ${ticket.reservation?.partySize || '?'}`
      ]);
    },
    onTicketReady: (ticket) => {
      setNotifications(prev => [
        ...prev.slice(-4),
        `🍽️ Order ready for ${ticket.reservation?.user?.name || 'Guest'}!`
      ]);
    },
    onTicketUpdate: (ticket) => {
      // Optional: Add notification for status changes
      if (ticket.status === 'FIRED') {
        setNotifications(prev => [
          ...prev.slice(-4),
          `🔥 Started cooking for ${ticket.reservation?.user?.name || 'Guest'}`
        ]);
      }
    }
  });

  // Fetch kitchen tickets
  const { data: ticketsData, isLoading: loadingTickets } = useQuery({
    queryKey: ['kitchen-tickets', RESTAURANT_ID, selectedStatus],
    queryFn: () => fetchKitchenTickets(RESTAURANT_ID, selectedStatus),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch dashboard stats
  const { data: statsData, isLoading: loadingStats } = useQuery({
    queryKey: ['kitchen-dashboard', RESTAURANT_ID],
    queryFn: () => fetchDashboardStats(RESTAURANT_ID),
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Update ticket status mutation
  const updateTicketMutation = useMutation({
    mutationFn: ({ ticketId, status, estimatedPrepMinutes }: {
      ticketId: string;
      status: string;
      estimatedPrepMinutes?: number;
    }) => updateTicketStatus(ticketId, status, estimatedPrepMinutes),
    onSuccess: () => {
      // Refetch tickets and stats
      queryClient.invalidateQueries({ queryKey: ['kitchen-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-dashboard'] });
    },
  });

  const tickets = ticketsData?.data || [];
  const stats = statsData?.data || { ticketCounts: {}, averagePrepTime: 0, activeTickets: 0 };

  const handleStatusChange = (ticketId: string, newStatus: string, estimatedPrepMinutes?: number) => {
    updateTicketMutation.mutate({ ticketId, status: newStatus, estimatedPrepMinutes });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'HOLD': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'FIRED': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'READY': return 'bg-green-100 text-green-800 border-green-300';
      case 'SERVED': return 'bg-gray-100 text-gray-800 border-gray-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getTimeElapsed = (fireAt: string, firedAt?: string) => {
    const now = new Date();
    const fireTime = new Date(fireAt);
    const firedTime = firedAt ? new Date(firedAt) : fireTime;
    
    const diffMinutes = Math.floor((now.getTime() - firedTime.getTime()) / (1000 * 60));
    return diffMinutes;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Kitchen Dashboard</h1>
          <p className="text-gray-600">Real-time order management and ticket tracking</p>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Active Tickets</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.activeTickets}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Pending</h3>
            <p className="text-2xl font-bold text-yellow-600">{stats.ticketCounts.PENDING || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">In Progress</h3>
            <p className="text-2xl font-bold text-blue-600">{stats.ticketCounts.FIRED || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Avg Prep Time</h3>
            <p className="text-2xl font-bold text-green-600">{Math.round(stats.averagePrepTime)}min</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedStatus('')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedStatus === '' 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Tickets
            </button>
            {['PENDING', 'HOLD', 'FIRED', 'READY', 'SERVED'].map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedStatus === status
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Kitchen Tickets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {loadingTickets ? (
            <div className="col-span-full text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="col-span-full text-center py-8">
              <p className="text-gray-600">No tickets found</p>
            </div>
          ) : (
            tickets.map((ticket: KitchenTicket) => (
              <div key={ticket.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="p-6">
                  {/* Ticket Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {ticket.reservation.user.name}
                      </h3>
                      <p className="text-sm text-gray-600">
                        Party of {ticket.reservation.partySize} • {formatTime(ticket.reservation.startAt)}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                      {ticket.status}
                    </span>
                  </div>

                  {/* Timing Info */}
                  <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fire Time:</span>
                      <span className="font-medium">{formatTime(ticket.fireAt)}</span>
                    </div>
                    {ticket.firedAt && (
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">Elapsed:</span>
                        <span className={`font-medium ${getTimeElapsed(ticket.fireAt, ticket.firedAt) > ticket.estimatedPrepMinutes ? 'text-red-600' : 'text-green-600'}`}>
                          {getTimeElapsed(ticket.fireAt, ticket.firedAt)}min
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-gray-600">Est. Prep:</span>
                      <span className="font-medium">{ticket.estimatedPrepMinutes}min</span>
                    </div>
                  </div>

                  {/* Order Items */}
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">Items:</h4>
                    <div className="space-y-2">
                      {ticket.itemsJson.map((item, index) => (
                        <div key={index} className="text-sm">
                          <div className="flex justify-between">
                            <span className="font-medium">{item.quantity}x {item.name}</span>
                          </div>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <div className="text-xs text-gray-600 ml-4">
                              {item.modifiers.map(mod => mod.name).join(', ')}
                            </div>
                          )}
                          {item.notes && (
                            <div className="text-xs text-orange-600 ml-4 italic">
                              Note: {item.notes}
                            </div>
                          )}
                          {item.allergens && item.allergens.length > 0 && (
                            <div className="text-xs text-red-600 ml-4 font-medium">
                              ⚠️ Allergens: {item.allergens.map(a => a.name).join(', ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {ticket.status === 'PENDING' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(ticket.id, 'HOLD')}
                          className="px-3 py-1 bg-orange-100 text-orange-700 rounded text-sm hover:bg-orange-200 transition-colors"
                        >
                          Hold
                        </button>
                        <button
                          onClick={() => handleStatusChange(ticket.id, 'FIRED')}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                        >
                          Fire
                        </button>
                      </>
                    )}
                    {ticket.status === 'HOLD' && (
                      <button
                        onClick={() => handleStatusChange(ticket.id, 'FIRED')}
                        className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm hover:bg-blue-200 transition-colors"
                      >
                        Fire
                      </button>
                    )}
                    {ticket.status === 'FIRED' && (
                      <button
                        onClick={() => handleStatusChange(ticket.id, 'READY')}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm hover:bg-green-200 transition-colors"
                      >
                        Ready
                      </button>
                    )}
                    {ticket.status === 'READY' && (
                      <button
                        onClick={() => handleStatusChange(ticket.id, 'SERVED')}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors"
                      >
                        Served
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// API functions
async function fetchKitchenTickets(restaurantId: string, status?: string) {
  const params = new URLSearchParams({ restaurantId });
  if (status) params.append('status', status);

  const response = await fetch(`${API_BASE}/kitchen/tickets?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch kitchen tickets');
  }
  return response.json();
}

async function fetchDashboardStats(restaurantId: string) {
  const response = await fetch(`${API_BASE}/kitchen/dashboard?restaurantId=${restaurantId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch dashboard stats');
  }
  return response.json();
}

async function updateTicketStatus(ticketId: string, status: string, estimatedPrepMinutes?: number) {
  const response = await fetch(`${API_BASE}/kitchen/tickets/${ticketId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status, estimatedPrepMinutes }),
  });
  
  if (!response.ok) {
    throw new Error('Failed to update ticket status');
  }
  return response.json();
}
