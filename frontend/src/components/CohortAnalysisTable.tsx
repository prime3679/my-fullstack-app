'use client';

import { useEffect, useState } from 'react';

interface CohortData {
  cohort: string;
  customersAcquired: number;
  retentionRate: number;
  averageLTV: number;
  totalRevenue: number;
}

interface CohortAnalysisTableProps {
  restaurantId: string;
  range: '30d' | '90d' | '180d';
}

export default function CohortAnalysisTable({
  restaurantId,
  range,
}: CohortAnalysisTableProps) {
  const [cohorts, setCohorts] = useState<CohortData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCohorts();
  }, [restaurantId, range]);

  const fetchCohorts = async () => {
    try {
      setLoading(true);
      const days = parseInt(range);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await fetch(
        `http://localhost:3001/api/v1/analytics/customer-analytics/cohorts/${restaurantId}?` +
          `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      const data = await response.json();

      if (data.success) {
        setCohorts(data.data.cohorts);
      }
    } catch (error) {
      console.error('Failed to fetch cohort analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (cohorts.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No cohort data available for this period
      </div>
    );
  }

  const getRetentionColor = (rate: number): string => {
    if (rate >= 70) return 'text-green-600 font-semibold';
    if (rate >= 50) return 'text-yellow-600 font-semibold';
    return 'text-red-600 font-semibold';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cohort Month
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Customers Acquired
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Retention Rate
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Avg LTV
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Revenue
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {cohorts.map((cohort) => (
            <tr key={cohort.cohort} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {cohort.cohort}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {cohort.customersAcquired}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                <span className={getRetentionColor(cohort.retentionRate)}>
                  {cohort.retentionRate.toFixed(1)}%
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                ${cohort.averageLTV.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${cohort.totalRevenue.toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend */}
      <div className="mt-4 flex items-center gap-6 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-600 rounded"></div>
          <span>High Retention (&gt;=70%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-yellow-600 rounded"></div>
          <span>Medium Retention (50-69%)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-600 rounded"></div>
          <span>Low Retention (&lt;50%)</span>
        </div>
      </div>
    </div>
  );
}
