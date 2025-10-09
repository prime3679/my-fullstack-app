import { EventEmitter } from 'events';

export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED', 
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  FAILED = 'FAILED'
}

export interface WebSocketConfig {
  url: string;
  restaurantId: string;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

export interface WebSocketMessage {
  id?: string;
  type: string;
  data?: Record<string, unknown>;
  timestamp?: number;
  messageId?: string;
  filters?: Record<string, unknown>;
}

export class KitchenWebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private messageQueue: WebSocketMessage[] = [];
  private pendingAcks = new Map<string, WebSocketMessage>();
  private clientId?: string;

  constructor(config: WebSocketConfig) {
    super();
    
    this.config = {
      url: config.url,
      restaurantId: config.restaurantId,
      reconnect: config.reconnect ?? true,
      reconnectAttempts: config.reconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 5000,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
      debug: config.debug ?? false
    };
  }

  // Connection management

  connect(): void {
    if (this.state === ConnectionState.CONNECTED || 
        this.state === ConnectionState.CONNECTING) {
      this.log('Already connected or connecting');
      return;
    }

    this.setState(ConnectionState.CONNECTING);
    this.log('Connecting to WebSocket', this.config.url);

    try {
      const wsUrl = `${this.config.url}/ws/kitchen/${this.config.restaurantId}`;
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      this.log('Connection error', error);
      this.handleConnectionError(error);
    }
  }

  disconnect(): void {
    this.log('Disconnecting');
    this.config.reconnect = false;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.setState(ConnectionState.DISCONNECTED);
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.log('WebSocket connected');
      this.handleConnectionOpen();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    this.ws.onerror = (error) => {
      this.log('WebSocket error', error);
      this.handleConnectionError(error);
    };

    this.ws.onclose = (event) => {
      this.log('WebSocket closed', { code: event.code, reason: event.reason });
      this.handleConnectionClose(event);
    };
  }

  private handleConnectionOpen(): void {
    this.setState(ConnectionState.CONNECTED);
    this.reconnectAttempts = 0;
    
    // Clear reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    // Start heartbeat
    this.startHeartbeat();

    // Process queued messages
    this.processMessageQueue();

    // Emit connected event
    this.emit('connected');
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      this.log('Message received', message);

      // Handle system messages
      switch (message.type) {
        case 'connected':
          this.clientId = message.clientId;
          this.emit('connected', message);
          break;

        case 'HEARTBEAT':
          this.sendHeartbeatAck();
          break;

        case 'HEARTBEAT_ACK':
          // Heartbeat acknowledged
          break;

        case 'ACK':
          this.handleAcknowledgment(message.messageId);
          break;

        case 'ERROR':
          this.emit('error', message.data);
          break;

        case 'ticket_updated':
          this.emit('ticketUpdated', message.ticket);
          break;

        case 'new_ticket':
          this.emit('newTicket', message.ticket);
          break;

        case 'ticket_ready':
          this.emit('ticketReady', message.ticket);
          // Play sound if specified
          if (message.sound) {
            this.playSound(message.sound);
          }
          break;

        case 'timer_update':
          this.emit('timerUpdate', { 
            ticketId: message.ticketId, 
            timeData: message.timeData 
          });
          break;

        case 'emergency_alert':
          this.emit('emergencyAlert', message.alert);
          // Play emergency sound
          if (message.sound) {
            this.playSound(message.sound);
          }
          break;

        case 'stats_updated':
          this.emit('statsUpdated', message.stats);
          break;

        default:
          // Emit generic message event
          this.emit('message', message);
      }

      // Send acknowledgment for DATA messages
      if (message.type === 'DATA' && message.id) {
        this.sendAcknowledgment(message.id);
      }
    } catch (error) {
      this.log('Failed to parse message', error);
      this.emit('error', { type: 'PARSE_ERROR', error });
    }
  }

  private handleConnectionError(error: unknown): void {
    this.emit('error', error);
    
    if (this.state === ConnectionState.CONNECTING) {
      this.handleReconnection();
    }
  }

  private handleConnectionClose(event: CloseEvent): void {
    this.cleanup();
    
    const wasConnected = this.state === ConnectionState.CONNECTED;
    this.setState(ConnectionState.DISCONNECTED);
    
    // Emit disconnected event
    this.emit('disconnected', { 
      code: event.code, 
      reason: event.reason,
      wasClean: event.wasClean 
    });

    // Attempt reconnection if configured
    if (this.config.reconnect && wasConnected) {
      this.handleReconnection();
    }
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts >= this.config.reconnectAttempts) {
      this.log('Max reconnection attempts reached');
      this.setState(ConnectionState.FAILED);
      this.emit('failed', { reason: 'MAX_RECONNECT_ATTEMPTS' });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectDelay * this.reconnectAttempts;
    
    this.setState(ConnectionState.RECONNECTING);
    this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);

    this.emit('reconnecting', { 
      attempt: this.reconnectAttempts, 
      maxAttempts: this.config.reconnectAttempts,
      delay 
    });
  }

  // Heartbeat management

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.state === ConnectionState.CONNECTED) {
        this.sendHeartbeat();
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private sendHeartbeat(): void {
    this.send({
      type: 'HEARTBEAT',
      timestamp: Date.now()
    });
  }

  private sendHeartbeatAck(): void {
    this.send({
      type: 'HEARTBEAT_ACK',
      timestamp: Date.now()
    });
  }

  // Message handling

  send(message: WebSocketMessage): boolean {
    // Add message ID if not present
    if (!message.id) {
      message.id = this.generateMessageId();
    }

    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    // Queue message if not connected
    if (this.state !== ConnectionState.CONNECTED || !this.ws) {
      this.messageQueue.push(message);
      this.log('Message queued', message);
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      this.log('Message sent', message);
      
      // Track for acknowledgment if it's a DATA message
      if (message.type === 'DATA') {
        this.pendingAcks.set(message.id, message);
        
        // Set timeout for acknowledgment
        setTimeout(() => {
          if (this.pendingAcks.has(message.id!)) {
            this.handleMessageTimeout(message.id!);
          }
        }, 10000); // 10 second timeout
      }
      
      return true;
    } catch (error) {
      this.log('Failed to send message', error);
      this.messageQueue.push(message);
      return false;
    }
  }

  private sendAcknowledgment(messageId: string): void {
    this.send({
      type: 'ACK',
      messageId,
      timestamp: Date.now()
    });
  }

  private handleAcknowledgment(messageId: string): void {
    if (this.pendingAcks.has(messageId)) {
      this.pendingAcks.delete(messageId);
      this.log('Message acknowledged', messageId);
    }
  }

  private handleMessageTimeout(messageId: string): void {
    const message = this.pendingAcks.get(messageId);
    if (message) {
      this.pendingAcks.delete(messageId);
      this.log('Message timeout', messageId);
      this.emit('messageTimeout', message);
      
      // Retry sending
      this.messageQueue.push(message);
    }
  }

  private processMessageQueue(): void {
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    for (const message of queue) {
      this.send(message);
    }
    
    if (queue.length > 0) {
      this.log(`Processed ${queue.length} queued messages`);
    }
  }

  // Utility methods

  subscribe(filters: Record<string, unknown>): void {
    this.send({
      type: 'subscribe',
      filters
    });
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  getClientId(): string | undefined {
    return this.clientId;
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  getPendingAcks(): number {
    return this.pendingAcks.size;
  }

  private setState(state: ConnectionState): void {
    const previousState = this.state;
    this.state = state;
    
    if (previousState !== state) {
      this.log(`State changed: ${previousState} -> ${state}`);
      this.emit('stateChange', { previousState, newState: state });
    }
  }

  private cleanup(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private playSound(soundName: string): void {
    // Implementation would depend on your audio setup
    // For now, just emit an event
    this.emit('playSound', soundName);
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[WebSocket]', ...args);
    }
  }
}

// React Hook for WebSocket
import { useEffect, useRef, useState } from 'react';

export interface UseWebSocketOptions extends Omit<WebSocketConfig, 'url' | 'restaurantId'> {
  autoConnect?: boolean;
}

export function useKitchenWebSocket(
  restaurantId: string,
  options?: UseWebSocketOptions
) {
  const [state, setState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<KitchenWebSocketClient | undefined>(undefined);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';
    
    const client = new KitchenWebSocketClient({
      url: wsUrl,
      restaurantId,
      ...options
    });

    // Set up event listeners
    client.on('stateChange', ({ newState }) => {
      setState(newState);
      setIsConnected(newState === ConnectionState.CONNECTED);
    });

    clientRef.current = client;

    // Auto-connect if enabled (default true)
    if (options?.autoConnect !== false) {
      client.connect();
    }

    // Cleanup on unmount
    return () => {
      client.disconnect();
    };
  }, [restaurantId, options]);

  return {
    client: clientRef.current,
    state,
    isConnected,
    connect: () => clientRef.current?.connect(),
    disconnect: () => clientRef.current?.disconnect(),
    send: (message: WebSocketMessage) => clientRef.current?.send(message) ?? false,
    subscribe: (filters: Record<string, unknown>) => clientRef.current?.subscribe(filters)
  };
}
