import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { db } from './lib/db';
import { reservationRoutes } from './routes/reservations';
import { restaurantRoutes } from './routes/restaurants';
import { menuRoutes } from './routes/menu';
import { preOrderRoutes } from './routes/preorders';
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
      credentials: true
    });

    // Register routes
    await fastify.register(restaurantRoutes, { prefix: '/api/v1/restaurants' });
    await fastify.register(reservationRoutes, { prefix: '/api/v1/reservations' });
    await fastify.register(menuRoutes, { prefix: '/api/v1/menu' });
    await fastify.register(preOrderRoutes, { prefix: '/api/v1/preorders' });

    // Health check endpoint
    fastify.get('/api/health', async (request, reply) => {
      const dbHealth = await db.$queryRaw`SELECT 1 as connected`;
      return {
        status: 'OK',
        message: 'La Carta server is running',
        database: dbHealth ? 'connected' : 'disconnected',
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
      console.error(error);
      reply.code(500).send({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    });

    // Start server
    await fastify.listen({ port: Number(PORT), host: '0.0.0.0' });
    console.log(`🚀 La Carta server running on http://localhost:${PORT}`);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
const gracefulShutdown = async () => {
  try {
    console.log('🔄 Shutting down server...');
    await db.$disconnect();
    await fastify.close();
    console.log('✅ Server shut down successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

start();