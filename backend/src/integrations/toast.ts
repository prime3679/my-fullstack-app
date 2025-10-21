/**
 * Toast POS API Integration
 * Handles menu sync and order injection for Toast POS systems
 *
 * API Documentation: https://doc.toasttab.com
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

// Toast API Configuration
const TOAST_API_BASE_URL = process.env.TOAST_API_BASE_URL || 'https://ws-api.toasttab.com';
const TOAST_AUTH_BASE_URL = process.env.TOAST_AUTH_BASE_URL || 'https://ws-auth.toasttab.com';

export interface ToastConfig {
  locationGuid: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface ToastMenuItem {
  guid: string;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  visibility: 'VISIBLE' | 'HIDDEN';
  modifierGroups?: ToastModifierGroup[];
}

export interface ToastModifierGroup {
  guid: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  modifiers: ToastModifier[];
}

export interface ToastModifier {
  guid: string;
  name: string;
  price: number;
}

export interface ToastOrder {
  guid?: string;
  openedDate: string;
  modifiedDate?: string;
  checks: Array<{
    guid?: string;
    displayNumber?: string;
    selections: Array<{
      guid?: string;
      itemGuid?: string;
      sku?: string;
      itemName: string;
      quantity: number;
      preDiscountPrice: number;
      modifiers?: Array<{
        modifierGuid?: string;
        name: string;
        price: number;
      }>;
      specialRequests?: string;
    }>;
  }>;
}

/**
 * Toast POS API Client
 */
type ToastTokenUpdate = {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date;
};

export class ToastClient {
  private config: ToastConfig;
  private axiosInstance: AxiosInstance;
  private onTokenUpdated?: (tokens: ToastTokenUpdate) => Promise<void> | void;

  constructor(
    config: ToastConfig,
    onTokenUpdated?: (tokens: ToastTokenUpdate) => Promise<void> | void
  ) {
    this.config = config;
    this.onTokenUpdated = onTokenUpdated;
    this.axiosInstance = axios.create({
      baseURL: TOAST_API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Refresh OAuth access token using refresh token
   */
  private async refreshAccessToken(): Promise<void> {
    try {
      Logger.info('Refreshing Toast access token', {
        locationGuid: this.config.locationGuid,
      });

      const response = await axios.post(
        `${TOAST_AUTH_BASE_URL}/authentication/v1/authentication/token`,
        {
          grant_type: 'refresh_token',
          refresh_token: this.config.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }
      );

      this.config.accessToken = response.data.access_token;
      this.config.refreshToken = response.data.refresh_token;
      this.config.tokenExpiresAt = new Date(Date.now() + response.data.expires_in * 1000);

      Logger.info('Toast access token refreshed successfully', {
        expiresAt: this.config.tokenExpiresAt,
      });

      if (this.onTokenUpdated && this.config.accessToken && this.config.tokenExpiresAt) {
        try {
          await this.onTokenUpdated({
            accessToken: this.config.accessToken,
            refreshToken: this.config.refreshToken,
            tokenExpiresAt: this.config.tokenExpiresAt,
          });
        } catch (persistError) {
          Logger.error('Failed to persist refreshed Toast tokens', {
            error: formatError(persistError),
          });
          throw persistError;
        }
      }
    } catch (error) {
      Logger.error('Failed to refresh Toast access token', {
        error: formatError(error),
      });
      throw new Error('Toast authentication failed');
    }
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureValidToken(): Promise<void> {
    // Check if token is expired or will expire in next 5 minutes
    if (!this.config.accessToken ||
        !this.config.tokenExpiresAt ||
        this.config.tokenExpiresAt.getTime() < Date.now() + 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }
  }

  /**
   * Make authenticated API request to Toast
   */
  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<T> {
    await this.ensureValidToken();

    return withRetry(
      async () => {
        const response = await this.axiosInstance.request<T>({
          method,
          url: endpoint,
          data,
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
          },
        });
        return response.data;
      },
      POS_RETRY_OPTIONS
    );
  }

  /**
   * Fetch menu items from Toast POS
   */
  async getMenuItems(): Promise<POSMenuItem[]> {
    try {
      Logger.info('Fetching menu from Toast', {
        locationGuid: this.config.locationGuid,
      });

      // Fetch menu groups (categories)
      const menuGroups = await this.makeRequest<any[]>(
        'GET',
        `/menus/v2/restaurants/${this.config.locationGuid}/menuGroups`
      );

      // Fetch menu items
      const menuItems = await this.makeRequest<ToastMenuItem[]>(
        'GET',
        `/menus/v2/restaurants/${this.config.locationGuid}/menuItems`
      );

      // Transform to POSMenuItem format
      const posMenuItems: POSMenuItem[] = menuItems
        .filter((item) => item.visibility === 'VISIBLE')
        .map((item) => ({
          posId: item.guid,
          posType: 'toast',
          name: item.name,
          description: item.description,
          price: Math.round(item.price * 100), // Convert to cents
          sku: item.sku,
          isAvailable: true,
          modifierGroups: item.modifierGroups?.map(this.transformModifierGroup) || [],
        }));

      Logger.info('Successfully fetched Toast menu', {
        itemCount: posMenuItems.length,
      });

      return posMenuItems;
    } catch (error) {
      Logger.error('Failed to fetch Toast menu', {
        error: formatError(error),
      });
      throw error;
    }
  }

  /**
   * Transform Toast modifier group to POS format
   */
  private transformModifierGroup(group: ToastModifierGroup): POSModifierGroup {
    return {
      posId: group.guid,
      name: group.name,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      isRequired: group.minSelections > 0,
      modifiers: group.modifiers.map((mod) => ({
        posId: mod.guid,
        name: mod.name,
        price: Math.round(mod.price * 100), // Convert to cents
        isAvailable: true,
      })),
    };
  }

  /**
   * Create order in Toast POS
   */
  async createOrder(order: POSOrder): Promise<POSOrderResponse> {
    try {
      Logger.info('Creating order in Toast', {
        locationGuid: this.config.locationGuid,
        itemCount: order.items.length,
        total: order.total,
      });

      // Transform order to Toast format
      const toastOrder: ToastOrder = {
        openedDate: new Date().toISOString(),
        checks: [
          {
            displayNumber: order.tableNumber,
            selections: order.items.map((item) => ({
              sku: item.sku,
              itemName: item.name,
              quantity: item.quantity,
              preDiscountPrice: item.price / 100, // Convert from cents
              modifiers: item.modifiers?.map((mod) => ({
                name: mod.name,
                price: mod.price / 100, // Convert from cents
              })),
              specialRequests: item.notes,
            })),
          },
        ],
      };

      const response = await this.makeRequest<{ guid: string; entityType: string }>(
        'POST',
        `/orders/v2/restaurants/${this.config.locationGuid}/orders`,
        toastOrder
      );

      Logger.info('Successfully created order in Toast', {
        toastOrderGuid: response.guid,
      });

      return {
        success: true,
        posOrderId: response.guid,
        posOrderNumber: response.guid,
        status: 'CREATED',
      };
    } catch (error) {
      Logger.error('Failed to create order in Toast', {
        error: formatError(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get order status from Toast
   */
  async getOrderStatus(orderId: string): Promise<string | null> {
    try {
      const order = await this.makeRequest<any>(
        'GET',
        `/orders/v2/restaurants/${this.config.locationGuid}/orders/${orderId}`
      );

      return order.status || null;
    } catch (error) {
      Logger.error('Failed to get Toast order status', {
        orderId,
        error: formatError(error),
      });
      return null;
    }
  }
}

/**
 * Create Toast client instance
 */
export function createToastClient(
  config: ToastConfig,
  onTokenUpdated?: (tokens: ToastTokenUpdate) => Promise<void> | void
): ToastClient {
  return new ToastClient(config, onTokenUpdated);
}
