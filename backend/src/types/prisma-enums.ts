/**
 * Prisma enum types - Temporary stub types for when Prisma Client is not generated
 * These match the enums defined in prisma/schema.prisma
 *
 * In production, these will be replaced by the actual generated Prisma types
 * To use the real types: npm run db:generate
 */

export enum UserRole {
  DINER = 'DINER',
  HOST = 'HOST',
  SERVER = 'SERVER',
  EXPO = 'EXPO',
  KITCHEN = 'KITCHEN',
  MANAGER = 'MANAGER',
  ORG_ADMIN = 'ORG_ADMIN',
  SUPPORT = 'SUPPORT'
}

export enum ReservationStatus {
  DRAFT = 'DRAFT',
  BOOKED = 'BOOKED',
  CHECKED_IN = 'CHECKED_IN',
  COMPLETED = 'COMPLETED',
  CANCELED = 'CANCELED',
  NO_SHOW = 'NO_SHOW'
}

export enum PreOrderStatus {
  DRAFT = 'DRAFT',
  AUTHORIZED = 'AUTHORIZED',
  INJECTED_TO_POS = 'INJECTED_TO_POS',
  CLOSED = 'CLOSED',
  REFUNDED = 'REFUNDED',
  ADJUSTED = 'ADJUSTED'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED'
}

export enum CheckInMethod {
  QR_SCAN = 'QR_SCAN',
  MANUAL = 'MANUAL',
  INTEGRATION = 'INTEGRATION'
}

export enum KitchenTicketStatus {
  PENDING = 'PENDING',
  HOLD = 'HOLD',
  FIRED = 'FIRED',
  READY = 'READY',
  SERVED = 'SERVED'
}

export enum EmbeddingType {
  MENU_ITEM = 'MENU_ITEM',
  RESTAURANT = 'RESTAURANT',
  USER_PREFERENCE = 'USER_PREFERENCE'
}

// Type for PreOrderItem
export interface PreOrderItem {
  id: string;
  preorderId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  modifiersJson: any;
  notes: string | null;
  allergensJson: any;
  createdAt: Date;
  updatedAt: Date;
}
