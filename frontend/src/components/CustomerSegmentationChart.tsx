'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface SegmentData {
  segment: string;
  customerCount: number;
  averageLTV: number;
  totalRevenue: number;
  averageVisits: number;
}

interface CustomerSegmentationChartProps {
  restaurantId: string;
  range: '30d' | '90d' | '180d';
}

export default function CustomerSegmentationChart({
  restaurantId,
  range,
}: CustomerSegmentationChartProps) {
  const [segments, setSegments] = useState<SegmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSegmentation();
  }, [restaurantId, range]);

  const fetchSegmentation = async () => {
    try {
      setLoading(true);
      const days = parseInt(range);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await fetch(
        `http://localhost:3001/api/v1/analytics/customer-analytics/segmentation/${restaurantId}?` +
          `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      const data = await response.json();

      if (data.success) {
        setSegments(data.data.segments);
      }
    } catch (error) {
      console.error('Failed to fetch customer segmentation:', error);
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

  if (segments.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No customer data available
      </div>
    );
  }

  const segmentColors: Record<string, string> = {
    Platinum: 'rgba(168, 85, 247, 0.8)',
    Gold: 'rgba(251, 191, 36, 0.8)',
    Silver: 'rgba(156, 163, 175, 0.8)',
    Bronze: 'rgba(180, 83, 9, 0.8)',
  };

  const chartData = {
    labels: segments.map((s) => s.segment),
    datasets: [
      {
        label: 'Customers',
        data: segments.map((s) => s.customerCount),
        backgroundColor: segments.map((s) => segmentColors[s.segment] || 'rgba(59, 130, 246, 0.8)'),
        borderWidth: 2,
        borderColor: '#fff',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const segment = segments[context.dataIndex];
            return [
              `${segment.customerCount} customers`,
              `Avg LTV: $${segment.averageLTV.toFixed(2)}`,
              `Revenue: $${segment.totalRevenue.toFixed(2)}`,
            ];
          },
        },
      },
    },
  };

  return (
    <div className="h-64">
      <Pie data={chartData} options={options} />
    </div>
  );
}
