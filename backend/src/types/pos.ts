/**
 * POS Integration Types
 * Backend-specific types for POS integration
 */

export type POSProvider = 'toast' | 'square' | null;

export interface POSConfiguration {
  provider: POSProvider;
  restaurantId: string;
  // Toast-specific config
  toastLocationGuid?: string;
  toastClientId?: string;
  toastClientSecret?: string;
  toastAccessToken?: string;
  toastRefreshToken?: string;
  toastTokenExpiresAt?: Date;
  // Square-specific config
  squareLocationId?: string;
  squareAccessToken?: string;
  squareRefreshToken?: string;
  squareTokenExpiresAt?: Date;
  // Common settings
  autoSyncMenu?: boolean;
  syncFrequencyMinutes?: number;
  lastMenuSyncAt?: Date;
  lastOrderSyncAt?: Date;
}

export interface POSMenuItem {
  posId: string;
  posType: POSProvider;
  name: string;
  description?: string;
  price: number;
  sku?: string;
  categoryId?: string;
  categoryName?: string;
  imageUrl?: string;
  isAvailable: boolean;
  modifierGroups?: POSModifierGroup[];
  metadata?: Record<string, any>;
}

export interface POSModifierGroup {
  posId: string;
  name: string;
  description?: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  modifiers: POSModifier[];
}

export interface POSModifier {
  posId: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
}

export interface POSOrder {
  posType: POSProvider;
  externalId?: string;
  restaurantId: string;
  tableNumber?: string;
  guestName?: string;
  items: POSOrderItem[];
  subtotal: number;
  tax: number;
  tip?: number;
  total: number;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface POSOrderItem {
  posMenuItemId?: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: Array<{
    posModifierId?: string;
    name: string;
    price: number;
  }>;
  notes?: string;
}

export interface POSOrderResponse {
  success: boolean;
  posOrderId?: string;
  posOrderNumber?: string;
  status?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface POSMenuSyncResult {
  success: boolean;
  provider: POSProvider;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  categoriesCreated: number;
  categoriesUpdated: number;
  errors: string[];
  syncedAt: Date;
}

export interface POSWebhookPayload {
  provider: POSProvider;
  eventType: string;
  orderId?: string;
  orderStatus?: string;
  timestamp: Date;
  data: Record<string, any>;
}
