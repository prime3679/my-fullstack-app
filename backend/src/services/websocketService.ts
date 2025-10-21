/**
 * WebSocket Service
 * Manages real-time connections for kitchen dashboard
 */

import { FastifyInstance } from 'fastify';
import { Logger } from '../lib/logger';

interface Client {
  socket: any;
  restaurantId: string;
}

export class WebSocketService {
  private clients: Set<Client> = new Set();

  /**
   * Initialize WebSocket server
   */
  init(fastify: FastifyInstance) {
    fastify.get('/ws/kitchen/:restaurantId', { websocket: true }, (connection, req) => {
      const { restaurantId } = req.params as { restaurantId: string };

      const client: Client = {
        socket: connection.socket,
        restaurantId,
      };

      this.clients.add(client);

      Logger.info('Kitchen WebSocket client connected', {
        restaurantId,
        totalClients: this.clients.size,
      });

      // Send initial connection message
      connection.socket.send(
        JSON.stringify({
          type: 'connected',
          restaurantId,
          timestamp: new Date().toISOString(),
        })
      );

      // Handle incoming messages
      connection.socket.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          Logger.info('WebSocket message received', { data });

          // Handle ping/pong for keepalive
          if (data.type === 'ping') {
            connection.socket.send(
              JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
              })
            );
          }
        } catch (error) {
          Logger.error('Failed to parse WebSocket message', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      // Handle disconnection
      connection.socket.on('close', () => {
        this.clients.delete(client);
        Logger.info('Kitchen WebSocket client disconnected', {
          restaurantId,
          totalClients: this.clients.size,
        });
      });

      connection.socket.on('error', (error: Error) => {
        Logger.error('WebSocket error', {
          restaurantId,
          error: error.message,
        });
        this.clients.delete(client);
      });
    });
  }

  /**
   * Broadcast ticket update to all clients for a restaurant
   */
  broadcastTicketUpdate(restaurantId: string, ticket: any) {
    const message = JSON.stringify({
      type: 'ticket_update',
      ticket,
      timestamp: new Date().toISOString(),
    });

    let sentCount = 0;
    for (const client of this.clients) {
      if (client.restaurantId === restaurantId) {
        try {
          client.socket.send(message);
          sentCount++;
        } catch (error) {
          Logger.error('Failed to send WebSocket message', {
            error: error instanceof Error ? error.message : String(error),
          });
          this.clients.delete(client);
        }
      }
    }

    Logger.info('Broadcast ticket update', {
      restaurantId,
      ticketId: ticket.id,
      clientsSent: sentCount,
    });
  }

  /**
   * Broadcast ticket deletion to all clients for a restaurant
   */
  broadcastTicketDeleted(restaurantId: string, ticketId: string) {
    const message = JSON.stringify({
      type: 'ticket_deleted',
      ticketId,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.restaurantId === restaurantId) {
        try {
          client.socket.send(message);
        } catch (error) {
          Logger.error('Failed to send WebSocket message', {
            error: error instanceof Error ? error.message : String(error),
          });
          this.clients.delete(client);
        }
      }
    }
  }

  /**
   * Get count of connected clients for a restaurant
   */
  getClientCount(restaurantId: string): number {
    let count = 0;
    for (const client of this.clients) {
      if (client.restaurantId === restaurantId) {
        count++;
      }
    }
    return count;
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
