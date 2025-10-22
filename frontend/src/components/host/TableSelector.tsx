'use client';

import { useMemo } from 'react';

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

interface TableSelectorProps {
  tables: Table[];
  currentTableId?: string;
  partySize: number;
  reservationTime: string;
  onSelect: (tableId: string) => void;
  onCancel: () => void;
}

export function TableSelector({
  tables,
  currentTableId,
  partySize,
  reservationTime,
  onSelect,
  onCancel,
}: TableSelectorProps) {
  // Group tables by location and zone
  const groupedTables = useMemo(() => {
    const groups: Record<string, Table[]> = {};

    tables.forEach(table => {
      const key = table.zone
        ? `${table.locationName} - ${table.zone}`
        : table.locationName;

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(table);
    });

    // Sort tables within each group by number
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const numA = parseInt(a.number, 10) || 0;
        const numB = parseInt(b.number, 10) || 0;
        return numA - numB;
      });
    });

    return groups;
  }, [tables]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTableClassName = (table: Table) => {
    const baseClass = 'p-3 rounded-lg border-2 cursor-pointer transition-all';

    // Current table
    if (table.id === currentTableId) {
      return `${baseClass} bg-blue-50 border-blue-500`;
    }

    // Table not available
    if (!table.isAvailable) {
      return `${baseClass} bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed`;
    }

    // Table too small for party size
    if (table.seats < partySize) {
      return `${baseClass} bg-yellow-50 border-yellow-300 hover:border-yellow-400`;
    }

    // Perfect match or larger
    return `${baseClass} bg-green-50 border-green-300 hover:border-green-500`;
  };

  const getTableIcon = (table: Table) => {
    if (table.id === currentTableId) {
      return '✓';
    }
    if (!table.isAvailable) {
      return '✕';
    }
    if (table.seats < partySize) {
      return '⚠';
    }
    return '✓';
  };

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 max-h-96 overflow-y-auto">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-1">Select Table</h3>
        <p className="text-xs text-gray-600">
          Party size: {partySize} • {formatTime(reservationTime)}
        </p>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 bg-green-50 border-2 border-green-300 rounded"></span>
          <span className="text-gray-700">Available</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 bg-yellow-50 border-2 border-yellow-300 rounded"></span>
          <span className="text-gray-700">Small</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded opacity-50"></span>
          <span className="text-gray-700">Occupied</span>
        </div>
      </div>

      {/* Tables grouped by location/zone */}
      <div className="space-y-4">
        {Object.entries(groupedTables).map(([groupName, groupTables]) => (
          <div key={groupName}>
            <h4 className="text-xs font-semibold text-gray-700 mb-2">{groupName}</h4>
            <div className="grid grid-cols-2 gap-2">
              {groupTables.map(table => (
                <div
                  key={table.id}
                  onClick={() => {
                    if (table.isAvailable || table.id === currentTableId) {
                      onSelect(table.id);
                    }
                  }}
                  className={getTableClassName(table)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          Table {table.number}
                        </span>
                        <span className="text-xs text-gray-600">
                          {getTableIcon(table)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{table.seats} seats</p>
                    </div>
                  </div>

                  {/* Show assigned reservation if occupied */}
                  {!table.isAvailable && table.assignedReservation && (
                    <div className="mt-2 pt-2 border-t border-gray-300">
                      <p className="text-xs text-gray-700 font-medium">
                        {table.assignedReservation.guestName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {table.assignedReservation.partySize} guests •{' '}
                        {formatTime(table.assignedReservation.startAt)}
                      </p>
                    </div>
                  )}

                  {/* Warning for small tables */}
                  {table.isAvailable && table.seats < partySize && (
                    <p className="text-xs text-yellow-700 mt-1">
                      ⚠ Seats fewer than party size
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* No tables available */}
      {tables.length === 0 && (
        <div className="text-center py-4">
          <p className="text-sm text-gray-600">No tables available</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
