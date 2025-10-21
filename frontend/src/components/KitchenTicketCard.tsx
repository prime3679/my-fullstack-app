'use client';

import { useEffect, useState } from 'react';

interface KitchenTicket {
  id: string;
  status: 'PENDING' | 'HOLD' | 'FIRED' | 'READY' | 'SERVED';
  targetFireTime: string | null;
  firedAt: string | null;
  readyAt: string | null;
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

interface KitchenTicketCardProps {
  ticket: KitchenTicket;
  onStatusUpdate: (ticketId: string, action: 'fire' | 'ready' | 'served' | 'hold') => void;
}

export default function KitchenTicketCard({
  ticket,
  onStatusUpdate,
}: KitchenTicketCardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update current time every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (): string => {
    if (ticket.status === 'READY') return 'border-green-500 bg-green-900/20';
    if (ticket.pacingStatus === 'late') return 'border-red-500 bg-red-900/20';
    if (ticket.pacingStatus === 'warning') return 'border-yellow-500 bg-yellow-900/20';
    if (ticket.status === 'FIRED') return 'border-orange-500 bg-orange-900/20';
    return 'border-gray-600 bg-gray-800';
  };

  const getPacingIndicator = (): { text: string; color: string } => {
    if (ticket.status === 'READY') {
      return { text: 'READY', color: 'text-green-400' };
    }

    if (ticket.status === 'FIRED') {
      const minutes = Math.floor(
        (currentTime.getTime() - new Date(ticket.firedAt!).getTime()) / (1000 * 60)
      );
      const seconds =
        Math.floor((currentTime.getTime() - new Date(ticket.firedAt!).getTime()) / 1000) % 60;

      if (ticket.pacingStatus === 'late') {
        return { text: `⚠️ ${minutes}:${seconds.toString().padStart(2, '0')} LATE`, color: 'text-red-400' };
      }
      if (ticket.pacingStatus === 'warning') {
        return {
          text: `⚡ ${minutes}:${seconds.toString().padStart(2, '0')} Warning`,
          color: 'text-yellow-400',
        };
      }
      return {
        text: `⏱️ ${minutes}:${seconds.toString().padStart(2, '0')} Cooking`,
        color: 'text-orange-400',
      };
    }

    if (ticket.targetFireTime) {
      const minutesUntil = Math.floor(
        (new Date(ticket.targetFireTime).getTime() - currentTime.getTime()) / (1000 * 60)
      );

      if (minutesUntil < 0) {
        return { text: `🔥 FIRE NOW (${Math.abs(minutesUntil)}m late)`, color: 'text-red-400' };
      }
      if (minutesUntil <= 2) {
        return { text: `⏰ Fire in ${minutesUntil}m`, color: 'text-yellow-400' };
      }
      return { text: `Fire in ${minutesUntil}m`, color: 'text-gray-400' };
    }

    return { text: 'Waiting', color: 'text-gray-500' };
  };

  const pacing = getPacingIndicator();

  const getActionButtons = () => {
    if (ticket.status === 'PENDING' || ticket.status === 'HOLD') {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => onStatusUpdate(ticket.id, 'fire')}
            className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            🔥 FIRE
          </button>
          {ticket.status === 'PENDING' && (
            <button
              onClick={() => onStatusUpdate(ticket.id, 'hold')}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-3 rounded transition-colors"
            >
              ⏸️
            </button>
          )}
        </div>
      );
    }

    if (ticket.status === 'FIRED') {
      return (
        <button
          onClick={() => onStatusUpdate(ticket.id, 'ready')}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded transition-colors"
        >
          ✓ MARK READY
        </button>
      );
    }

    if (ticket.status === 'READY') {
      return (
        <button
          onClick={() => onStatusUpdate(ticket.id, 'served')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors"
        >
          🍽️ SERVED
        </button>
      );
    }

    return null;
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupItemsByCourse = () => {
    if (!ticket.preOrder) return {};

    const grouped: Record<string, typeof ticket.preOrder.items> = {};

    for (const item of ticket.preOrder.items) {
      const course = item.menuItem.course || 'Main';
      if (!grouped[course]) {
        grouped[course] = [];
      }
      grouped[course].push(item);
    }

    return grouped;
  };

  const itemsByCourse = groupItemsByCourse();

  return (
    <div
      className={`rounded-lg border-2 ${getStatusColor()} p-4 shadow-lg transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-white">
              Table {ticket.reservation.table?.number || '?'}
            </span>
            {ticket.status === 'HOLD' && (
              <span className="text-xs bg-yellow-600 text-white px-2 py-1 rounded">
                HOLD
              </span>
            )}
          </div>
          <div className="text-sm text-gray-400">
            {ticket.reservation.user?.name || 'Guest'} · Party of{' '}
            {ticket.reservation.partySize}
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-semibold ${pacing.color}`}>{pacing.text}</div>
          <div className="text-xs text-gray-500">
            Res: {formatTime(ticket.reservation.startAt)}
          </div>
        </div>
      </div>

      {/* Order Items */}
      {ticket.preOrder && (
        <div className="mb-3 space-y-2">
          {Object.entries(itemsByCourse).map(([course, items]) => (
            <div key={course}>
              {Object.keys(itemsByCourse).length > 1 && (
                <div className="text-xs font-semibold text-gray-400 uppercase mb-1">
                  {course}
                </div>
              )}
              {items.map((item) => (
                <div key={item.id} className="text-sm text-gray-200 pl-2">
                  <span className="font-semibold text-white">{item.quantity}x</span>{' '}
                  {item.menuItem.name}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="text-xs text-gray-400 pl-6">
                      {item.modifiers.join(', ')}
                    </div>
                  )}
                  {item.specialInstructions && (
                    <div className="text-xs text-yellow-400 pl-6 italic">
                      Note: {item.specialInstructions}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4">{getActionButtons()}</div>

      {/* Timestamps */}
      {(ticket.firedAt || ticket.readyAt) && (
        <div className="mt-3 pt-3 border-t border-gray-700 text-xs text-gray-500 space-y-1">
          {ticket.firedAt && (
            <div>Fired: {formatTime(ticket.firedAt)}</div>
          )}
          {ticket.readyAt && (
            <div>Ready: {formatTime(ticket.readyAt)}</div>
          )}
        </div>
      )}
    </div>
  );
}
