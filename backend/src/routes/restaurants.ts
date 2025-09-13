import { FastifyInstance } from 'fastify';
import { db } from '../lib/db';

interface RestaurantParams {
  slug: string;
}

export async function restaurantRoutes(fastify: FastifyInstance) {

  // Get all restaurants (for discovery)
  fastify.get('/', async (request, reply) => {
    try {
      const restaurants = await db.restaurant.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          currency: true,
          settingsJson: true,
          locations: {
            select: {
              id: true,
              address: true,
              phone: true,
              _count: {
                select: {
                  tables: true
                }
              }
            }
          }
        },
        orderBy: {
          name: 'asc'
        }
      });

      return {
        success: true,
        data: {
          restaurants,
          count: restaurants.length
        }
      };
    } catch (error) {
      console.error('Failed to fetch restaurants:', error);
      return reply.code(500).send({
        error: 'Failed to fetch restaurants'
      });
    }
  });

  // Get restaurant by slug
  fastify.get<{
    Params: RestaurantParams;
  }>('/:slug', async (request, reply) => {
    try {
      const { slug } = request.params;

      const restaurant = await db.restaurant.findUnique({
        where: { slug },
        include: {
          locations: {
            include: {
              tables: {
                select: {
                  id: true,
                  label: true,
                  seats: true,
                  featuresJson: true
                }
              }
            }
          },
          _count: {
            select: {
              reservations: true
            }
          }
        }
      });

      if (!restaurant) {
        return reply.code(404).send({
          error: 'Restaurant not found'
        });
      }

      // Calculate total capacity
      const totalCapacity = restaurant.locations.reduce((total, location) => {
        return total + location.tables.reduce((locationTotal, table) => {
          return locationTotal + table.seats;
        }, 0);
      }, 0);

      const response = {
        ...restaurant,
        capacity: {
          totalSeats: totalCapacity,
          tableCount: restaurant.locations.reduce((total, loc) => total + loc.tables.length, 0)
        }
      };

      return {
        success: true,
        data: response
      };
    } catch (error) {
      console.error('Failed to get restaurant:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve restaurant'
      });
    }
  });

  // Search restaurants (for future implementation)
  fastify.get<{
    Querystring: {
      q?: string;
      location?: string;
    };
  }>('/search', async (request, reply) => {
    try {
      const { q, location } = request.query;
      
      let whereClause: any = {};

      if (q) {
        whereClause.name = {
          contains: q,
          mode: 'insensitive'
        };
      }

      if (location) {
        whereClause.locations = {
          some: {
            address: {
              contains: location,
              mode: 'insensitive'
            }
          }
        };
      }

      const restaurants = await db.restaurant.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          slug: true,
          locations: {
            select: {
              address: true,
              phone: true
            }
          }
        },
        take: 20
      });

      return {
        success: true,
        data: {
          query: { q, location },
          restaurants,
          count: restaurants.length
        }
      };
    } catch (error) {
      console.error('Restaurant search failed:', error);
      return reply.code(500).send({
        error: 'Search failed'
      });
    }
  });
}