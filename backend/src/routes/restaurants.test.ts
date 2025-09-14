import Fastify from 'fastify';
import { restaurantRoutes } from './restaurants';
import { db } from '../lib/db';
import { createTestRestaurant, createTestUser } from '../test/setup';

describe('Restaurant Routes', () => {
  let fastify: any;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(restaurantRoutes, { prefix: '/api/v1/restaurants' });
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /api/v1/restaurants', () => {
    it('should return list of restaurants', async () => {
      const restaurant1 = await createTestRestaurant({ name: 'Restaurant 1', slug: 'restaurant-1' });
      const restaurant2 = await createTestRestaurant({ name: 'Restaurant 2', slug: 'restaurant-2' });

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/restaurants',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.restaurants).toHaveLength(2);
      expect(body.restaurants[0].name).toBe('Restaurant 1');
      expect(body.restaurants[1].name).toBe('Restaurant 2');
    });

    it('should handle database errors gracefully', async () => {
      jest.spyOn(db.restaurant, 'findMany').mockRejectedValueOnce(new Error('Database error'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/restaurants',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to fetch restaurants');
    });
  });

  describe('GET /api/v1/restaurants/:id', () => {
    it('should return a single restaurant by ID', async () => {
      const restaurant = await createTestRestaurant({ name: 'Test Restaurant' });

      const response = await fastify.inject({
        method: 'GET',
        url: `/api/v1/restaurants/${restaurant.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.restaurant.name).toBe('Test Restaurant');
      expect(body.restaurant.id).toBe(restaurant.id);
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/restaurants/99999',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Restaurant not found');
    });
  });

  describe('POST /api/v1/restaurants', () => {
    it('should create a new restaurant', async () => {
      const user = await createTestUser({ email: 'manager@test.com' });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/restaurants',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'New Restaurant',
          slug: 'new-restaurant',
          description: 'A new test restaurant',
          primaryCuisine: 'Italian',
          managerId: user.id,
        }),
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.restaurant.name).toBe('New Restaurant');
      expect(body.restaurant.slug).toBe('new-restaurant');
    });

    it('should validate required fields', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/restaurants',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: 'Missing required fields',
        }),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it('should prevent duplicate slugs', async () => {
      await createTestRestaurant({ slug: 'existing-slug' });
      const user = await createTestUser({ email: 'manager2@test.com' });

      const response = await fastify.inject({
        method: 'POST',
        url: '/api/v1/restaurants',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Another Restaurant',
          slug: 'existing-slug',
          description: 'Test',
          primaryCuisine: 'French',
          managerId: user.id,
        }),
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('already exists');
    });
  });

  describe('PUT /api/v1/restaurants/:id', () => {
    it('should update an existing restaurant', async () => {
      const restaurant = await createTestRestaurant({
        name: 'Original Name',
        description: 'Original Description',
      });

      const response = await fastify.inject({
        method: 'PUT',
        url: `/api/v1/restaurants/${restaurant.id}`,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Name',
          description: 'Updated Description',
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.restaurant.name).toBe('Updated Name');
      expect(body.restaurant.description).toBe('Updated Description');
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await fastify.inject({
        method: 'PUT',
        url: '/api/v1/restaurants/99999',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Updated Name',
        }),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/v1/restaurants/:id', () => {
    it('should delete a restaurant', async () => {
      const restaurant = await createTestRestaurant();

      const response = await fastify.inject({
        method: 'DELETE',
        url: `/api/v1/restaurants/${restaurant.id}`,
      });

      expect(response.statusCode).toBe(204);

      const deleted = await db.restaurant.findUnique({
        where: { id: restaurant.id },
      });
      expect(deleted).toBeNull();
    });

    it('should return 404 for non-existent restaurant', async () => {
      const response = await fastify.inject({
        method: 'DELETE',
        url: '/api/v1/restaurants/99999',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});