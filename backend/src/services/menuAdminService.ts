import { db } from '../lib/db';
import { Logger } from '../lib/logger';

// ==================== INTERFACES ====================

export interface CreateMenuItemInput {
  restaurantId: string;
  categoryId: string;
  sku: string;
  name: string;
  description?: string;
  price: number; // in cents
  imageUrl?: string;
  prepTimeMinutes?: number;
  allergensJson?: any;
  dietaryTags?: string[];
  nutritionJson?: any;
  sortOrder?: number;
  modifierGroupIds?: string[]; // Existing modifier groups to attach
}

export interface UpdateMenuItemInput {
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
}

export interface CreateCategoryInput {
  restaurantId: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CreateModifierGroupInput {
  restaurantId: string;
  name: string;
  description?: string;
  minSelections?: number;
  maxSelections?: number;
  isRequired?: boolean;
  sortOrder?: number;
}

export interface UpdateModifierGroupInput {
  name?: string;
  description?: string;
  minSelections?: number;
  maxSelections?: number;
  isRequired?: boolean;
  sortOrder?: number;
}

export interface CreateModifierInput {
  modifierGroupId: string;
  name: string;
  description?: string;
  price?: number; // additional price in cents
  sortOrder?: number;
}

export interface UpdateModifierInput {
  name?: string;
  description?: string;
  price?: number;
  isAvailable?: boolean;
  sortOrder?: number;
}

// ==================== SERVICE ====================

export class MenuAdminService {

  // ==================== MENU ITEMS ====================

  /**
   * Get all menu items for a restaurant (admin view - includes inactive)
   */
  async getAllMenuItems(restaurantId: string, includeInactive: boolean = false) {
    try {
      const whereClause: any = { restaurantId };

      if (!includeInactive) {
        whereClause.isAvailable = true;
      }

      const items = await db.menuItem.findMany({
        where: whereClause,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              sortOrder: true
            }
          },
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  modifiers: {
                    orderBy: { sortOrder: 'asc' }
                  }
                }
              }
            },
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: [
          { category: { sortOrder: 'asc' } },
          { sortOrder: 'asc' }
        ]
      });

      return items;
    } catch (error) {
      Logger.error('Error fetching menu items', { restaurantId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Get a single menu item by ID
   */
  async getMenuItemById(itemId: string) {
    try {
      const item = await db.menuItem.findUnique({
        where: { id: itemId },
        include: {
          category: true,
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  modifiers: {
                    orderBy: { sortOrder: 'asc' }
                  }
                }
              }
            },
            orderBy: { sortOrder: 'asc' }
          }
        }
      });

      if (!item) {
        throw new Error('Menu item not found');
      }

      return item;
    } catch (error) {
      Logger.error('Error fetching menu item', { itemId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Create a new menu item
   */
  async createMenuItem(input: CreateMenuItemInput) {
    try {
      const { modifierGroupIds, ...itemData } = input;

      // Check if SKU already exists for this restaurant
      const existing = await db.menuItem.findFirst({
        where: {
          restaurantId: input.restaurantId,
          sku: input.sku
        }
      });

      if (existing) {
        throw new Error('Menu item with this SKU already exists');
      }

      // Create menu item
      const menuItem = await db.menuItem.create({
        data: {
          ...itemData,
          sortOrder: itemData.sortOrder ?? 0,
          dietaryTags: itemData.dietaryTags ?? []
        },
        include: {
          category: true
        }
      });

      // Attach modifier groups if provided
      if (modifierGroupIds && modifierGroupIds.length > 0) {
        await Promise.all(
          modifierGroupIds.map((groupId, index) =>
            db.menuItemModifierGroup.create({
              data: {
                menuItemId: menuItem.id,
                modifierGroupId: groupId,
                sortOrder: index
              }
            })
          )
        );
      }

      Logger.info('Menu item created', { menuItemId: menuItem.id, sku: menuItem.sku });

      return this.getMenuItemById(menuItem.id);
    } catch (error) {
      Logger.error('Error creating menu item', { input, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Update an existing menu item
   */
  async updateMenuItem(itemId: string, input: UpdateMenuItemInput) {
    try {
      const item = await db.menuItem.update({
        where: { id: itemId },
        data: input,
        include: {
          category: true,
          modifierGroups: {
            include: {
              modifierGroup: {
                include: {
                  modifiers: {
                    orderBy: { sortOrder: 'asc' }
                  }
                }
              }
            }
          }
        }
      });

      Logger.info('Menu item updated', { itemId, changes: Object.keys(input) });

      return item;
    } catch (error) {
      Logger.error('Error updating menu item', { itemId, input, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Delete a menu item
   */
  async deleteMenuItem(itemId: string) {
    try {
      await db.menuItem.delete({
        where: { id: itemId }
      });

      Logger.info('Menu item deleted', { itemId });

      return { success: true };
    } catch (error) {
      Logger.error('Error deleting menu item', { itemId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Attach modifier groups to a menu item
   */
  async attachModifierGroups(itemId: string, modifierGroupIds: string[]) {
    try {
      // Remove existing associations
      await db.menuItemModifierGroup.deleteMany({
        where: { menuItemId: itemId }
      });

      // Create new associations
      await Promise.all(
        modifierGroupIds.map((groupId, index) =>
          db.menuItemModifierGroup.create({
            data: {
              menuItemId: itemId,
              modifierGroupId: groupId,
              sortOrder: index
            }
          })
        )
      );

      Logger.info('Modifier groups attached to menu item', { itemId, count: modifierGroupIds.length });

      return this.getMenuItemById(itemId);
    } catch (error) {
      Logger.error('Error attaching modifier groups', { itemId, modifierGroupIds, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  // ==================== CATEGORIES ====================

  /**
   * Get all categories for a restaurant
   */
  async getAllCategories(restaurantId: string, includeInactive: boolean = false) {
    try {
      const whereClause: any = { restaurantId };

      if (!includeInactive) {
        whereClause.isActive = true;
      }

      const categories = await db.menuCategory.findMany({
        where: whereClause,
        include: {
          _count: {
            select: { menuItems: true }
          }
        },
        orderBy: { sortOrder: 'asc' }
      });

      return categories;
    } catch (error) {
      Logger.error('Error fetching categories', { restaurantId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Create a new category
   */
  async createCategory(input: CreateCategoryInput) {
    try {
      const category = await db.menuCategory.create({
        data: {
          ...input,
          sortOrder: input.sortOrder ?? 0
        }
      });

      Logger.info('Category created', { categoryId: category.id, name: category.name });

      return category;
    } catch (error) {
      Logger.error('Error creating category', { input, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Update a category
   */
  async updateCategory(categoryId: string, input: UpdateCategoryInput) {
    try {
      const category = await db.menuCategory.update({
        where: { id: categoryId },
        data: input
      });

      Logger.info('Category updated', { categoryId, changes: Object.keys(input) });

      return category;
    } catch (error) {
      Logger.error('Error updating category', { categoryId, input, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Delete a category (must be empty)
   */
  async deleteCategory(categoryId: string) {
    try {
      // Check if category has any items
      const itemCount = await db.menuItem.count({
        where: { categoryId }
      });

      if (itemCount > 0) {
        throw new Error('Cannot delete category with menu items. Please move or delete items first.');
      }

      await db.menuCategory.delete({
        where: { id: categoryId }
      });

      Logger.info('Category deleted', { categoryId });

      return { success: true };
    } catch (error) {
      Logger.error('Error deleting category', { categoryId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Reorder categories
   */
  async reorderCategories(restaurantId: string, categoryIds: string[]) {
    try {
      await Promise.all(
        categoryIds.map((categoryId, index) =>
          db.menuCategory.update({
            where: { id: categoryId },
            data: { sortOrder: index }
          })
        )
      );

      Logger.info('Categories reordered', { restaurantId, count: categoryIds.length });

      return this.getAllCategories(restaurantId);
    } catch (error) {
      Logger.error('Error reordering categories', { restaurantId, categoryIds, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  // ==================== MODIFIER GROUPS ====================

  /**
   * Get all modifier groups for a restaurant
   */
  async getAllModifierGroups(restaurantId: string) {
    try {
      const groups = await db.modifierGroup.findMany({
        where: { restaurantId },
        include: {
          modifiers: {
            orderBy: { sortOrder: 'asc' }
          },
          _count: {
            select: { menuItems: true }
          }
        },
        orderBy: { sortOrder: 'asc' }
      });

      return groups;
    } catch (error) {
      Logger.error('Error fetching modifier groups', { restaurantId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Get a single modifier group by ID
   */
  async getModifierGroupById(groupId: string) {
    try {
      const group = await db.modifierGroup.findUnique({
        where: { id: groupId },
        include: {
          modifiers: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      });

      if (!group) {
        throw new Error('Modifier group not found');
      }

      return group;
    } catch (error) {
      Logger.error('Error fetching modifier group', { groupId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Create a new modifier group
   */
  async createModifierGroup(input: CreateModifierGroupInput) {
    try {
      const group = await db.modifierGroup.create({
        data: {
          ...input,
          minSelections: input.minSelections ?? 0,
          maxSelections: input.maxSelections ?? 1,
          sortOrder: input.sortOrder ?? 0
        },
        include: {
          modifiers: true
        }
      });

      Logger.info('Modifier group created', { groupId: group.id, name: group.name });

      return group;
    } catch (error) {
      Logger.error('Error creating modifier group', { input, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Update a modifier group
   */
  async updateModifierGroup(groupId: string, input: UpdateModifierGroupInput) {
    try {
      const group = await db.modifierGroup.update({
        where: { id: groupId },
        data: input,
        include: {
          modifiers: {
            orderBy: { sortOrder: 'asc' }
          }
        }
      });

      Logger.info('Modifier group updated', { groupId, changes: Object.keys(input) });

      return group;
    } catch (error) {
      Logger.error('Error updating modifier group', { groupId, input, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Delete a modifier group
   */
  async deleteModifierGroup(groupId: string) {
    try {
      await db.modifierGroup.delete({
        where: { id: groupId }
      });

      Logger.info('Modifier group deleted', { groupId });

      return { success: true };
    } catch (error) {
      Logger.error('Error deleting modifier group', { groupId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  // ==================== MODIFIERS ====================

  /**
   * Create a new modifier
   */
  async createModifier(input: CreateModifierInput) {
    try {
      const modifier = await db.modifier.create({
        data: {
          ...input,
          price: input.price ?? 0,
          sortOrder: input.sortOrder ?? 0
        }
      });

      Logger.info('Modifier created', { modifierId: modifier.id, name: modifier.name });

      return modifier;
    } catch (error) {
      Logger.error('Error creating modifier', { input, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Update a modifier
   */
  async updateModifier(modifierId: string, input: UpdateModifierInput) {
    try {
      const modifier = await db.modifier.update({
        where: { id: modifierId },
        data: input
      });

      Logger.info('Modifier updated', { modifierId, changes: Object.keys(input) });

      return modifier;
    } catch (error) {
      Logger.error('Error updating modifier', { modifierId, input, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Delete a modifier
   */
  async deleteModifier(modifierId: string) {
    try {
      await db.modifier.delete({
        where: { id: modifierId }
      });

      Logger.info('Modifier deleted', { modifierId });

      return { success: true };
    } catch (error) {
      Logger.error('Error deleting modifier', { modifierId, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }

  /**
   * Reorder modifiers within a group
   */
  async reorderModifiers(groupId: string, modifierIds: string[]) {
    try {
      await Promise.all(
        modifierIds.map((modifierId, index) =>
          db.modifier.update({
            where: { id: modifierId },
            data: { sortOrder: index }
          })
        )
      );

      Logger.info('Modifiers reordered', { groupId, count: modifierIds.length });

      return this.getModifierGroupById(groupId);
    } catch (error) {
      Logger.error('Error reordering modifiers', { groupId, modifierIds, error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : undefined });
      throw error;
    }
  }
}

export const menuAdminService = new MenuAdminService();
