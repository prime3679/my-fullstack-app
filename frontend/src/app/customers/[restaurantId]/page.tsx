'use client';

import { use, useEffect, useState } from 'react';
import CustomerSegmentationChart from '@/components/CustomerSegmentationChart';
import VisitFrequencyChart from '@/components/VisitFrequencyChart';
import CustomerLTVTable from '@/components/CustomerLTVTable';
import CohortAnalysisTable from '@/components/CohortAnalysisTable';

interface CustomerSummary {
  totalCustomers: number;
  averageLTV: number;
  retentionRate: number;
  topSegment: string;
}

export default function CustomerAnalyticsPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = use(params);
  const [summary, setSummary] = useState<CustomerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<'30d' | '90d' | '180d'>('90d');

  useEffect(() => {
    fetchSummaryData();
  }, [restaurantId, selectedRange]);

  const fetchSummaryData = async () => {
    try {
      setLoading(true);
      const days = parseInt(selectedRange);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Fetch customer LTV to calculate summary
      const response = await fetch(
        `http://localhost:3001/api/v1/analytics/customer-analytics/ltv/${restaurantId}?` +
          `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&limit=1000`
      );
      const data = await response.json();

      if (data.success && data.data.customers) {
        const customers = data.data.customers;
        const totalCustomers = customers.length;
        const totalLTV = customers.reduce((sum: number, c: any) => sum + c.totalSpent, 0);
        const averageLTV = totalCustomers > 0 ? totalLTV / totalCustomers : 0;

        // Calculate retention (customers with 2+ visits)
        const returningCustomers = customers.filter((c: any) => c.visitCount > 1).length;
        const retentionRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

        // Find top segment
        const segmentCounts: Record<string, number> = {};
        customers.forEach((c: any) => {
          segmentCounts[c.segment] = (segmentCounts[c.segment] || 0) + 1;
        });
        const topSegment = Object.entries(segmentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

        setSummary({
          totalCustomers,
          averageLTV,
          retentionRate,
          topSegment,
        });
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch customer data');
      }
    } catch (err) {
      setError('Failed to connect to server');
      console.error('Customer analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading customer analytics...</p>
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
            onClick={fetchSummaryData}
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
            <h1 className="text-2xl font-bold text-gray-900">Customer Analytics</h1>

            {/* Date Range Selector */}
            <div className="flex gap-2">
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
              <button
                onClick={() => setSelectedRange('180d')}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  selectedRange === '180d'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                180 Days
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Total Customers</h3>
            <p className="text-3xl font-bold text-gray-900">{summary.totalCustomers}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Avg Lifetime Value</h3>
            <p className="text-3xl font-bold text-green-600">
              ${summary.averageLTV.toFixed(2)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Retention Rate</h3>
            <p className="text-3xl font-bold text-blue-600">
              {summary.retentionRate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Top Segment</h3>
            <p className="text-3xl font-bold text-purple-600">{summary.topSegment}</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Customer Segmentation */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Customer Segmentation
            </h2>
            <CustomerSegmentationChart restaurantId={restaurantId} range={selectedRange} />
          </div>

          {/* Visit Frequency */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Visit Frequency Distribution
            </h2>
            <VisitFrequencyChart restaurantId={restaurantId} range={selectedRange} />
          </div>
        </div>

        {/* Customer LTV Table */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Top Customers by Lifetime Value
          </h2>
          <CustomerLTVTable restaurantId={restaurantId} range={selectedRange} />
        </div>

        {/* Cohort Analysis */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Cohort Analysis</h2>
          <CohortAnalysisTable restaurantId={restaurantId} range={selectedRange} />
        </div>
      </main>
    </div>
  );
}
