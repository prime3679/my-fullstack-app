'use client';

import { use, useEffect, useState } from 'react';
import RevenueChart from '@/components/RevenueChart';
import MetricCard from '@/components/MetricCard';
import PopularItemsTable from '@/components/PopularItemsTable';
import PeakTimesChart from '@/components/PeakTimesChart';

interface DashboardSummary {
  revenue: {
    today: number;
    yesterday: number;
    thisWeek: number;
    thisMonth: number;
    percentChange: number;
  };
  orders: {
    today: number;
    pending: number;
    completed: number;
  };
  activeReservations: number;
  kitchenTickets: {
    pending: number;
    fired: number;
    ready: number;
  };
}

export default function DashboardPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = use(params);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<'7d' | '30d' | '90d'>('30d');

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 60 seconds
    const interval = setInterval(fetchDashboardData, 60000);
    return () => clearInterval(interval);
  }, [restaurantId]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(
        `http://localhost:3001/api/v1/analytics/dashboard/${restaurantId}`
      );
      const data = await response.json();

      if (data.success) {
        setSummary(data.data);
      } else {
        setError(data.error || 'Failed to fetch dashboard data');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error || 'No data available'}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Restaurant Analytics</h1>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRange('7d')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  selectedRange === '7d'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setSelectedRange('30d')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  selectedRange === '30d'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                30 Days
              </button>
              <button
                onClick={() => setSelectedRange('90d')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  selectedRange === '90d'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                90 Days
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <MetricCard
            title="Today's Revenue"
            value={`$${summary.revenue.today.toFixed(2)}`}
            change={summary.revenue.percentChange}
            icon="💰"
          />
          <MetricCard
            title="Today's Orders"
            value={summary.orders.today}
            subtitle={`${summary.orders.pending} pending`}
            icon="📦"
          />
          <MetricCard
            title="Active Reservations"
            value={summary.activeReservations}
            subtitle="Upcoming bookings"
            icon="📅"
          />
          <MetricCard
            title="Kitchen Tickets"
            value={summary.kitchenTickets.fired + summary.kitchenTickets.ready}
            subtitle={`${summary.kitchenTickets.pending} pending`}
            icon="👨‍🍳"
          />
        </div>

        {/* Revenue Period Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">This Week</h3>
            <p className="text-3xl font-bold text-gray-900">
              ${summary.revenue.thisWeek.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">This Month</h3>
            <p className="text-3xl font-bold text-gray-900">
              ${summary.revenue.thisMonth.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Order Stats</h3>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">
                Completed: <span className="font-semibold">{summary.orders.completed}</span>
              </p>
              <p className="text-sm text-gray-600">
                Pending: <span className="font-semibold">{summary.orders.pending}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Revenue Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Revenue Trend</h2>
            <RevenueChart restaurantId={restaurantId} range={selectedRange} />
          </div>

          {/* Peak Times Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Peak Hours</h2>
            <PeakTimesChart restaurantId={restaurantId} range={selectedRange} />
          </div>
        </div>

        {/* Popular Items Table */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Popular Menu Items</h2>
          <PopularItemsTable restaurantId={restaurantId} range={selectedRange} />
        </div>
      </main>
    </div>
  );
}
