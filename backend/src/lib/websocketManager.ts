import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { z } from 'zod';
import Logger from './logger';

interface SocketStream {
  on(event: 'message', handler: (message: Buffer) => void): void;
  on(event: 'close', handler: () => void): void;
  on(event: 'error', handler: (error: unknown) => void): void;
  send(message: string): void;
  readyState: number;
}

function formatErrorPayload(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }

  return {
    name: 'UnknownError',
    message: String(error)
  };
}

const subscriptionFilterSchema = z.object({
  statuses: z.array(z.string()).optional(),
  stations: z.array(z.string()).optional(),
  ticketIds: z.array(z.string()).optional()
});

type SubscriptionFilters = z.infer<typeof subscriptionFilterSchema>;

const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ping') }),
  z.object({ type: z.literal('subscribe'), filters: subscriptionFilterSchema.default({}) }),
  z.object({ type: z.literal('unsubscribe') }),
  z.object({ type: z.literal('ack'), messageId: z.string() })
]);

type ClientMessage = z.infer<typeof clientMessageSchema>;

type ConnectionAckMessage = {
  type: 'connected';
  clientId: string;
  restaurantId: string;
  timestamp: string;
};

type SubscriptionAckMessage = {
  type: 'subscribed';
  filters: SubscriptionFilters;
  timestamp: string;
};

type PongMessage = {
  type: 'pong';
  timestamp: string;
};

type ErrorMessage = {
  type: 'error';
  message: string;
  details?: unknown;
  timestamp: string;
};

type TicketNotification = {
  type: 'ticket_updated' | 'new_ticket' | 'ticket_ready';
  ticket: Record<string, unknown>;
  timestamp: string;
  sound?: string;
  priority?: 'high';
};

type StatsNotification = {
  type: 'stats_updated';
  stats: Record<string, unknown>;
  timestamp: string;
};

type TimerNotification = {
  type: 'timer_update';
  ticketId: string;
  timeData: Record<string, unknown>;
  timestamp: string;
};

type EmergencyNotification = {
  type: 'emergency_alert';
  alert: Record<string, unknown>;
  timestamp: string;
  priority: 'high';
  sound: 'emergency_alert';
};

type KitchenBroadcastMessage =
  | TicketNotification
  | StatsNotification
  | TimerNotification
  | EmergencyNotification;

type ServerMessage =
  | ConnectionAckMessage
  | SubscriptionAckMessage
  | PongMessage
  | ErrorMessage
  | KitchenBroadcastMessage;

interface KitchenClient {
  websocket: SocketStream;
  restaurantId: string;
  clientId: string;
  connectedAt: Date;
  lastSeenAt: Date;
  filters?: SubscriptionFilters;
}

interface KitchenRouteParams {
  restaurantId: string;
}

export class WebSocketManager {
  private clients: Map<string, KitchenClient> = new Map();

  constructor(private fastify: FastifyInstance) {}

  // Register WebSocket routes and handlers
  async initialize(): Promise<void> {
    await this.fastify.register(async fastifyInstance => {
      fastifyInstance.get<{ Params: KitchenRouteParams }>('/ws/kitchen/:restaurantId', { websocket: true }, (connection, req) => {
        const { restaurantId } = req.params;
        const clientId = `kitchen_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

        Logger.info('Kitchen client connected', { clientId, restaurantId });

        const client: KitchenClient = {
          websocket: connection,
          restaurantId,
          clientId,
          connectedAt: new Date(),
          lastSeenAt: new Date()
        };

        this.clients.set(clientId, client);

        connection.on('message', (message: Buffer) => {
          client.lastSeenAt = new Date();
          const parsed = this.parseClientMessage(clientId, message);
          if (parsed) {
            this.handleClientMessage(clientId, parsed);
          }
        });

        connection.on('close', () => {
          Logger.info('Kitchen client disconnected', { clientId, restaurantId });
          this.clients.delete(clientId);
        });

        connection.on('error', error => {
          Logger.error('WebSocket error on kitchen connection', {
            clientId,
            restaurantId,
            error: formatErrorPayload(error)
          });
        });

        this.sendToClient(clientId, {
          type: 'connected',
          clientId,
          restaurantId,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  // Handle incoming messages from clients
  private handleClientMessage(clientId: string, data: ClientMessage): void {
    const client = this.clients.get(clientId);
    if (!client) {
      Logger.warn('Received message for unknown WebSocket client', { clientId });
      return;
    }

    Logger.debug('Received WebSocket message', { clientId, messageType: data.type });

    switch (data.type) {
      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          timestamp: new Date().toISOString()
        });
        break;

      case 'subscribe':
        client.filters = data.filters;
        this.sendToClient(clientId, {
          type: 'subscribed',
          filters: data.filters,
          timestamp: new Date().toISOString()
        });
        break;

      case 'unsubscribe':
        client.filters = undefined;
        this.sendToClient(clientId, {
          type: 'subscribed',
          filters: {},
          timestamp: new Date().toISOString()
        });
        break;

      case 'ack':
        Logger.debug('Client acknowledged message', { clientId, messageId: data.messageId });
        break;

      default:
        this.sendToClient(clientId, {
          type: 'error',
          message: `Unhandled message type: ${(data as { type: string }).type}`,
          timestamp: new Date().toISOString()
        });
        break;
    }
  }

  // Send message to a specific client
  private sendToClient<T extends ServerMessage>(clientId: string, data: T): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      Logger.warn('Attempted to send WebSocket message to unknown client', { clientId, messageType: data.type });
      return false;
    }

    if (client.websocket.readyState !== WebSocket.OPEN) {
      Logger.warn('WebSocket client not open. Removing client.', {
        clientId,
        restaurantId: client.restaurantId,
        readyState: client.websocket.readyState
      });
      this.clients.delete(clientId);
      return false;
    }

    try {
      client.websocket.send(JSON.stringify(data));
      return true;
    } catch (error) {
      Logger.error('Failed to send WebSocket message', {
        clientId,
        restaurantId: client.restaurantId,
        messageType: data.type,
        error: formatErrorPayload(error)
      });
      this.clients.delete(clientId);
      return false;
    }
  }

  // Broadcast to all clients for a specific restaurant
  broadcastToRestaurant(restaurantId: string, data: KitchenBroadcastMessage): number {
    const restaurantClients = Array.from(this.clients.values()).filter(
      client => client.restaurantId === restaurantId
    );

    let successCount = 0;

    for (const client of restaurantClients) {
      if (!this.shouldDeliverMessage(client, data)) {
        continue;
      }

      if (this.sendToClient(client.clientId, data)) {
        successCount += 1;
      }
    }

    Logger.debug('Broadcasted WebSocket message', {
      restaurantId,
      messageType: data.type,
      delivered: successCount,
      connectedClients: restaurantClients.length
    });

    return successCount;
  }

  // Kitchen ticket status update notification
  notifyTicketUpdate(restaurantId: string, ticketData: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'ticket_updated',
      ticket: ticketData,
      timestamp: new Date().toISOString()
    });
  }

  // New kitchen ticket created
  notifyNewTicket(restaurantId: string, ticketData: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'new_ticket',
      ticket: ticketData,
      timestamp: new Date().toISOString()
    });
  }

  // Kitchen dashboard stats update
  notifyStatsUpdate(restaurantId: string, stats: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'stats_updated',
      stats,
      timestamp: new Date().toISOString()
    });
  }

  // Ticket ready for pickup notification
  notifyTicketReady(restaurantId: string, ticketData: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'ticket_ready',
      ticket: ticketData,
      timestamp: new Date().toISOString(),
      sound: 'ready_alert' // Trigger sound notification
    });
  }

  // Kitchen timer/pacing updates
  notifyTimerUpdate(restaurantId: string, ticketId: string, timeData: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'timer_update',
      ticketId,
      timeData,
      timestamp: new Date().toISOString()
    });
  }

  // Emergency kitchen alert (e.g., running very late)
  notifyEmergencyAlert(restaurantId: string, alert: any): number {
    return this.broadcastToRestaurant(restaurantId, {
      type: 'emergency_alert',
      alert,
      timestamp: new Date().toISOString(),
      priority: 'high',
      sound: 'emergency_alert'
    });
  }

  // Get connected clients info
  getConnectedClients(restaurantId?: string): KitchenClient[] {
    const allClients = Array.from(this.clients.values());

    if (restaurantId) {
      return allClients.filter(client => client.restaurantId === restaurantId);
    }

    return allClients;
  }

  private parseClientMessage(clientId: string, raw: Buffer): ClientMessage | null {
    try {
      const parsed = JSON.parse(raw.toString());
      const result = clientMessageSchema.safeParse(parsed);

      if (!result.success) {
        Logger.warn('Invalid WebSocket message payload', {
          clientId,
          issues: result.error.issues
        });

        this.sendToClient(clientId, {
          type: 'error',
          message: 'Invalid message format',
          details: result.error.issues,
          timestamp: new Date().toISOString()
        });

        return null;
      }

      return result.data;
    } catch (error) {
      Logger.error('Failed to parse WebSocket message', {
        clientId,
        error: formatErrorPayload(error)
      });

      this.sendToClient(clientId, {
        type: 'error',
        message: 'Malformed JSON payload',
        timestamp: new Date().toISOString()
      });

      return null;
    }
  }

  private shouldDeliverMessage(client: KitchenClient, message: KitchenBroadcastMessage): boolean {
    if (!client.filters) {
      return true;
    }

    const { filters } = client;

    if (filters.ticketIds && filters.ticketIds.length > 0) {
      if ('ticket' in message) {
        const ticketId = (message.ticket as Record<string, unknown>)?.['id'];
        if (ticketId && !filters.ticketIds.includes(String(ticketId))) {
          return false;
        }
      }

      if ('ticketId' in message && !filters.ticketIds.includes(message.ticketId)) {
        return false;
      }
    }

    if (filters.statuses && filters.statuses.length > 0 && 'ticket' in message) {
      const status = (message.ticket as Record<string, unknown>)?.['status'];
      if (status && !filters.statuses.includes(String(status))) {
        return false;
      }
    }

    if (filters.stations && filters.stations.length > 0 && 'ticket' in message) {
      const stationId = (message.ticket as Record<string, unknown>)?.['stationId'];
      if (stationId && !filters.stations.includes(String(stationId))) {
        return false;
      }
    }

    return true;
  }

  // Health check for WebSocket connections
  healthCheck() {
    const totalClients = this.clients.size;
    const clientsByRestaurant = Array.from(this.clients.values())
      .reduce((acc, client) => {
        acc[client.restaurantId] = (acc[client.restaurantId] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalConnections: totalClients,
      connectionsByRestaurant: clientsByRestaurant,
      timestamp: new Date().toISOString()
    };
  }

  // Cleanup disconnected clients
  cleanup(): number {
    const disconnectedClients: string[] = [];
    
    for (const [clientId, client] of this.clients.entries()) {
      if (client.websocket.readyState === WebSocket.CLOSED) {
        disconnectedClients.push(clientId);
        this.clients.delete(clientId);
      }
    }

    if (disconnectedClients.length > 0) {
      Logger.info('Cleaned up disconnected WebSocket clients', {
        count: disconnectedClients.length,
        clientIds: disconnectedClients
      });
    }

    return disconnectedClients.length;
  }
}

// Singleton instance
export let websocketManager: WebSocketManager;
