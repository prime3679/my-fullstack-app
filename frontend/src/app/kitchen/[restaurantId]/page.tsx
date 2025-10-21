'use client';

import { use, useEffect, useState, useCallback } from 'react';
import KitchenTicketCard from '@/components/KitchenTicketCard';

interface KitchenTicket {
  id: string;
  status: 'PENDING' | 'HOLD' | 'FIRED' | 'READY' | 'SERVED';
  targetFireTime: string | null;
  firedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  minutesUntilFire: number | null;
  minutesSinceFired: number | null;
  pacingStatus: 'on_time' | 'warning' | 'late' | 'ready';
  estimatedReadyTime: string | null;
  reservation: {
    id: string;
    startAt: string;
    partySize: number;
    user: {
      name: string;
    } | null;
    table: {
      number: string;
    } | null;
  };
  preOrder: {
    id: string;
    items: Array<{
      id: string;
      quantity: number;
      menuItem: {
        name: string;
        course: string | null;
        prepTimeMinutes: number | null;
      };
      modifiers: string[];
      specialInstructions: string | null;
    }>;
  } | null;
}

export default function KitchenDashboardPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = use(params);
  const [tickets, setTickets] = useState<KitchenTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/v1/kitchen/active/${restaurantId}`
      );
      const data = await response.json();

      if (data.success) {
        setTickets(data.data.tickets);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch tickets');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Kitchen fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  // WebSocket connection
  useEffect(() => {
    const websocket = new WebSocket(
      `ws://localhost:3001/ws/kitchen/${restaurantId}`
    );

    websocket.onopen = () => {
      console.log('Kitchen WebSocket connected');
      setWsConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'ticket_update') {
          // Update specific ticket in state
          setTickets((prevTickets) => {
            const index = prevTickets.findIndex((t) => t.id === message.ticket.id);
            if (index !== -1) {
              const updated = [...prevTickets];
              updated[index] = message.ticket;
              return updated;
            } else {
              return [...prevTickets, message.ticket];
            }
          });
        } else if (message.type === 'ticket_deleted') {
          // Remove ticket from state
          setTickets((prevTickets) =>
            prevTickets.filter((t) => t.id !== message.ticketId)
          );
        } else if (message.type === 'connected') {
          console.log('Connected to kitchen dashboard');
        } else if (message.type === 'pong') {
          // Keepalive response
        }
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    };

    websocket.onclose = () => {
      console.log('Kitchen WebSocket disconnected');
      setWsConnected(false);
    };

    websocket.onerror = (error) => {
      console.error('Kitchen WebSocket error:', error);
      setWsConnected(false);
    };

    setWs(websocket);

    // Keepalive ping every 30 seconds
    const pingInterval = setInterval(() => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => {
      clearInterval(pingInterval);
      websocket.close();
    };
  }, [restaurantId]);

  // Initial fetch
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Refresh every 10 seconds as backup to WebSocket
  useEffect(() => {
    const interval = setInterval(() => {
      if (!wsConnected) {
        fetchTickets();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [wsConnected, fetchTickets]);

  const handleStatusUpdate = async (
    ticketId: string,
    action: 'fire' | 'ready' | 'served' | 'hold'
  ) => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/v1/kitchen/${action}/${ticketId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();

      if (!data.success) {
        console.error('Failed to update ticket:', data.error);
        alert(`Failed to update ticket: ${data.error}`);
      }
      // WebSocket will handle the UI update
    } catch (error) {
      console.error('Failed to update ticket:', error);
      alert('Failed to update ticket. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-white">Loading kitchen dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && tickets.length === 0) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 text-lg">{error}</p>
          <button
            onClick={fetchTickets}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Group tickets by status
  const pendingTickets = tickets.filter(
    (t) => t.status === 'PENDING' || t.status === 'HOLD'
  );
  const firedTickets = tickets.filter((t) => t.status === 'FIRED');
  const readyTickets = tickets.filter((t) => t.status === 'READY');

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-white">Kitchen Dashboard</h1>
              <p className="text-sm text-gray-400 mt-1">
                Real-time order management and pacing
              </p>
            </div>

            {/* Status Indicators */}
            <div className="flex items-center gap-4">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded ${
                  wsConnected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${
                    wsConnected ? 'bg-green-400' : 'bg-red-400'
                  }`}
                ></div>
                <span className="text-sm font-medium">
                  {wsConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              <div className="text-white text-sm">
                <span className="font-bold">{tickets.length}</span> Active Tickets
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending/Hold Column */}
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg px-4 py-3 border border-gray-700">
              <h2 className="text-lg font-semibold text-gray-200">
                Pending ({pendingTickets.length})
              </h2>
              <p className="text-xs text-gray-400">Ready to fire</p>
            </div>
            <div className="space-y-3">
              {pendingTickets.length === 0 ? (
                <div className="bg-gray-800 rounded-lg px-4 py-8 text-center text-gray-500 border border-gray-700">
                  No pending orders
                </div>
              ) : (
                pendingTickets.map((ticket) => (
                  <KitchenTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onStatusUpdate={handleStatusUpdate}
                  />
                ))
              )}
            </div>
          </div>

          {/* Fired Column */}
          <div className="space-y-4">
            <div className="bg-orange-900/30 rounded-lg px-4 py-3 border border-orange-700">
              <h2 className="text-lg font-semibold text-orange-200">
                Cooking ({firedTickets.length})
              </h2>
              <p className="text-xs text-orange-300">In progress</p>
            </div>
            <div className="space-y-3">
              {firedTickets.length === 0 ? (
                <div className="bg-gray-800 rounded-lg px-4 py-8 text-center text-gray-500 border border-gray-700">
                  No orders cooking
                </div>
              ) : (
                firedTickets.map((ticket) => (
                  <KitchenTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onStatusUpdate={handleStatusUpdate}
                  />
                ))
              )}
            </div>
          </div>

          {/* Ready Column */}
          <div className="space-y-4">
            <div className="bg-green-900/30 rounded-lg px-4 py-3 border border-green-700">
              <h2 className="text-lg font-semibold text-green-200">
                Ready ({readyTickets.length})
              </h2>
              <p className="text-xs text-green-300">Ready to serve</p>
            </div>
            <div className="space-y-3">
              {readyTickets.length === 0 ? (
                <div className="bg-gray-800 rounded-lg px-4 py-8 text-center text-gray-500 border border-gray-700">
                  No orders ready
                </div>
              ) : (
                readyTickets.map((ticket) => (
                  <KitchenTicketCard
                    key={ticket.id}
                    ticket={ticket}
                    onStatusUpdate={handleStatusUpdate}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
