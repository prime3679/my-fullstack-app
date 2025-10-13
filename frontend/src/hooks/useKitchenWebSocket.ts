'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type KitchenTicketStatus = 'PENDING' | 'HOLD' | 'FIRED' | 'READY' | 'SERVED';

interface KitchenTicket {
  id: string;
  reservationId: string;
  status: KitchenTicketStatus;
  estimatedPrepMinutes: number;
  fireAt: string;
  firedAt?: string | null;
  readyAt?: string | null;
  servedAt?: string | null;
  itemsJson: Array<{
    name: string;
    quantity: number;
    modifiers: string[];
    notes: string;
  }>;
  pacingJson?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  reservation?: {
    id: string;
    partySize: number;
    startAt: string;
    user: {
      name: string;
      email: string;
    };
    preOrder?: {
      id: string;
      items: Array<{
        name: string;
        quantity: number;
        modifiers?: string[];
        notes?: string;
        allergens?: string[];
      }>;
    };
  };
}

interface KitchenStats {
  ticketCounts: Record<KitchenTicketStatus, number>;
  averagePrepTime: number;
  activeTickets: number;
}

interface WebSocketMessage {
  type: string;
  ticket?: KitchenTicket;
  tickets?: KitchenTicket[];
  stats?: KitchenStats;
  timestamp: string;
  sound?: string;
  priority?: string;
}

interface UseKitchenWebSocketOptions {
  restaurantId: string;
  onTicketUpdate?: (ticket: KitchenTicket) => void;
  onNewTicket?: (ticket: KitchenTicket) => void;
  onTicketReady?: (ticket: KitchenTicket) => void;
  onStatsUpdate?: (stats: KitchenStats) => void;
  onEmergencyAlert?: (alert: Record<string, unknown>) => void;
  enabled?: boolean;
}

export function useKitchenWebSocket(options: UseKitchenWebSocketOptions) {
  const {
    restaurantId,
    onTicketUpdate,
    onNewTicket,
    onTicketReady,
    onStatsUpdate,
    onEmergencyAlert,
    enabled = true
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const queryClient = useQueryClient();
  
  const onTicketUpdateRef = useRef(onTicketUpdate);
  const onNewTicketRef = useRef(onNewTicket);
  const onTicketReadyRef = useRef(onTicketReady);
  const onStatsUpdateRef = useRef(onStatsUpdate);
  const onEmergencyAlertRef = useRef(onEmergencyAlert);
  
  useEffect(() => {
    onTicketUpdateRef.current = onTicketUpdate;
    onNewTicketRef.current = onNewTicket;
    onTicketReadyRef.current = onTicketReady;
    onStatsUpdateRef.current = onStatsUpdate;
    onEmergencyAlertRef.current = onEmergencyAlert;
  }, [onTicketUpdate, onNewTicket, onTicketReady, onStatsUpdate, onEmergencyAlert]);

  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  // Play notification sounds
  const playNotificationSound = useCallback((soundType?: string) => {
    if (!soundType) return;

    try {
      // Create different audio contexts for different notifications
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Different sounds for different events
      switch (soundType) {
        case 'ready_alert':
          // Higher pitch for ready alerts
          oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
          oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.5);
          break;
          
        case 'emergency_alert':
          // Urgent beeping for emergencies
          oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.2);
          
          // Second beep
          setTimeout(() => {
            const osc2 = audioContext.createOscillator();
            const gain2 = audioContext.createGain();
            osc2.connect(gain2);
            gain2.connect(audioContext.destination);
            osc2.frequency.setValueAtTime(1000, audioContext.currentTime);
            gain2.gain.setValueAtTime(0.5, audioContext.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            osc2.start();
            osc2.stop(audioContext.currentTime + 0.2);
          }, 300);
          break;
          
        default:
          // Default notification sound
          oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.3);
      }
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !restaurantId) return;

    try {
      const defaultProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const defaultHost = window.location.hostname;
      const defaultPort = process.env.NODE_ENV === 'development' ? '3001' : window.location.port;

      let protocol = defaultProtocol;
      let host = defaultHost;
      let port = defaultPort;

      const apiBase = process.env.NEXT_PUBLIC_API_URL;

      if (apiBase) {
        try {
          const parsedUrl = new URL(apiBase);
          protocol = parsedUrl.protocol === 'https:' ? 'wss:' : 'ws:';
          host = parsedUrl.hostname;
          port = parsedUrl.port;
        } catch (error) {
          console.warn('Invalid NEXT_PUBLIC_API_URL for WebSocket connection, falling back to window location.', error);
        }
      }

      const portSegment = port ? `:${port}` : '';
      const wsUrl = `${protocol}//${host}${portSegment}/ws/kitchen/${restaurantId}`;

      console.log('Connecting to WebSocket:', wsUrl);

      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('Kitchen WebSocket connected');
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttempts.current = 0;

        // Send ping to establish connection
        wsRef.current?.send(JSON.stringify({ type: 'ping' }));
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          console.log('Kitchen WebSocket message:', message);

          // Handle different message types
          switch (message.type) {
            case 'connected':
              console.log('Kitchen WebSocket connection confirmed');
              break;

            case 'ticket_updated':
              if (message.ticket && onTicketUpdateRef.current) {
                onTicketUpdateRef.current(message.ticket);
              }
              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ['kitchen-tickets'] });
              queryClient.invalidateQueries({ queryKey: ['kitchen-dashboard'] });
              break;

            case 'new_ticket':
              if (message.ticket && onNewTicketRef.current) {
                onNewTicketRef.current(message.ticket);
              }
              // Play notification sound for new tickets
              playNotificationSound('default');
              queryClient.invalidateQueries({ queryKey: ['kitchen-tickets'] });
              queryClient.invalidateQueries({ queryKey: ['kitchen-dashboard'] });
              break;

            case 'ticket_ready':
              if (message.ticket && onTicketReadyRef.current) {
                onTicketReadyRef.current(message.ticket);
              }
              // Play special sound for ready tickets
              playNotificationSound(message.sound);
              queryClient.invalidateQueries({ queryKey: ['kitchen-tickets'] });
              break;

            case 'stats_updated':
              if (message.stats && onStatsUpdateRef.current) {
                onStatsUpdateRef.current(message.stats);
              }
              queryClient.invalidateQueries({ queryKey: ['kitchen-dashboard'] });
              break;

            case 'emergency_alert':
              if (onEmergencyAlertRef.current) {
                onEmergencyAlertRef.current(message as unknown as Record<string, unknown>);
              }
              // Play urgent sound for emergencies
              playNotificationSound(message.sound);
              break;

            case 'pong':
              // Heartbeat response
              break;

            default:
              console.log('Unknown WebSocket message type:', message.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('Kitchen WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);

        // Attempt to reconnect if not manually closed
        if (event.code !== 1000 && reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current);
          console.log(`Attempting to reconnect in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else if (reconnectAttempts.current >= MAX_RECONNECT_ATTEMPTS) {
          setConnectionError('Maximum reconnection attempts reached. Please refresh the page.');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('Kitchen WebSocket error:', error);
        setConnectionError('WebSocket connection error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionError('Failed to establish WebSocket connection');
    }
  }, [enabled, restaurantId, queryClient, playNotificationSound]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, [isConnected]);

  // Setup periodic ping to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const pingInterval = setInterval(() => {
      sendMessage({ type: 'ping' });
    }, 30000); // Ping every 30 seconds

    return () => clearInterval(pingInterval);
  }, [isConnected, sendMessage]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    connectionError,
    lastMessage,
    connect,
    disconnect,
    sendMessage
  };
}
