/**
 * Square POS API Integration
 * Handles menu sync and order injection for Square POS systems
 *
 * API Documentation: https://developer.squareup.com
 * Authentication: OAuth 2.0 with Bearer token
 */

import axios, { AxiosInstance } from 'axios';
import { Logger } from '../lib/logger';
import { withRetry, POS_RETRY_OPTIONS } from '../utils/retry';
import { formatError } from '../utils/errorFormat';
import {
  POSMenuItem,
  POSModifierGroup,
  POSModifier,
  POSOrder,
  POSOrderResponse,
  POSMenuSyncResult,
} from '../types/pos';

// Square API Configuration
const SQUARE_API_BASE_URL = process.env.SQUARE_API_BASE_URL || 'https://connect.squareup.com';
const SQUARE_API_VERSION = process.env.SQUARE_API_VERSION || '2024-11-20';

export interface SquareConfig {
  locationId: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface SquareCatalogItem {
  id: string;
  type: 'ITEM' | 'CATEGORY' | 'MODIFIER' | 'MODIFIER_LIST';
  item_data?: {
    name: string;
    description?: string;
    variations?: Array<{
      id: string;
      item_variation_data: {
        name: string;
        price_money?: {
          amount: number;
          currency: string;
        };
        sku?: string;
      };
    }>;
    modifier_list_info?: Array<{
      modifier_list_id: string;
      min_selected_modifiers?: number;
      max_selected_modifiers?: number;
      enabled?: boolean;
    }>;
  };
  modifier_list_data?: {
    name: string;
    selection_type: 'SINGLE' | 'MULTIPLE';
    modifiers?: Array<{
      id: string;
      modifier_data: {
        name: string;
        price_money?: {
          amount: number;
          currency: string;
        };
      };
    }>;
  };
}

export interface SquareOrder {
  location_id: string;
  reference_id?: string;
  line_items: Array<{
    catalog_object_id?: string;
    quantity: string;
    name: string;
    base_price_money: {
      amount: number;
      currency: string;
    };
    modifiers?: Array<{
      catalog_object_id?: string;
      name: string;
      base_price_money: {
        amount: number;
        currency: string;
      };
    }>;
    note?: string;
  }>;
  metadata?: Record<string, string>;
}

/**
 * Square POS API Client
 */
export class SquareClient {
  private config: SquareConfig;
  private axiosInstance: AxiosInstance;

  constructor(config: SquareConfig) {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: SQUARE_API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
        'Square-Version': SQUARE_API_VERSION,
        Authorization: `Bearer ${config.accessToken}`,
      },
    });
  }

  /**
   * Make authenticated API request to Square
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<T> {
    return withRetry(
      async () => {
        const response = await this.axiosInstance.request<T>({
          method,
          url: endpoint,
          data,
        });
        return response.data;
      },
      POS_RETRY_OPTIONS
    );
  }

  /**
   * Fetch catalog items (menu) from Square
   */
  async getMenuItems(): Promise<POSMenuItem[]> {
    try {
      Logger.info('Fetching catalog from Square', {
        locationId: this.config.locationId,
      });

      // Fetch catalog objects (items and modifier lists)
      const response = await this.makeRequest<{
        objects?: SquareCatalogItem[];
        cursor?: string;
      }>(
        'POST',
        '/v2/catalog/search',
        {
          object_types: ['ITEM', 'MODIFIER_LIST'],
          include_related_objects: true,
        }
      );

      if (!response.objects) {
        return [];
      }

      // Separate items and modifier lists
      const items = response.objects.filter((obj) => obj.type === 'ITEM');
      const modifierLists = response.objects.filter((obj) => obj.type === 'MODIFIER_LIST');

      // Create a map of modifier lists for quick lookup
      const modifierListMap = new Map<string, POSModifierGroup>();
      modifierLists.forEach((modList) => {
        if (modList.modifier_list_data) {
          modifierListMap.set(modList.id, this.transformModifierList(modList));
        }
      });

      // Transform items to POSMenuItem format
      const posMenuItems: POSMenuItem[] = [];

      for (const item of items) {
        if (!item.item_data?.variations) continue;

        // Square items have variations (sizes, etc.) - we'll create a menu item per variation
        for (const variation of item.item_data.variations) {
          const modifierGroups: POSModifierGroup[] = [];

          // Add modifier groups if present
          if (item.item_data.modifier_list_info) {
            for (const modInfo of item.item_data.modifier_list_info) {
              if (modInfo.enabled !== false) {
                const modGroup = modifierListMap.get(modInfo.modifier_list_id);
                if (modGroup) {
                  modifierGroups.push({
                    ...modGroup,
                    minSelections: modInfo.min_selected_modifiers || 0,
                    maxSelections: modInfo.max_selected_modifiers || modGroup.modifiers.length,
                  });
                }
              }
            }
          }

          posMenuItems.push({
            posId: variation.id,
            posType: 'square',
            name: `${item.item_data.name} - ${variation.item_variation_data.name}`,
            description: item.item_data.description,
            price: variation.item_variation_data.price_money?.amount || 0,
            sku: variation.item_variation_data.sku,
            isAvailable: true,
            modifierGroups,
          });
        }
      }

      Logger.info('Successfully fetched Square catalog', {
        itemCount: posMenuItems.length,
      });

      return posMenuItems;
    } catch (error) {
      Logger.error('Failed to fetch Square catalog', {
        error: formatError(error),
      });
      throw error;
    }
  }

  /**
   * Transform Square modifier list to POS format
   */
  private transformModifierList(modList: SquareCatalogItem): POSModifierGroup {
    const modifiers: POSModifier[] = [];

    if (modList.modifier_list_data?.modifiers) {
      for (const mod of modList.modifier_list_data.modifiers) {
        modifiers.push({
          posId: mod.id,
          name: mod.modifier_data.name,
          price: mod.modifier_data.price_money?.amount || 0,
          isAvailable: true,
        });
      }
    }

    return {
      posId: modList.id,
      name: modList.modifier_list_data?.name || 'Modifiers',
      minSelections: 0,
      maxSelections: modifiers.length,
      isRequired: false,
      modifiers,
    };
  }

  /**
   * Create order in Square POS
   */
  async createOrder(order: POSOrder): Promise<POSOrderResponse> {
    try {
      Logger.info('Creating order in Square', {
        locationId: this.config.locationId,
        itemCount: order.items.length,
        total: order.total,
      });

      // Transform order to Square format
      const squareOrder: SquareOrder = {
        location_id: this.config.locationId,
        reference_id: order.externalId,
        line_items: order.items.map((item) => ({
          catalog_object_id: item.posMenuItemId,
          quantity: String(item.quantity),
          name: item.name,
          base_price_money: {
            amount: item.price,
            currency: 'USD',
          },
          modifiers: item.modifiers?.map((mod) => ({
            catalog_object_id: mod.posModifierId,
            name: mod.name,
            base_price_money: {
              amount: mod.price,
              currency: 'USD',
            },
          })),
          note: item.notes,
        })),
        metadata: {
          source: 'lacarta',
          table: order.tableNumber || '',
          guest: order.guestName || '',
        },
      };

      const response = await this.makeRequest<{
        order: {
          id: string;
          state: string;
          version: number;
        };
      }>(
        'POST',
        '/v2/orders',
        {
          order: squareOrder,
          idempotency_key: `lacarta-${order.externalId}-${Date.now()}`,
        }
      );

      Logger.info('Successfully created order in Square', {
        squareOrderId: response.order.id,
        state: response.order.state,
      });

      return {
        success: true,
        posOrderId: response.order.id,
        posOrderNumber: response.order.id,
        status: response.order.state,
      };
    } catch (error) {
      Logger.error('Failed to create order in Square', {
        error: formatError(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get order status from Square
   */
  async getOrderStatus(orderId: string): Promise<string | null> {
    try {
      const response = await this.makeRequest<{
        order: {
          id: string;
          state: string;
        };
      }>(
        'GET',
        `/v2/orders/${orderId}`
      );

      return response.order.state || null;
    } catch (error) {
      Logger.error('Failed to get Square order status', {
        orderId,
        error: formatError(error),
      });
      return null;
    }
  }

  /**
   * Update order in Square
   */
  async updateOrder(orderId: string, updates: Partial<SquareOrder>): Promise<POSOrderResponse> {
    try {
      const response = await this.makeRequest<{
        order: {
          id: string;
          state: string;
        };
      }>(
        'PUT',
        `/v2/orders/${orderId}`,
        {
          order: updates,
        }
      );

      return {
        success: true,
        posOrderId: response.order.id,
        status: response.order.state,
      };
    } catch (error) {
      Logger.error('Failed to update Square order', {
        orderId,
        error: formatError(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

/**
 * Create Square client instance
 */
export function createSquareClient(config: SquareConfig): SquareClient {
  return new SquareClient(config);
}
