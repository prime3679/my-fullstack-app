import Fastify from 'fastify';
import { menuRoutes } from './menu';
import { MenuService } from '../services/menuService';

// Mock the MenuService
jest.mock('../services/menuService');

describe('Menu Routes', () => {
  let fastify: any;
  let mockMenuService: jest.Mocked<MenuService>;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(menuRoutes, { prefix: '/api/v1/menu' });
    
    // Get the mocked instance
    mockMenuService = MenuService.prototype as jest.Mocked<MenuService>;
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /restaurant/:restaurantId', () => {
    it('should return full menu for a restaurant', async () => {
      const mockMenu = {
        categories: [
          {
            id: '1',
            name: 'Appetizers',
            items: [
              { id: '1', sku: 'APP001', name: 'Salad', price: 1000 }
            ]
          }
        ]
      };

      mockMenuService.getRestaurantMenu = jest.fn().mockResolvedValue(mockMenu);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/menu/restaurant/restaurant-123',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockMenu);
      expect(mockMenuService.getRestaurantMenu).toHaveBeenCalledWith('restaurant-123');
    });

    it('should handle errors when fetching menu', async () => {
      mockMenuService.getRestaurantMenu = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/menu/restaurant/restaurant-123',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to retrieve menu');
    });
  });

  describe('GET /restaurant/:restaurantId/item/:sku', () => {
    it('should return specific menu item', async () => {
      const mockItem = {
        id: '1',
        sku: 'ITEM001',
        name: 'Burger',
        price: 1500,
        description: 'Delicious burger'
      };

      mockMenuService.getMenuItem = jest.fn().mockResolvedValue(mockItem);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/menu/restaurant/restaurant-123/item/ITEM001',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data).toEqual(mockItem);
      expect(mockMenuService.getMenuItem).toHaveBeenCalledWith('restaurant-123', 'ITEM001');
    });

    it('should return 404 when item not found', async () => {
      mockMenuService.getMenuItem = jest.fn().mockResolvedValue(null);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/menu/restaurant/restaurant-123/item/NONEXISTENT',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Menu item not found');
    });
  });

  describe('GET /restaurant/:restaurantId/search', () => {
    it('should search menu items by query', async () => {
      const mockItems = [
        { id: '1', sku: 'ITEM001', name: 'Cheeseburger', price: 1500 },
        { id: '2', sku: 'ITEM002', name: 'Cheese Pizza', price: 1200 }
      ];

      mockMenuService.searchMenuItems = jest.fn().mockResolvedValue(mockItems);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/menu/restaurant/restaurant-123/search?q=cheese',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items).toEqual(mockItems);
      expect(body.data.count).toBe(2);
      expect(mockMenuService.searchMenuItems).toHaveBeenCalledWith('restaurant-123', 'cheese');
    });

    it('should filter by dietary restrictions', async () => {
      const mockItems = [
        { id: '1', sku: 'ITEM001', name: 'Veggie Burger', price: 1400 }
      ];

      mockMenuService.getMenuItemsByDietaryRestrictions = jest.fn().mockResolvedValue(mockItems);

      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/menu/restaurant/restaurant-123/search?dietary=vegetarian,vegan&allergens=nuts',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items).toEqual(mockItems);
      expect(mockMenuService.getMenuItemsByDietaryRestrictions).toHaveBeenCalledWith(
        'restaurant-123',
        ['vegetarian', 'vegan'],
        ['nuts']
      );
    });

    it('should return 400 when no search parameters provided', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/api/v1/menu/restaurant/restaurant-123/search',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Query parameter');
    });
  });

  describe('PATCH /restaurant/:restaurantId/item/:sku/86', () => {
    it('should toggle 86 status', async () => {
      const mockItem = {
        id: '1',
        sku: 'ITEM001',
        name: 'Burger',
        is86: true
      };

      mockMenuService.toggleItem86Status = jest.fn().mockResolvedValue(mockItem);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/menu/restaurant/restaurant-123/item/ITEM001/86',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is86: true,
          reason: 'Out of stock'
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Item marked as 86 (out of stock)');
      expect(mockMenuService.toggleItem86Status).toHaveBeenCalledWith(
        'restaurant-123',
        'ITEM001',
        true,
        'Out of stock'
      );
    });

    it('should restore item from 86 status', async () => {
      const mockItem = {
        id: '1',
        sku: 'ITEM001',
        name: 'Burger',
        is86: false
      };

      mockMenuService.toggleItem86Status = jest.fn().mockResolvedValue(mockItem);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/menu/restaurant/restaurant-123/item/ITEM001/86',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is86: false
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Item restored to menu');
    });
  });

  describe('PATCH /restaurant/:restaurantId/item/:sku/availability', () => {
    it('should update item availability', async () => {
      const mockItem = {
        id: '1',
        sku: 'ITEM001',
        name: 'Burger',
        isAvailable: false
      };

      mockMenuService.updateMenuItemAvailability = jest.fn().mockResolvedValue(mockItem);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/menu/restaurant/restaurant-123/item/ITEM001/availability',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isAvailable: false
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Item disabled');
      expect(mockMenuService.updateMenuItemAvailability).toHaveBeenCalledWith(
        'restaurant-123',
        'ITEM001',
        false
      );
    });

    it('should enable item', async () => {
      const mockItem = {
        id: '1',
        sku: 'ITEM001',
        name: 'Burger',
        isAvailable: true
      };

      mockMenuService.updateMenuItemAvailability = jest.fn().mockResolvedValue(mockItem);

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/menu/restaurant/restaurant-123/item/ITEM001/availability',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isAvailable: true
        }),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Item enabled');
    });

    it('should handle errors when updating availability', async () => {
      mockMenuService.updateMenuItemAvailability = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await fastify.inject({
        method: 'PATCH',
        url: '/api/v1/menu/restaurant/restaurant-123/item/ITEM001/availability',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isAvailable: true
        }),
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to update item availability');
    });
  });
});