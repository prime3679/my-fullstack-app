import { FastifyInstance } from 'fastify';
import { MenuService } from '../services/menuService';

const menuService = new MenuService();

interface MenuParams {
  restaurantId: string;
  sku?: string;
}

interface MenuQuery {
  q?: string; // search query
  dietary?: string; // comma-separated dietary tags
  allergens?: string; // comma-separated allergens to exclude
}

export async function menuRoutes(fastify: FastifyInstance) {

  // Get full menu for a restaurant
  fastify.get<{
    Params: Pick<MenuParams, 'restaurantId'>;
  }>('/restaurant/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;

      const menu = await menuService.getRestaurantMenu(restaurantId);

      return {
        success: true,
        data: menu
      };
    } catch (error) {
      console.error('Failed to get restaurant menu:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve menu'
      });
    }
  });

  // Get specific menu item
  fastify.get<{
    Params: MenuParams;
  }>('/restaurant/:restaurantId/item/:sku', async (request, reply) => {
    try {
      const { restaurantId, sku } = request.params;

      const item = await menuService.getMenuItem(restaurantId, sku!);

      if (!item) {
        return reply.code(404).send({
          error: 'Menu item not found'
        });
      }

      return {
        success: true,
        data: item
      };
    } catch (error) {
      console.error('Failed to get menu item:', error);
      return reply.code(500).send({
        error: 'Failed to retrieve menu item'
      });
    }
  });

  // Search menu items
  fastify.get<{
    Params: Pick<MenuParams, 'restaurantId'>;
    Querystring: MenuQuery;
  }>('/restaurant/:restaurantId/search', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { q, dietary, allergens } = request.query;

      let items;

      if (dietary || allergens) {
        // Filter by dietary restrictions
        const dietaryTags = dietary ? dietary.split(',').map(t => t.trim()) : [];
        const excludeAllergens = allergens ? allergens.split(',').map(a => a.trim()) : [];
        
        items = await menuService.getMenuItemsByDietaryRestrictions(
          restaurantId,
          dietaryTags,
          excludeAllergens
        );
      } else if (q) {
        // Text search
        items = await menuService.searchMenuItems(restaurantId, q);
      } else {
        return reply.code(400).send({
          error: 'Query parameter "q", "dietary", or "allergens" is required'
        });
      }

      return {
        success: true,
        data: {
          query: { q, dietary, allergens },
          items,
          count: items.length
        }
      };
    } catch (error) {
      console.error('Menu search failed:', error);
      return reply.code(500).send({
        error: 'Menu search failed'
      });
    }
  });

  // Toggle 86 status (for restaurant staff)
  fastify.patch<{
    Params: MenuParams;
    Body: {
      is86: boolean;
      reason?: string;
    };
  }>('/restaurant/:restaurantId/item/:sku/86', async (request, reply) => {
    try {
      const { restaurantId, sku } = request.params;
      const { is86, reason } = request.body;

      const item = await menuService.toggleItem86Status(restaurantId, sku!, is86, reason);

      return {
        success: true,
        data: item,
        message: is86 ? 'Item marked as 86 (out of stock)' : 'Item restored to menu'
      };
    } catch (error) {
      console.error('Failed to update 86 status:', error);
      return reply.code(500).send({
        error: 'Failed to update item status'
      });
    }
  });

  // Update item availability (for restaurant staff)
  fastify.patch<{
    Params: MenuParams;
    Body: {
      isAvailable: boolean;
    };
  }>('/restaurant/:restaurantId/item/:sku/availability', async (request, reply) => {
    try {
      const { restaurantId, sku } = request.params;
      const { isAvailable } = request.body;

      const item = await menuService.updateMenuItemAvailability(restaurantId, sku!, isAvailable);

      return {
        success: true,
        data: item,
        message: isAvailable ? 'Item enabled' : 'Item disabled'
      };
    } catch (error) {
      console.error('Failed to update availability:', error);
      return reply.code(500).send({
        error: 'Failed to update item availability'
      });
    }
  });
}