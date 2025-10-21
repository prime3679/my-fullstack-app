'use client';

import { useEffect, useState } from 'react';

interface CustomerLTV {
  customerId: string;
  customerName: string;
  email: string;
  totalSpent: number;
  visitCount: number;
  averageOrderValue: number;
  firstVisit: string;
  lastVisit: string;
  daysSinceFirstVisit: number;
  segment: string;
}

interface CustomerLTVTableProps {
  restaurantId: string;
  range: '30d' | '90d' | '180d';
}

export default function CustomerLTVTable({
  restaurantId,
  range,
}: CustomerLTVTableProps) {
  const [customers, setCustomers] = useState<CustomerLTV[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCustomerLTV();
  }, [restaurantId, range]);

  const fetchCustomerLTV = async () => {
    try {
      setLoading(true);
      const days = parseInt(range);
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const response = await fetch(
        `http://localhost:3001/api/v1/analytics/customer-analytics/ltv/${restaurantId}?` +
          `startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}&limit=20`
      );
      const data = await response.json();

      if (data.success) {
        setCustomers(data.data.customers);
      }
    } catch (error) {
      console.error('Failed to fetch customer LTV:', error);
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

  if (customers.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No customer data available for this period
      </div>
    );
  }

  const getSegmentColor = (segment: string): string => {
    const colors: Record<string, string> = {
      Platinum: 'bg-purple-100 text-purple-800',
      Gold: 'bg-yellow-100 text-yellow-800',
      Silver: 'bg-gray-100 text-gray-800',
      Bronze: 'bg-orange-100 text-orange-800',
    };
    return colors[segment] || 'bg-blue-100 text-blue-800';
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rank
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Customer
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Segment
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Lifetime Value
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Visits
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Avg Order
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Visit
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {customers.map((customer, index) => (
            <tr key={customer.customerId} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                #{index + 1}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {customer.customerName}
                </div>
                <div className="text-sm text-gray-500">{customer.email}</div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getSegmentColor(
                    customer.segment
                  )}`}
                >
                  {customer.segment}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                ${customer.totalSpent.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {customer.visitCount}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                ${customer.averageOrderValue.toFixed(2)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(customer.lastVisit).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
