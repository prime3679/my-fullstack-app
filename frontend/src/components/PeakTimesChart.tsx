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

interface PeakTimeData {
  hour: number;
  orderCount: number;
}

interface PeakTimesChartProps {
  restaurantId: string;
  range: '7d' | '30d' | '90d';
}

export default function PeakTimesChart({ restaurantId, range }: PeakTimesChartProps) {
  const [peakTimes, setPeakTimes] = useState<PeakTimeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPeakTimes();
  }, [restaurantId, range]);

  const fetchPeakTimes = async () => {
    try {
      setLoading(true);
      const days = parseInt(range);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await fetch(
        `http://localhost:3001/api/v1/analytics/peak-times/${restaurantId}?` +
          `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&groupBy=hour`
      );
      const data = await response.json();

      if (data.success) {
        // Fill in missing hours with 0
        const hourMap = new Map(data.data.peakTimes.map((d: PeakTimeData) => [d.hour, d.orderCount]));
        const allHours: PeakTimeData[] = [];
        for (let hour = 0; hour < 24; hour++) {
          allHours.push({
            hour,
            orderCount: hourMap.get(hour) || 0,
          });
        }
        setPeakTimes(allHours);
      }
    } catch (error) {
      console.error('Failed to fetch peak times:', error);
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

  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const chartData = {
    labels: peakTimes.map((d) => formatHour(d.hour)),
    datasets: [
      {
        label: 'Reservations',
        data: peakTimes.map((d) => d.orderCount),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
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
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
      x: {
        ticks: {
          maxRotation: 45,
          minRotation: 45,
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
