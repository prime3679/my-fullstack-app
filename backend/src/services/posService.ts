/**
 * POS Integration Service
 * Generic service for managing POS integrations (Toast, Square)
 * Handles menu sync, order injection, and POS configuration
 */

import { db } from '../lib/db';
import { Logger } from '../lib/logger';
import { formatError } from '../utils/errorFormat';
import { createToastClient, ToastClient, ToastConfig } from '../integrations/toast';
import { createSquareClient, SquareClient, SquareConfig } from '../integrations/square';
import {
  POSProvider,
  POSConfiguration,
  POSMenuItem,
  POSOrder,
  POSOrderResponse,
  POSMenuSyncResult,
} from '../types/pos';

/**
 * POS Service
 * Manages POS integrations for restaurants
 */
export class POSService {
  /**
   * Get POS configuration for a restaurant
   */
  async getPOSConfig(restaurantId: string): Promise<POSConfiguration | null> {
    try {
      const restaurant = await db.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          id: true,
          posType: true,
          settingsJson: true,
        },
      });

      if (!restaurant || !restaurant.posType) {
        return null;
      }

      const settings = (restaurant.settingsJson as any) || {};
      const posConfig = settings.posConfig || {};

      return {
        provider: restaurant.posType as POSProvider,
        restaurantId: restaurant.id,
        // Toast config
        toastLocationGuid: posConfig.toastLocationGuid,
        toastClientId: posConfig.toastClientId,
        toastClientSecret: posConfig.toastClientSecret,
        toastAccessToken: posConfig.toastAccessToken,
        toastRefreshToken: posConfig.toastRefreshToken,
        toastTokenExpiresAt: posConfig.toastTokenExpiresAt
          ? new Date(posConfig.toastTokenExpiresAt)
          : undefined,
        // Square config
        squareLocationId: posConfig.squareLocationId,
        squareAccessToken: posConfig.squareAccessToken,
        squareRefreshToken: posConfig.squareRefreshToken,
        squareTokenExpiresAt: posConfig.squareTokenExpiresAt
          ? new Date(posConfig.squareTokenExpiresAt)
          : undefined,
        // Common settings
        autoSyncMenu: posConfig.autoSyncMenu ?? true,
        syncFrequencyMinutes: posConfig.syncFrequencyMinutes ?? 60,
        lastMenuSyncAt: posConfig.lastMenuSyncAt
          ? new Date(posConfig.lastMenuSyncAt)
          : undefined,
        lastOrderSyncAt: posConfig.lastOrderSyncAt
          ? new Date(posConfig.lastOrderSyncAt)
          : undefined,
      };
    } catch (error) {
      Logger.error('Failed to get POS configuration', {
        restaurantId,
        error: formatError(error),
      });
      return null;
    }
  }

  /**
   * Update POS configuration for a restaurant
   */
  async updatePOSConfig(
    restaurantId: string,
    config: Partial<POSConfiguration>
  ): Promise<void> {
    try {
      const restaurant = await db.restaurant.findUnique({
        where: { id: restaurantId },
        select: { settingsJson: true },
      });

      const settings = (restaurant?.settingsJson as any) || {};
      const posConfig = settings.posConfig || {};

      // Merge new config with existing
      const updatedPosConfig = {
        ...posConfig,
        ...config,
        toastTokenExpiresAt: config.toastTokenExpiresAt?.toISOString(),
        squareTokenExpiresAt: config.squareTokenExpiresAt?.toISOString(),
        lastMenuSyncAt: config.lastMenuSyncAt?.toISOString(),
        lastOrderSyncAt: config.lastOrderSyncAt?.toISOString(),
      };

      await db.restaurant.update({
        where: { id: restaurantId },
        data: {
          posType: config.provider || undefined,
          settingsJson: {
            ...settings,
            posConfig: updatedPosConfig,
          },
        },
      });

      Logger.info('Updated POS configuration', {
        restaurantId,
        provider: config.provider,
      });
    } catch (error) {
      Logger.error('Failed to update POS configuration', {
        restaurantId,
        error: formatError(error),
      });
      throw error;
    }
  }

  /**
   * Create POS client for a restaurant
   */
  private async createPOSClient(
    restaurantId: string
  ): Promise<ToastClient | SquareClient | null> {
    const config = await this.getPOSConfig(restaurantId);

    if (!config) {
      Logger.warn('No POS configuration found', { restaurantId });
      return null;
    }

    try {
      if (config.provider === 'toast') {
        if (!config.toastLocationGuid || !config.toastClientId || !config.toastClientSecret) {
          throw new Error('Missing Toast configuration');
        }

        const toastConfig: ToastConfig = {
          locationGuid: config.toastLocationGuid,
          clientId: config.toastClientId,
          clientSecret: config.toastClientSecret,
          accessToken: config.toastAccessToken,
          refreshToken: config.toastRefreshToken,
          tokenExpiresAt: config.toastTokenExpiresAt,
        };

        return createToastClient(toastConfig, async (tokens) => {
          await this.updatePOSConfig(restaurantId, {
            provider: 'toast',
            toastAccessToken: tokens.accessToken,
            toastRefreshToken: tokens.refreshToken,
            toastTokenExpiresAt: tokens.tokenExpiresAt,
          });
        });
      } else if (config.provider === 'square') {
        if (!config.squareLocationId || !config.squareAccessToken) {
          throw new Error('Missing Square configuration');
        }

        const squareConfig: SquareConfig = {
          locationId: config.squareLocationId,
          accessToken: config.squareAccessToken,
          refreshToken: config.squareRefreshToken,
          tokenExpiresAt: config.squareTokenExpiresAt,
        };

        return createSquareClient(squareConfig);
      }

      return null;
    } catch (error) {
      Logger.error('Failed to create POS client', {
        restaurantId,
        provider: config.provider,
        error: formatError(error),
      });
      throw error;
    }
  }

  /**
   * Sync menu from POS to La Carta database
   */
  async syncMenu(restaurantId: string): Promise<POSMenuSyncResult> {
    const startTime = Date.now();
    let itemsCreated = 0;
    let itemsUpdated = 0;
    let itemsDeleted = 0;
    let categoriesCreated = 0;
    let categoriesUpdated = 0;
    const errors: string[] = [];

    try {
      Logger.info('Starting menu sync', { restaurantId });

      const config = await this.getPOSConfig(restaurantId);
      if (!config || !config.provider) {
        throw new Error('No POS provider configured for restaurant');
      }

      const client = await this.createPOSClient(restaurantId);
      if (!client) {
        throw new Error('Failed to create POS client');
      }

      // Fetch menu items from POS
      const posMenuItems = await client.getMenuItems();

      Logger.info('Fetched menu items from POS', {
        restaurantId,
        provider: config.provider,
        itemCount: posMenuItems.length,
      });

      // Use transaction for atomic menu sync
      await db.$transaction(async (tx: any) => {
        // Group items by category
        const categoriesMap = new Map<string, POSMenuItem[]>();

        for (const item of posMenuItems) {
          const categoryName = item.categoryName || 'Uncategorized';
          if (!categoriesMap.has(categoryName)) {
            categoriesMap.set(categoryName, []);
          }
          categoriesMap.get(categoryName)!.push(item);
        }

        // Sync categories
        for (const [categoryName, items] of categoriesMap) {
          try {
            const existingCategory = await tx.menuCategory.findFirst({
              where: {
                restaurantId,
                name: categoryName,
              },
            });

            if (existingCategory) {
              categoriesUpdated++;
            } else {
              await tx.menuCategory.create({
                data: {
                  restaurantId,
                  name: categoryName,
                  description: `${categoryName} items`,
                  sortOrder: categoriesMap.size - Array.from(categoriesMap.keys()).indexOf(categoryName),
                  isActive: true,
                },
              });
              categoriesCreated++;
            }
          } catch (error) {
            errors.push(`Failed to sync category ${categoryName}: ${error}`);
          }
        }

        // Sync menu items
        for (const posItem of posMenuItems) {
          try {
            const categoryName = posItem.categoryName || 'Uncategorized';
            const category = await tx.menuCategory.findFirst({
              where: {
                restaurantId,
                name: categoryName,
              },
            });

            if (!category) {
              errors.push(`Category not found for item ${posItem.name}`);
              continue;
            }

            // Check if item exists by SKU or POS ID
            const existingItem = await tx.menuItem.findFirst({
              where: {
                restaurantId,
                OR: [
                  { sku: posItem.sku || posItem.posId },
                  { sku: posItem.posId }, // POS ID as fallback
                ],
              },
            });

            const itemData = {
              categoryId: category.id,
              sku: posItem.sku || posItem.posId,
              name: posItem.name,
              description: posItem.description || '',
              price: posItem.price,
              imageUrl: posItem.imageUrl || null,
              isAvailable: posItem.isAvailable,
              is86: false,
              allergensJson: posItem.metadata?.allergens || [],
              dietaryTags: posItem.metadata?.dietaryTags || [],
              nutritionJson: posItem.metadata?.nutrition || {},
              sortOrder: 0,
            };

            if (existingItem) {
              await tx.menuItem.update({
                where: { id: existingItem.id },
                data: itemData,
              });
              itemsUpdated++;
            } else {
              await tx.menuItem.create({
                data: {
                  ...itemData,
                  restaurantId,
                },
              });
              itemsCreated++;
            }
          } catch (error) {
            errors.push(
              `Failed to sync item ${posItem.name}: ${
                error instanceof Error ? error.message : String(error)
              }`
            );
          }
        }
      });

      // Update last sync time
      await this.updatePOSConfig(restaurantId, {
        lastMenuSyncAt: new Date(),
      });

      const result: POSMenuSyncResult = {
        success: true,
        provider: config.provider,
        itemsCreated,
        itemsUpdated,
        itemsDeleted,
        categoriesCreated,
        categoriesUpdated,
        errors,
        syncedAt: new Date(),
      };

      const duration = Date.now() - startTime;
      Logger.info('Menu sync completed', {
        restaurantId,
        duration,
        ...result,
      });

      return result;
    } catch (error) {
      Logger.error('Menu sync failed', {
        restaurantId,
        error: formatError(error),
        duration: Date.now() - startTime,
      });

      return {
        success: false,
        provider: (await this.getPOSConfig(restaurantId))?.provider || null,
        itemsCreated,
        itemsUpdated,
        itemsDeleted,
        categoriesCreated,
        categoriesUpdated,
        errors: [...errors, error instanceof Error ? error.message : String(error)],
        syncedAt: new Date(),
      };
    }
  }

  /**
   * Inject order to POS system
   */
  async injectOrder(preOrderId: string): Promise<POSOrderResponse> {
    try {
      Logger.info('Injecting order to POS', { preOrderId });

      // Fetch pre-order with all details
      const preOrder = await db.preOrder.findUnique({
        where: { id: preOrderId },
        include: {
          items: true,
          reservation: {
            include: {
              restaurant: true,
              user: true,
            },
          },
        },
      });

      if (!preOrder) {
        throw new Error('Pre-order not found');
      }

      if (preOrder.status === 'INJECTED_TO_POS') {
        Logger.warn('Order already injected to POS', { preOrderId });
        return {
          success: true,
          status: 'ALREADY_INJECTED',
        };
      }

      const restaurantId = preOrder.reservation.restaurantId;
      const client = await this.createPOSClient(restaurantId);

      if (!client) {
        throw new Error('POS client not available');
      }

      // Transform pre-order to POS order format
      const posOrder: POSOrder = {
        posType: preOrder.reservation.restaurant.posType as POSProvider,
        externalId: preOrderId,
        restaurantId,
        guestName: preOrder.reservation.user?.name || 'Guest',
        items: preOrder.items.map((item: any) => ({
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          modifiers: (item.modifiersJson as any) || [],
          notes: item.notes || undefined,
        })),
        subtotal: preOrder.subtotal,
        tax: preOrder.tax,
        tip: preOrder.tip,
        total: preOrder.total,
      };

      // Create order in POS
      const response = await client.createOrder(posOrder);

      if (response.success) {
        // Update pre-order status
        await db.preOrder.update({
          where: { id: preOrderId },
          data: { status: 'INJECTED_TO_POS' },
        });

        // Log event
        await db.event.create({
          data: {
            kind: 'order_injected_to_pos',
            actorId: preOrder.reservation.userId,
            restaurantId,
            reservationId: preOrder.reservationId,
            payloadJson: {
              preOrderId,
              posOrderId: response.posOrderId,
              posProvider: posOrder.posType,
            },
          },
        });

        Logger.info('Order successfully injected to POS', {
          preOrderId,
          posOrderId: response.posOrderId,
        });
      }

      return response;
    } catch (error) {
      Logger.error('Failed to inject order to POS', {
        preOrderId,
        error: formatError(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get POS order status
   */
  async getOrderStatus(restaurantId: string, posOrderId: string): Promise<string | null> {
    try {
      const client = await this.createPOSClient(restaurantId);
      if (!client) {
        return null;
      }

      return await client.getOrderStatus(posOrderId);
    } catch (error) {
      Logger.error('Failed to get POS order status', {
        restaurantId,
        posOrderId,
        error: formatError(error),
      });
      return null;
    }
  }
}

// Export singleton instance
export const posService = new POSService();
