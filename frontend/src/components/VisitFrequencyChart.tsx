'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface FrequencyData {
  frequency: string;
  customerCount: number;
  percentage: number;
}

interface VisitFrequencyChartProps {
  restaurantId: string;
  range: '30d' | '90d' | '180d';
}

export default function VisitFrequencyChart({
  restaurantId,
  range,
}: VisitFrequencyChartProps) {
  const [frequencies, setFrequencies] = useState<FrequencyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFrequencies();
  }, [restaurantId, range]);

  const fetchFrequencies = async () => {
    try {
      setLoading(true);
      const days = parseInt(range);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await fetch(
        `http://localhost:3001/api/v1/analytics/customer-analytics/visit-frequency/${restaurantId}?` +
          `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      const data = await response.json();

      if (data.success) {
        setFrequencies(data.data.frequencies);
      }
    } catch (error) {
      console.error('Failed to fetch visit frequency:', error);
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

  if (frequencies.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No frequency data available
      </div>
    );
  }

  const chartData = {
    labels: frequencies.map((f) => f.frequency),
    datasets: [
      {
        label: 'Customers',
        data: frequencies.map((f) => f.customerCount),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(168, 85, 247, 0.8)',
        ],
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const freq = frequencies[context.dataIndex];
            return [
              `${freq.customerCount} customers`,
              `${freq.percentage.toFixed(1)}% of total`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  return (
    <div className="h-64">
      <Bar data={chartData} options={options} />
    </div>
  );
}
