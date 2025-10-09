import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import websocket from '@fastify/websocket';
import { db } from './lib/db';
import { reservationRoutes } from './routes/reservations';
import { restaurantRoutes } from './routes/restaurants';
import { menuRoutes } from './routes/menu';
import { preOrderRoutes } from './routes/preorders';
import { kitchenRoutes } from './routes/kitchen';
import { checkinRoutes } from './routes/checkin';
import { authRoutes } from './routes/auth';
import { staffRoutes } from './routes/staff';
// import { paymentRoutes } from './routes/payments';
import { WebSocketManager, websocketManager } from './lib/websocketManager';
import { requestLoggingPlugin } from './lib/middleware';
import { SocialAuthService } from './lib/socialAuth';
import { emailService } from './lib/emailService';
import { getQueueHealth, closeQueue } from './lib/jobQueue';
import './lib/jobs/emailJobs'; // Initialize job processors
import Logger from './lib/logger';
import dotenv from 'dotenv';

dotenv.config();

const fastify = Fastify({
  logger: true
});

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    // Register plugins
    await fastify.register(helmet);
    await fastify.register(cors, {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
    });
    await fastify.register(websocket);
    
    // Register logging middleware
    await fastify.register(requestLoggingPlugin);

    // Initialize social authentication
    SocialAuthService.initialize();
    
    // Test email service connection (with timeout to avoid blocking startup)
    const emailConnectionPromise = emailService.testConnection();
    const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000));
    const emailConnected = await Promise.race([emailConnectionPromise, timeoutPromise]);
    Logger.info('Email service initialization', { connected: emailConnected });

    // Register routes
    await fastify.register(authRoutes, { prefix: '/api/v1/auth' });
    await fastify.register(staffRoutes, { prefix: '/api/v1/staff' });
    await fastify.register(restaurantRoutes, { prefix: '/api/v1/restaurants' });
    await fastify.register(reservationRoutes, { prefix: '/api/v1/reservations' });
    await fastify.register(menuRoutes, { prefix: '/api/v1/menu' });
    await fastify.register(preOrderRoutes, { prefix: '/api/v1/preorders' });
    await fastify.register(kitchenRoutes, { prefix: '/api/v1/kitchen' });
    await fastify.register(checkinRoutes, { prefix: '/api/v1/checkin' });
    // await fastify.register(paymentRoutes, { prefix: '/api/v1/payments' });

    // Initialize WebSocket manager
    const wsManager = new WebSocketManager(fastify);
    await wsManager.initialize();
    
    // Export websocket manager for use in other modules
    (global as any).websocketManager = wsManager;

    // Health check endpoint
    fastify.get('/api/health', async (request, reply) => {
      const dbHealth = await db.$queryRaw`SELECT 1 as connected`;
      const queueHealth = await getQueueHealth();
      return {
        status: 'OK',
        message: 'La Carta server is running',
        database: dbHealth ? 'connected' : 'disconnected',
        queue: queueHealth,
        timestamp: new Date().toISOString()
      };
    });

    // Demo endpoint for testing
    fastify.get('/api/restaurants', async (request, reply) => {
      try {
        const restaurants = await db.restaurant.findMany({
          include: {
            locations: {
              include: {
                tables: true
              }
            },
            _count: {
              select: {
                reservations: true,
                users: true
              }
            }
          }
        });
        return { restaurants };
      } catch (error) {
        reply.code(500).send({ error: 'Failed to fetch restaurants' });
      }
    });

    // Demo reservation endpoint
    fastify.get('/api/reservations', async (request, reply) => {
      try {
        const reservations = await db.reservation.findMany({
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            restaurant: {
              select: {
                id: true,
                name: true,
                slug: true
              }
            },
            preOrder: {
              include: {
                items: true,
                payments: true
              }
            }
          },
          orderBy: {
            startAt: 'desc'
          }
        });
        return { reservations };
      } catch (error) {
        reply.code(500).send({ error: 'Failed to fetch reservations' });
      }
    });

    // Error handler
    fastify.setErrorHandler((error, request, reply) => {
      Logger.error('Unhandled server error', {
        requestId: request.context?.requestId,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        ip: request.context?.ip,
        userAgent: request.context?.userAgent
      });
      
      reply.code(500).send({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });

    // Start server
    await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
    Logger.info(`Server started successfully on port ${PORT}`, {
      port: PORT,
      environment: process.env.NODE_ENV || 'development',
      action: 'SERVER_STARTED'
    });
  } catch (error) {
    Logger.error('Failed to start server', {
      error: {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      }
    });
    process.exit(1);
  }
}

// Handle graceful shutdown
const gracefulShutdown = async () => {
  try {
    Logger.info('Shutting down server gracefully', { action: 'SERVER_SHUTDOWN_INITIATED' });
    await closeQueue();
    await db.$disconnect();
    await fastify.close();
    Logger.info('Server shut down successfully', { action: 'SERVER_SHUTDOWN_COMPLETED' });
    process.exit(0);
  } catch (error) {
    Logger.error('Error during server shutdown', {
      error: {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack
      }
    });
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start();
