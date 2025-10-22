'use client';

import { useState } from 'react';
import { TableSelector } from './TableSelector';

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

interface ReservationCardProps {
  reservation: Reservation;
  tables: Table[];
  onAssignTable: (reservationId: string, tableId: string) => void;
  onUpdateStatus: (reservationId: string, status: string) => void;
  getStatusColor: (status: string) => string;
}

export function ReservationCard({
  reservation,
  tables,
  onAssignTable,
  onUpdateStatus,
  getStatusColor,
}: ReservationCardProps) {
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [showPreOrderDetails, setShowPreOrderDetails] = useState(false);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount / 100); // Assuming amount is in cents
  };

  const handleTableSelect = (tableId: string) => {
    onAssignTable(reservation.id, tableId);
    setShowTableSelector(false);
  };

  const totalPreOrderAmount = reservation.preOrder?.payments.reduce(
    (sum, payment) => sum + payment.totalAmount,
    0
  ) || 0;

  const preOrderItemCount = reservation.preOrder?.items.reduce(
    (sum, item) => sum + item.quantity,
    0
  ) || 0;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {reservation.user.name}
            </h3>
            <p className="text-sm text-gray-600">
              Party of {reservation.partySize}
            </p>
            {reservation.user.phone && (
              <p className="text-sm text-gray-500">{reservation.user.phone}</p>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
              reservation.status
            )}`}
          >
            {reservation.status.replace('_', ' ')}
          </span>
        </div>

        {/* Table Assignment */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-medium text-gray-700">Table</p>
              {reservation.table ? (
                <p className="text-sm font-semibold text-gray-900">
                  Table {reservation.table.number}
                  {reservation.table.zone && (
                    <span className="text-xs text-gray-600 ml-2">
                      ({reservation.table.zone})
                    </span>
                  )}
                  <span className="text-xs text-gray-500 ml-2">
                    • {reservation.table.seats} seats
                  </span>
                </p>
              ) : (
                <p className="text-sm text-gray-500">Not assigned</p>
              )}
            </div>
            <button
              onClick={() => setShowTableSelector(!showTableSelector)}
              className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
            >
              {reservation.table ? 'Change' : 'Assign'}
            </button>
          </div>

          {/* Table Selector Dropdown */}
          {showTableSelector && (
            <div className="mt-3">
              <TableSelector
                tables={tables}
                currentTableId={reservation.table?.id}
                partySize={reservation.partySize}
                reservationTime={reservation.startAt}
                onSelect={handleTableSelect}
                onCancel={() => setShowTableSelector(false)}
              />
            </div>
          )}
        </div>

        {/* Pre-Order Info */}
        {reservation.preOrder && (
          <div className="mb-4 p-3 bg-purple-50 rounded-lg">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs font-medium text-purple-700">Pre-Order</p>
                <p className="text-sm font-semibold text-purple-900">
                  {preOrderItemCount} items • {formatCurrency(totalPreOrderAmount)}
                </p>
                <p className="text-xs text-purple-600">
                  Payment:{' '}
                  {reservation.preOrder.payments[0]?.status || 'N/A'}
                </p>
              </div>
              <button
                onClick={() => setShowPreOrderDetails(!showPreOrderDetails)}
                className="px-3 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200 transition-colors"
              >
                {showPreOrderDetails ? 'Hide' : 'View'}
              </button>
            </div>

            {/* Pre-Order Items */}
            {showPreOrderDetails && (
              <div className="mt-3 pt-3 border-t border-purple-200">
                <div className="space-y-2">
                  {reservation.preOrder.items.map(item => (
                    <div key={item.id} className="text-sm">
                      <span className="font-medium">
                        {item.quantity}x {item.menuItem.name}
                      </span>
                      {item.menuItem.course && (
                        <span className="text-xs text-purple-600 ml-2">
                          ({item.menuItem.course})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Check-in Status */}
        {reservation.checkin && (
          <div className="mb-4 p-3 bg-green-50 rounded-lg">
            <p className="text-xs font-medium text-green-700">Checked In</p>
            <p className="text-sm text-green-900">
              {formatTime(reservation.checkin.checkedInAt)}
            </p>
          </div>
        )}

        {/* Kitchen Ticket Status */}
        {reservation.kitchenTicket && (
          <div className="mb-4 p-3 bg-orange-50 rounded-lg">
            <p className="text-xs font-medium text-orange-700">Kitchen Status</p>
            <p className="text-sm font-semibold text-orange-900">
              {reservation.kitchenTicket.status}
            </p>
          </div>
        )}

        {/* Special Requests */}
        {reservation.specialRequests && (
          <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
            <p className="text-xs font-medium text-yellow-700">Special Requests</p>
            <p className="text-sm text-yellow-900">{reservation.specialRequests}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 flex-wrap">
          {reservation.status === 'BOOKED' && (
            <>
              <button
                onClick={() => onUpdateStatus(reservation.id, 'CHECKED_IN')}
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Seat Party
              </button>
              <button
                onClick={() => onUpdateStatus(reservation.id, 'NO_SHOW')}
                className="px-3 py-2 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200 transition-colors"
              >
                No Show
              </button>
            </>
          )}

          {reservation.status === 'CHECKED_IN' && (
            <button
              onClick={() => onUpdateStatus(reservation.id, 'COMPLETED')}
              className="flex-1 px-3 py-2 bg-gray-600 text-white rounded text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Complete
            </button>
          )}

          {reservation.status === 'COMPLETED' && (
            <div className="flex-1 text-center py-2 text-sm text-gray-500">
              Reservation completed
            </div>
          )}

          {reservation.status === 'NO_SHOW' && (
            <button
              onClick={() => onUpdateStatus(reservation.id, 'BOOKED')}
              className="flex-1 px-3 py-2 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200 transition-colors"
            >
              Undo No Show
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
