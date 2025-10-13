// Shared types between frontend and backend

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  createdAt: Date;
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  locations: Location[];
  capacity?: {
    totalSeats: number;
    tableCount: number;
  };
}

export interface Location {
  id: string;
  address: string;
  phone?: string;
  tables: Table[];
}

export interface Table {
  id: string;
  label: string;
  seats: number;
  featuresJson?: Record<string, unknown>;
}

export interface Reservation {
  id: string;
  restaurantId: string;
  userId?: string;
  partySize: number;
  startAt: string;
  status: ReservationStatus;
  source: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  };
  restaurant?: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  };
  preOrder?: PreOrder;
  qrUrl?: string;
  confirmationCode?: string;
}

export interface PreOrder {
  id: string;
  reservationId: string;
  status: PreOrderStatus;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  currency: string;
  items: PreOrderItem[];
  reservation?: Reservation;
}

export interface AvailabilitySlot {
  time: string;
  available: boolean;
  capacity: number;
}

export interface AvailabilityResponse {
  date: string;
  partySize: number;
  restaurant: {
    id: string;
    name: string;
    slug: string;
  };
  availableSlots: AvailabilitySlot[];
}

export interface CreateReservationRequest {
  restaurantId: string;
  partySize: number;
  startAt: string;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  specialRequests?: string;
}

export type ReservationStatus = 
  | 'DRAFT'
  | 'BOOKED'
  | 'CHECKED_IN'
  | 'COMPLETED'
  | 'CANCELED'
  | 'NO_SHOW';

export type PreOrderStatus = 
  | 'DRAFT'
  | 'AUTHORIZED'
  | 'INJECTED_TO_POS'
  | 'CLOSED'
  | 'REFUNDED'
  | 'ADJUSTED';

export interface HealthCheckResponse {
  status: string;
  message: string;
  database: string;
  timestamp: string;
}

// Menu Types
export interface MenuCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  items: MenuItem[];
}

export interface MenuItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  prepTimeMinutes: number | null;
  isAvailable: boolean;
  is86: boolean;
  allergensJson: string[] | null;
  dietaryTags: string[];
  nutritionJson: Record<string, unknown> | null;
  sortOrder: number;
  category: {
    id: string;
    name: string;
  };
  modifierGroups: ModifierGroup[];
}

export interface ModifierGroup {
  id: string;
  name: string;
  description: string | null;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  sortOrder: number;
  modifiers: Modifier[];
}

export interface Modifier {
  id: string;
  name: string;
  description: string | null;
  price: number;
  isAvailable: boolean;
  sortOrder: number;
}

export interface MenuResponse {
  categories: MenuCategory[];
}

// Pre-order Types
export interface PreOrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  modifiersJson?: Array<{
    name: string;
    price: number;
  }>;
  notes?: string;
  allergensJson?: string[];
}

export interface PreOrder {
  id: string;
  reservationId: string;
  status: PreOrderStatus;
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  currency: string;
  items: PreOrderItem[];
  payments?: Array<Record<string, unknown>>; // Will be defined when we add Stripe integration
  reservation?: Reservation;
}

export interface CreatePreOrderRequest {
  reservationId?: string;
  guestInfo?: {
    name: string;
    email: string;
    phone?: string;
  };
  items: Array<{
    sku: string;
    quantity: number;
    modifiers?: Array<{
      modifierGroupId: string;
      modifierId: string;
    }>;
    notes?: string;
  }>;
}

export interface PreOrderCalculation {
  subtotal: number;
  tax: number;
  total: number;
  items: Array<{
    sku: string;
    name: string;
    quantity: number;
    basePrice: number;
    modifierPrice: number;
    totalPrice: number;
    modifiers: Array<{
      name: string;
      price: number;
    }>;
  }>;
}
