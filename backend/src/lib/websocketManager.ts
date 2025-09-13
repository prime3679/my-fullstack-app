import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';

interface SocketStream {
  on(event: 'message', handler: (message: Buffer) => void): void;
  on(event: 'close', handler: () => void): void;
  send(message: string): void;
  readyState: number;
}

interface KitchenClient {
  websocket: SocketStream;
  restaurantId: string;
  clientId: string;
  connectedAt: Date;
}

interface ClientMessage {
  type: string;
  filters?: any;
  [key: string]: any;
}

export class WebSocketManager {
  private clients: Map<string, KitchenClient> = new Map();

  constructor(private fastify: FastifyInstance) {}

  // Register WebSocket routes and handlers
  async initialize() {
    // Kitchen dashboard WebSocket endpoint
    const self = this;
    await this.fastify.register(async function (fastify) {
      fastify.get('/ws/kitchen/:restaurantId', { websocket: true }, (connection, req) => {
        const restaurantId = (req.params as any).restaurantId as string;
        const clientId = `kitchen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        console.log(`Kitchen client connected: ${clientId} for restaurant ${restaurantId}`);

        // Store client connection
        const client: KitchenClient = {
          websocket: connection as SocketStream,
          restaurantId,
          clientId,
          connectedAt: new Date()
        };
        
        self.clients.set(clientId, client);

        // Handle client messages
        connection.on('message', (message: Buffer) => {
          try {
            const data: ClientMessage = JSON.parse(message.toString());
            self.handleClientMessage(clientId, data);
          } catch (error) {
            console.error('Invalid WebSocket message:', error);
          }
        });

        // Handle disconnection
        connection.on('close', () => {
          console.log(`Kitchen client disconnected: ${clientId}`);
          self.clients.delete(clientId);
        });

        // Send initial connection confirmation
        self.sendToClient(clientId, {
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
    if (!client) return;

    console.log(`Message from ${clientId}:`, data);

    switch (data.type) {
      case 'ping':
        this.sendToClient(clientId, {
          type: 'pong',
          timestamp: new Date().toISOString()
        });
        break;
      
      case 'subscribe':
        // Client subscribing to specific ticket updates
        this.sendToClient(clientId, {
          type: 'subscribed',
          filters: data.filters,
          timestamp: new Date().toISOString()
        });
        break;
    }
  }

  // Send message to a specific client
  private sendToClient(clientId: string, data: any): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.websocket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.websocket.send(JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`Failed to send to client ${clientId}:`, error);
      this.clients.delete(clientId);
      return false;
    }
  }

  // Broadcast to all clients for a specific restaurant
  broadcastToRestaurant(restaurantId: string, data: any): number {
    const restaurantClients = Array.from(this.clients.values())
      .filter(client => client.restaurantId === restaurantId);

    const successCount = restaurantClients.reduce((count, client) => {
      return this.sendToClient(client.clientId, data) ? count + 1 : count;
    }, 0);

    console.log(`Broadcasted to ${successCount}/${restaurantClients.length} clients for restaurant ${restaurantId}`);
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
      console.log(`Cleaned up ${disconnectedClients.length} disconnected clients`);
    }

    return disconnectedClients.length;
  }
}

// Singleton instance
export let websocketManager: WebSocketManager;