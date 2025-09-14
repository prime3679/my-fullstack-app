import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { Logger } from './logger';
import { EventEmitter } from 'events';

// Connection states
enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  DISCONNECTED = 'DISCONNECTED',
  FAILED = 'FAILED'
}

// Message types for reliability
enum MessageType {
  DATA = 'DATA',
  ACK = 'ACK',
  HEARTBEAT = 'HEARTBEAT',
  HEARTBEAT_ACK = 'HEARTBEAT_ACK',
  ERROR = 'ERROR',
  RECONNECT = 'RECONNECT'
}

interface WebSocketMessage {
  id: string;
  type: MessageType | string;
  data?: any;
  timestamp: number;
  retryCount?: number;
  messageId?: string;
}

interface ClientConnection {
  socket: any;
  clientId: string;
  restaurantId: string;
  state: ConnectionState;
  connectedAt: Date;
  lastHeartbeat: Date;
  messageQueue: WebSocketMessage[];
  pendingAcks: Map<string, WebSocketMessage>;
  reconnectAttempts: number;
  metadata?: Record<string, any>;
}

interface EnhancedWebSocketConfig {
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  reconnectMaxAttempts?: number;
  reconnectDelay?: number;
  messageTimeout?: number;
  maxQueueSize?: number;
}

export class EnhancedWebSocketManager extends EventEmitter {
  private clients: Map<string, ClientConnection> = new Map();
  private fastify: FastifyInstance;
  private config: Required<EnhancedWebSocketConfig>;
  private heartbeatTimer?: NodeJS.Timeout;
  
  constructor(fastify: FastifyInstance, config?: EnhancedWebSocketConfig) {
    super();
    this.fastify = fastify;
    
    // Default configuration
    this.config = {
      heartbeatInterval: config?.heartbeatInterval || 30000, // 30 seconds
      heartbeatTimeout: config?.heartbeatTimeout || 60000, // 60 seconds
      reconnectMaxAttempts: config?.reconnectMaxAttempts || 5,
      reconnectDelay: config?.reconnectDelay || 5000, // 5 seconds
      messageTimeout: config?.messageTimeout || 10000, // 10 seconds
      maxQueueSize: config?.maxQueueSize || 100
    };
  }

  async initialize() {
    const self = this;
    
    // Start heartbeat monitoring
    this.startHeartbeatMonitoring();
    
    await this.fastify.register(async function (fastify) {
      fastify.get('/ws/kitchen/:restaurantId', { websocket: true }, (connection, req) => {
        const restaurantId = (req.params as any).restaurantId as string;
        const clientId = self.generateClientId(restaurantId);
        
        self.handleNewConnection(clientId, restaurantId, connection);
      });
    });

    Logger.info('Enhanced WebSocket Manager initialized', {
      config: this.config
    });
  }

  private handleNewConnection(clientId: string, restaurantId: string, socket: any) {
    Logger.info('New WebSocket connection', { clientId, restaurantId });
    
    // Create client connection object
    const client: ClientConnection = {
      socket,
      clientId,
      restaurantId,
      state: ConnectionState.CONNECTING,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      messageQueue: [],
      pendingAcks: new Map(),
      reconnectAttempts: 0
    };
    
    // Store client
    this.clients.set(clientId, client);
    
    // Set up event handlers
    this.setupSocketHandlers(clientId, socket);
    
    // Update state to connected
    this.updateClientState(clientId, ConnectionState.CONNECTED);
    
    // Send connection confirmation
    this.sendMessage(clientId, {
      type: 'connected',
      clientId,
      restaurantId,
      timestamp: new Date().toISOString(),
      config: {
        heartbeatInterval: this.config.heartbeatInterval,
        reconnectSupported: true
      }
    });
    
    // Process any queued messages
    this.processMessageQueue(clientId);
    
    // Emit connection event
    this.emit('client:connected', { clientId, restaurantId });
  }

  private setupSocketHandlers(clientId: string, socket: any) {
    // Handle incoming messages
    socket.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleClientMessage(clientId, data);
      } catch (error) {
        Logger.error('Failed to parse WebSocket message', {
          clientId,
          error: this.formatError(error)
        });
        this.sendError(clientId, 'Invalid message format');
      }
    });
    
    // Handle disconnection
    socket.on('close', () => {
      this.handleDisconnection(clientId);
    });
    
    // Handle errors
    socket.on('error', (error: Error) => {
      Logger.error('WebSocket error', {
        clientId,
        error: this.formatError(error)
      });
      this.handleSocketError(clientId, error);
    });
  }

  private handleClientMessage(clientId: string, message: any) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Update last heartbeat
    client.lastHeartbeat = new Date();
    
    // Handle different message types
    switch (message.type) {
      case MessageType.HEARTBEAT:
        this.handleHeartbeat(clientId);
        break;
        
      case MessageType.ACK:
        this.handleAcknowledgment(clientId, message.messageId);
        break;
        
      case MessageType.DATA:
        this.handleDataMessage(clientId, message);
        break;
        
      case 'subscribe':
        this.handleSubscription(clientId, message.filters);
        break;
        
      default:
        // Emit custom event for application-specific handling
        this.emit('client:message', { clientId, message });
    }
  }

  private handleHeartbeat(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Send heartbeat acknowledgment
    this.sendRawMessage(clientId, {
      id: this.generateMessageId(),
      type: MessageType.HEARTBEAT_ACK,
      timestamp: Date.now()
    });
  }

  private handleAcknowledgment(clientId: string, messageId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Remove from pending acknowledgments
    const pendingMessage = client.pendingAcks.get(messageId);
    if (pendingMessage) {
      client.pendingAcks.delete(messageId);
      Logger.debug('Message acknowledged', { clientId, messageId });
    }
  }

  private handleDataMessage(clientId: string, message: any) {
    // Send acknowledgment
    this.sendRawMessage(clientId, {
      id: this.generateMessageId(),
      type: MessageType.ACK,
      messageId: message.id,
      timestamp: Date.now()
    });
    
    // Process the data message
    this.emit('client:data', { clientId, data: message.data });
  }

  private handleSubscription(clientId: string, filters: any) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Store subscription filters in metadata
    client.metadata = { ...client.metadata, filters };
    
    // Send subscription confirmation
    this.sendMessage(clientId, {
      type: 'subscribed',
      filters,
      timestamp: new Date().toISOString()
    });
    
    Logger.info('Client subscribed', { clientId, filters });
  }

  private handleDisconnection(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    Logger.info('Client disconnected', { clientId });
    
    // Update state
    this.updateClientState(clientId, ConnectionState.DISCONNECTED);
    
    // Attempt reconnection if configured
    if (client.reconnectAttempts < this.config.reconnectMaxAttempts) {
      this.scheduleReconnection(clientId);
    } else {
      // Max attempts reached, mark as failed
      this.updateClientState(clientId, ConnectionState.FAILED);
      this.clients.delete(clientId);
      this.emit('client:disconnected', { clientId, permanent: true });
    }
  }

  private handleSocketError(clientId: string, error: Error) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // Queue messages while handling error
    this.updateClientState(clientId, ConnectionState.RECONNECTING);
    
    // Emit error event
    this.emit('client:error', { clientId, error });
  }

  private scheduleReconnection(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    client.reconnectAttempts++;
    this.updateClientState(clientId, ConnectionState.RECONNECTING);
    
    setTimeout(() => {
      this.attemptReconnection(clientId);
    }, this.config.reconnectDelay * client.reconnectAttempts);
    
    Logger.info('Scheduling reconnection', {
      clientId,
      attempt: client.reconnectAttempts,
      maxAttempts: this.config.reconnectMaxAttempts
    });
  }

  private attemptReconnection(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    // In a real implementation, this would attempt to re-establish the connection
    // For now, we'll just emit an event for the application to handle
    this.emit('client:reconnecting', { clientId, attempt: client.reconnectAttempts });
    
    // If reconnection fails, handle disconnection again
    if (client.state !== ConnectionState.CONNECTED) {
      this.handleDisconnection(clientId);
    }
  }

  private startHeartbeatMonitoring() {
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      
      for (const [clientId, client] of this.clients.entries()) {
        const timeSinceLastHeartbeat = now - client.lastHeartbeat.getTime();
        
        if (timeSinceLastHeartbeat > this.config.heartbeatTimeout) {
          Logger.warn('Client heartbeat timeout', {
            clientId,
            lastHeartbeat: client.lastHeartbeat,
            timeout: this.config.heartbeatTimeout
          });
          
          // Consider client disconnected
          this.handleDisconnection(clientId);
        } else if (timeSinceLastHeartbeat > this.config.heartbeatInterval) {
          // Send heartbeat ping
          this.sendRawMessage(clientId, {
            id: this.generateMessageId(),
            type: MessageType.HEARTBEAT,
            timestamp: Date.now()
          });
        }
      }
      
      // Clean up failed connections
      this.cleanupFailedConnections();
    }, this.config.heartbeatInterval / 2);
  }

  private cleanupFailedConnections() {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.state === ConnectionState.FAILED) {
        this.clients.delete(clientId);
        Logger.info('Cleaned up failed connection', { clientId });
      }
    }
  }

  // Public methods for sending messages

  sendMessage(clientId: string, data: any): boolean {
    const message: WebSocketMessage = {
      id: this.generateMessageId(),
      type: MessageType.DATA,
      data,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    return this.queueAndSendMessage(clientId, message);
  }

  broadcastToRestaurant(restaurantId: string, data: any): number {
    const restaurantClients = Array.from(this.clients.values())
      .filter(client => client.restaurantId === restaurantId);
    
    let successCount = 0;
    for (const client of restaurantClients) {
      if (this.sendMessage(client.clientId, data)) {
        successCount++;
      }
    }
    
    Logger.info('Broadcast to restaurant', {
      restaurantId,
      successCount,
      totalClients: restaurantClients.length
    });
    
    return successCount;
  }

  // Kitchen-specific notification methods

  notifyTicketUpdate(restaurantId: string, ticketData: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'ticket_updated',
      ticket: ticketData,
      timestamp: new Date().toISOString()
    });
  }

  notifyNewTicket(restaurantId: string, ticketData: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'new_ticket',
      ticket: ticketData,
      timestamp: new Date().toISOString()
    });
  }

  notifyTicketReady(restaurantId: string, ticketData: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'ticket_ready',
      ticket: ticketData,
      timestamp: new Date().toISOString(),
      priority: 'high',
      sound: 'ready_alert'
    });
  }

  notifyTimerUpdate(restaurantId: string, ticketId: string, timeData: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'timer_update',
      ticketId,
      timeData,
      timestamp: new Date().toISOString()
    });
  }

  notifyEmergencyAlert(restaurantId: string, alert: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'emergency_alert',
      alert,
      timestamp: new Date().toISOString(),
      priority: 'critical',
      sound: 'emergency_alert'
    });
  }

  // Private helper methods

  private queueAndSendMessage(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;
    
    // Add to queue if not connected
    if (client.state !== ConnectionState.CONNECTED) {
      if (client.messageQueue.length < this.config.maxQueueSize) {
        client.messageQueue.push(message);
        Logger.debug('Message queued', { clientId, messageId: message.id });
        return true;
      } else {
        Logger.warn('Message queue full', { clientId, queueSize: client.messageQueue.length });
        return false;
      }
    }
    
    // Send immediately if connected
    return this.sendMessageWithRetry(clientId, message);
  }

  private sendMessageWithRetry(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || !client.socket) return false;
    
    try {
      client.socket.send(JSON.stringify(message));
      
      // Add to pending acknowledgments for reliable delivery
      client.pendingAcks.set(message.id, message);
      
      // Set timeout for acknowledgment
      setTimeout(() => {
        if (client.pendingAcks.has(message.id)) {
          this.handleMessageTimeout(clientId, message);
        }
      }, this.config.messageTimeout);
      
      return true;
    } catch (error) {
      Logger.error('Failed to send message', {
        clientId,
        messageId: message.id,
        error: this.formatError(error)
      });
      
      // Queue for retry
      if (message.retryCount! < 3) {
        message.retryCount = (message.retryCount || 0) + 1;
        client.messageQueue.push(message);
      }
      
      return false;
    }
  }

  private sendRawMessage(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || !client.socket || client.state !== ConnectionState.CONNECTED) {
      return false;
    }
    
    try {
      client.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      Logger.error('Failed to send raw message', {
        clientId,
        error: this.formatError(error)
      });
      return false;
    }
  }

  private handleMessageTimeout(clientId: string, message: WebSocketMessage) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    client.pendingAcks.delete(message.id);
    
    Logger.warn('Message timeout', {
      clientId,
      messageId: message.id,
      retryCount: message.retryCount
    });
    
    // Retry if within retry limit
    if ((message.retryCount || 0) < 3) {
      message.retryCount = (message.retryCount || 0) + 1;
      this.sendMessageWithRetry(clientId, message);
    } else {
      // Emit delivery failure event
      this.emit('message:failed', { clientId, message });
    }
  }

  private processMessageQueue(clientId: string) {
    const client = this.clients.get(clientId);
    if (!client || client.state !== ConnectionState.CONNECTED) return;
    
    const queue = [...client.messageQueue];
    client.messageQueue = [];
    
    for (const message of queue) {
      this.sendMessageWithRetry(clientId, message);
    }
    
    if (queue.length > 0) {
      Logger.info('Processed message queue', {
        clientId,
        messageCount: queue.length
      });
    }
  }

  private sendError(clientId: string, error: string) {
    this.sendRawMessage(clientId, {
      id: this.generateMessageId(),
      type: MessageType.ERROR,
      data: { error },
      timestamp: Date.now()
    });
  }

  private updateClientState(clientId: string, state: ConnectionState) {
    const client = this.clients.get(clientId);
    if (!client) return;
    
    const previousState = client.state;
    client.state = state;
    
    Logger.info('Client state updated', {
      clientId,
      previousState,
      newState: state
    });
    
    this.emit('client:stateChange', { clientId, previousState, newState: state });
  }

  private generateClientId(restaurantId: string): string {
    return `kitchen_${restaurantId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatError(error: unknown): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }
    return { message: String(error) };
  }

  // Monitoring and health check methods

  getConnectionStats() {
    const stats = {
      totalConnections: this.clients.size,
      connectionsByState: {} as Record<ConnectionState, number>,
      connectionsByRestaurant: {} as Record<string, number>,
      averageQueueSize: 0,
      totalPendingAcks: 0
    };
    
    for (const client of this.clients.values()) {
      // Count by state
      stats.connectionsByState[client.state] = (stats.connectionsByState[client.state] || 0) + 1;
      
      // Count by restaurant
      stats.connectionsByRestaurant[client.restaurantId] = 
        (stats.connectionsByRestaurant[client.restaurantId] || 0) + 1;
      
      // Calculate averages
      stats.averageQueueSize += client.messageQueue.length;
      stats.totalPendingAcks += client.pendingAcks.size;
    }
    
    if (this.clients.size > 0) {
      stats.averageQueueSize /= this.clients.size;
    }
    
    return stats;
  }

  getClientInfo(clientId: string): ClientConnection | undefined {
    return this.clients.get(clientId);
  }

  getRestaurantClients(restaurantId: string): ClientConnection[] {
    return Array.from(this.clients.values())
      .filter(client => client.restaurantId === restaurantId);
  }

  // Cleanup

  shutdown() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    
    // Close all connections
    for (const [clientId, client] of this.clients.entries()) {
      if (client.socket) {
        client.socket.close();
      }
    }
    
    this.clients.clear();
    this.removeAllListeners();
    
    Logger.info('Enhanced WebSocket Manager shutdown complete');
  }
}

// Export singleton instance
export let enhancedWebSocketManager: EnhancedWebSocketManager;

export function initializeEnhancedWebSocketManager(
  fastify: FastifyInstance,
  config?: EnhancedWebSocketConfig
): EnhancedWebSocketManager {
  enhancedWebSocketManager = new EnhancedWebSocketManager(fastify, config);
  return enhancedWebSocketManager;
}