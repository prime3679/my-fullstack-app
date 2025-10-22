import { FastifyInstance } from 'fastify';
import { menuAdminService } from '../services/menuAdminService';
import { Logger, toLogError } from '../lib/logger';

export async function menuAdminRoutes(fastify: FastifyInstance) {

  // ==================== MENU ITEMS ====================

  // Get all menu items for a restaurant
  fastify.get<{
    Params: { restaurantId: string };
    Querystring: { includeInactive?: string };
  }>('/items/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const includeInactive = request.query.includeInactive === 'true';

      const items = await menuAdminService.getAllMenuItems(restaurantId, includeInactive);

      return {
        success: true,
        data: items
      };
    } catch (error) {
      Logger.error('Failed to fetch menu items', { error: toLogError(error) });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch menu items',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get a single menu item
  fastify.get<{
    Params: { itemId: string };
  }>('/items/detail/:itemId', async (request, reply) => {
    try {
      const { itemId } = request.params;

      const item = await menuAdminService.getMenuItemById(itemId);

      return {
        success: true,
        data: item
      };
    } catch (error) {
      Logger.error('Failed to fetch menu item', { error: toLogError(error) });
      return reply.code(404).send({
        success: false,
        error: 'Menu item not found',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create a new menu item
  fastify.post<{
    Body: {
      restaurantId: string;
      categoryId: string;
      sku: string;
      name: string;
      description?: string;
      price: number;
      imageUrl?: string;
      prepTimeMinutes?: number;
      allergensJson?: any;
      dietaryTags?: string[];
      nutritionJson?: any;
      sortOrder?: number;
      modifierGroupIds?: string[];
    };
  }>('/items', async (request, reply) => {
    try {
      const item = await menuAdminService.createMenuItem(request.body);

      return {
        success: true,
        data: item,
        message: 'Menu item created successfully'
      };
    } catch (error) {
      Logger.error('Failed to create menu item', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to create menu item',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update a menu item
  fastify.patch<{
    Params: { itemId: string };
    Body: {
      categoryId?: string;
      name?: string;
      description?: string;
      price?: number;
      imageUrl?: string;
      prepTimeMinutes?: number;
      isAvailable?: boolean;
      is86?: boolean;
      allergensJson?: any;
      dietaryTags?: string[];
      nutritionJson?: any;
      sortOrder?: number;
    };
  }>('/items/:itemId', async (request, reply) => {
    try {
      const { itemId } = request.params;

      const item = await menuAdminService.updateMenuItem(itemId, request.body);

      return {
        success: true,
        data: item,
        message: 'Menu item updated successfully'
      };
    } catch (error) {
      Logger.error('Failed to update menu item', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to update menu item',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete a menu item
  fastify.delete<{
    Params: { itemId: string };
  }>('/items/:itemId', async (request, reply) => {
    try {
      const { itemId } = request.params;

      await menuAdminService.deleteMenuItem(itemId);

      return {
        success: true,
        message: 'Menu item deleted successfully'
      };
    } catch (error) {
      Logger.error('Failed to delete menu item', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to delete menu item',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Attach modifier groups to a menu item
  fastify.post<{
    Params: { itemId: string };
    Body: { modifierGroupIds: string[] };
  }>('/items/:itemId/modifiers', async (request, reply) => {
    try {
      const { itemId } = request.params;
      const { modifierGroupIds } = request.body;

      const item = await menuAdminService.attachModifierGroups(itemId, modifierGroupIds);

      return {
        success: true,
        data: item,
        message: 'Modifier groups attached successfully'
      };
    } catch (error) {
      Logger.error('Failed to attach modifier groups', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to attach modifier groups',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ==================== CATEGORIES ====================

  // Get all categories
  fastify.get<{
    Params: { restaurantId: string };
    Querystring: { includeInactive?: string };
  }>('/categories/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const includeInactive = request.query.includeInactive === 'true';

      const categories = await menuAdminService.getAllCategories(restaurantId, includeInactive);

      return {
        success: true,
        data: categories
      };
    } catch (error) {
      Logger.error('Failed to fetch categories', { error: toLogError(error) });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create a category
  fastify.post<{
    Body: {
      restaurantId: string;
      name: string;
      description?: string;
      sortOrder?: number;
    };
  }>('/categories', async (request, reply) => {
    try {
      const category = await menuAdminService.createCategory(request.body);

      return {
        success: true,
        data: category,
        message: 'Category created successfully'
      };
    } catch (error) {
      Logger.error('Failed to create category', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to create category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update a category
  fastify.patch<{
    Params: { categoryId: string };
    Body: {
      name?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
    };
  }>('/categories/:categoryId', async (request, reply) => {
    try {
      const { categoryId } = request.params;

      const category = await menuAdminService.updateCategory(categoryId, request.body);

      return {
        success: true,
        data: category,
        message: 'Category updated successfully'
      };
    } catch (error) {
      Logger.error('Failed to update category', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to update category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete a category
  fastify.delete<{
    Params: { categoryId: string };
  }>('/categories/:categoryId', async (request, reply) => {
    try {
      const { categoryId } = request.params;

      await menuAdminService.deleteCategory(categoryId);

      return {
        success: true,
        message: 'Category deleted successfully'
      };
    } catch (error) {
      Logger.error('Failed to delete category', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to delete category',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Reorder categories
  fastify.post<{
    Params: { restaurantId: string };
    Body: { categoryIds: string[] };
  }>('/categories/:restaurantId/reorder', async (request, reply) => {
    try {
      const { restaurantId } = request.params;
      const { categoryIds } = request.body;

      const categories = await menuAdminService.reorderCategories(restaurantId, categoryIds);

      return {
        success: true,
        data: categories,
        message: 'Categories reordered successfully'
      };
    } catch (error) {
      Logger.error('Failed to reorder categories', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to reorder categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ==================== MODIFIER GROUPS ====================

  // Get all modifier groups
  fastify.get<{
    Params: { restaurantId: string };
  }>('/modifier-groups/:restaurantId', async (request, reply) => {
    try {
      const { restaurantId } = request.params;

      const groups = await menuAdminService.getAllModifierGroups(restaurantId);

      return {
        success: true,
        data: groups
      };
    } catch (error) {
      Logger.error('Failed to fetch modifier groups', { error: toLogError(error) });
      return reply.code(500).send({
        success: false,
        error: 'Failed to fetch modifier groups',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get a single modifier group
  fastify.get<{
    Params: { groupId: string };
  }>('/modifier-groups/detail/:groupId', async (request, reply) => {
    try {
      const { groupId } = request.params;

      const group = await menuAdminService.getModifierGroupById(groupId);

      return {
        success: true,
        data: group
      };
    } catch (error) {
      Logger.error('Failed to fetch modifier group', { error: toLogError(error) });
      return reply.code(404).send({
        success: false,
        error: 'Modifier group not found',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Create a modifier group
  fastify.post<{
    Body: {
      restaurantId: string;
      name: string;
      description?: string;
      minSelections?: number;
      maxSelections?: number;
      isRequired?: boolean;
      sortOrder?: number;
    };
  }>('/modifier-groups', async (request, reply) => {
    try {
      const group = await menuAdminService.createModifierGroup(request.body);

      return {
        success: true,
        data: group,
        message: 'Modifier group created successfully'
      };
    } catch (error) {
      Logger.error('Failed to create modifier group', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to create modifier group',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update a modifier group
  fastify.patch<{
    Params: { groupId: string };
    Body: {
      name?: string;
      description?: string;
      minSelections?: number;
      maxSelections?: number;
      isRequired?: boolean;
      sortOrder?: number;
    };
  }>('/modifier-groups/:groupId', async (request, reply) => {
    try {
      const { groupId } = request.params;

      const group = await menuAdminService.updateModifierGroup(groupId, request.body);

      return {
        success: true,
        data: group,
        message: 'Modifier group updated successfully'
      };
    } catch (error) {
      Logger.error('Failed to update modifier group', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to update modifier group',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete a modifier group
  fastify.delete<{
    Params: { groupId: string };
  }>('/modifier-groups/:groupId', async (request, reply) => {
    try {
      const { groupId } = request.params;

      await menuAdminService.deleteModifierGroup(groupId);

      return {
        success: true,
        message: 'Modifier group deleted successfully'
      };
    } catch (error) {
      Logger.error('Failed to delete modifier group', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to delete modifier group',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ==================== MODIFIERS ====================

  // Create a modifier
  fastify.post<{
    Body: {
      modifierGroupId: string;
      name: string;
      description?: string;
      price?: number;
      sortOrder?: number;
    };
  }>('/modifiers', async (request, reply) => {
    try {
      const modifier = await menuAdminService.createModifier(request.body);

      return {
        success: true,
        data: modifier,
        message: 'Modifier created successfully'
      };
    } catch (error) {
      Logger.error('Failed to create modifier', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to create modifier',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update a modifier
  fastify.patch<{
    Params: { modifierId: string };
    Body: {
      name?: string;
      description?: string;
      price?: number;
      isAvailable?: boolean;
      sortOrder?: number;
    };
  }>('/modifiers/:modifierId', async (request, reply) => {
    try {
      const { modifierId } = request.params;

      const modifier = await menuAdminService.updateModifier(modifierId, request.body);

      return {
        success: true,
        data: modifier,
        message: 'Modifier updated successfully'
      };
    } catch (error) {
      Logger.error('Failed to update modifier', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to update modifier',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete a modifier
  fastify.delete<{
    Params: { modifierId: string };
  }>('/modifiers/:modifierId', async (request, reply) => {
    try {
      const { modifierId } = request.params;

      await menuAdminService.deleteModifier(modifierId);

      return {
        success: true,
        message: 'Modifier deleted successfully'
      };
    } catch (error) {
      Logger.error('Failed to delete modifier', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to delete modifier',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Reorder modifiers
  fastify.post<{
    Params: { groupId: string };
    Body: { modifierIds: string[] };
  }>('/modifier-groups/:groupId/reorder', async (request, reply) => {
    try {
      const { groupId } = request.params;
      const { modifierIds } = request.body;

      const group = await menuAdminService.reorderModifiers(groupId, modifierIds);

      return {
        success: true,
        data: group,
        message: 'Modifiers reordered successfully'
      };
    } catch (error) {
      Logger.error('Failed to reorder modifiers', { error: toLogError(error) });
      return reply.code(400).send({
        success: false,
        error: 'Failed to reorder modifiers',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
