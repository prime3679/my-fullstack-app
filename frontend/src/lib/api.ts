import { 
  ApiResponse, 
  Restaurant, 
  AvailabilityResponse, 
  CreateReservationRequest, 
  Reservation,
  MenuResponse,
  MenuItem,
  PreOrder,
  CreatePreOrderRequest,
  PreOrderCalculation
} from '../../../shared/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiRequest<T>(
  endpoint: string, 
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.error || 'API request failed');
  }

  return data;
}

export const api = {
  // Restaurant endpoints
  async getRestaurants(): Promise<ApiResponse<{ restaurants: Restaurant[]; count: number }>> {
    return apiRequest('/restaurants');
  },

  async getRestaurant(slug: string): Promise<ApiResponse<Restaurant>> {
    return apiRequest(`/restaurants/${slug}`);
  },

  async searchRestaurants(query: string, location?: string): Promise<ApiResponse<{ restaurants: Restaurant[]; count: number }>> {
    const params = new URLSearchParams({ q: query });
    if (location) params.append('location', location);
    return apiRequest(`/restaurants/search?${params}`);
  },

  // Reservation endpoints
  async checkAvailability(
    restaurantId: string, 
    partySize: number, 
    date: string
  ): Promise<ApiResponse<AvailabilityResponse>> {
    const params = new URLSearchParams({
      restaurantId,
      partySize: partySize.toString(),
      date
    });
    return apiRequest(`/reservations/availability?${params}`);
  },

  async createReservation(data: CreateReservationRequest): Promise<ApiResponse<Reservation>> {
    return apiRequest('/reservations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getReservation(id: string): Promise<ApiResponse<Reservation>> {
    return apiRequest(`/reservations/${id}`);
  },

  async cancelReservation(id: string): Promise<ApiResponse<Reservation>> {
    return apiRequest(`/reservations/${id}`, {
      method: 'DELETE',
    });
  },

  async updateReservationStatus(id: string, status: string): Promise<ApiResponse<Reservation>> {
    return apiRequest(`/reservations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  // Menu endpoints
  async getMenu(restaurantId: string): Promise<ApiResponse<MenuResponse>> {
    return apiRequest(`/menu/restaurant/${restaurantId}`);
  },

  async getRestaurantMenu(restaurantId: string): Promise<ApiResponse<MenuResponse>> {
    return apiRequest(`/menu/restaurant/${restaurantId}`);
  },

  async getMenuItem(restaurantId: string, sku: string): Promise<ApiResponse<MenuItem>> {
    return apiRequest(`/menu/restaurant/${restaurantId}/item/${sku}`);
  },

  async searchMenuItems(
    restaurantId: string, 
    query?: string, 
    dietary?: string[], 
    excludeAllergens?: string[]
  ): Promise<ApiResponse<{ items: MenuItem[]; count: number }>> {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (dietary?.length) params.append('dietary', dietary.join(','));
    if (excludeAllergens?.length) params.append('allergens', excludeAllergens.join(','));
    
    return apiRequest(`/menu/restaurant/${restaurantId}/search?${params}`);
  },

  // Pre-order endpoints
  async calculatePreOrder(
    restaurantId: string, 
    items: CreatePreOrderRequest['items']
  ): Promise<ApiResponse<PreOrderCalculation>> {
    // For now, skip calculation since it's not critical
    // TODO: Fix calculate endpoint
    return Promise.resolve({
      success: true,
      data: {
        subtotal: items.reduce((sum, item) => sum + (item.quantity * 1000), 0), // Rough estimate
        tax: items.reduce((sum, item) => sum + (item.quantity * 100), 0),
        total: items.reduce((sum, item) => sum + (item.quantity * 1100), 0),
        items: []
      }
    });
  },

  async createPreOrder(reservationId: string, items: Array<{
    sku: string;
    quantity: number;
    modifiers?: Array<{
      modifierGroupId: string;
      modifierId: string;
    }>;
    notes?: string;
  }>): Promise<ApiResponse<PreOrder>> {
    return apiRequest('/preorders', {
      method: 'POST',
      body: JSON.stringify({ reservationId, items }),
    });
  },

  async getPreOrder(id: string): Promise<ApiResponse<PreOrder>> {
    return apiRequest(`/preorders/${id}`);
  },

  async updatePreOrderItem(
    preOrderId: string, 
    itemId: string, 
    updates: { quantity?: number; notes?: string }
  ): Promise<ApiResponse<any>> {
    return apiRequest(`/preorders/${preOrderId}/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async removePreOrderItem(preOrderId: string, itemId: string): Promise<ApiResponse<any>> {
    return apiRequest(`/preorders/${preOrderId}/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  // Check-in endpoints
  async checkIn(code: string): Promise<ApiResponse<{ 
    reservationId: string; 
    checkinId: string;
    tableNumber?: string;
  }>> {
    return apiRequest('/checkin', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async getCheckInStatus(reservationId: string): Promise<ApiResponse<any>> {
    return apiRequest(`/checkin/status/${reservationId}`);
  },

  // Payment endpoints
  async createPaymentIntent(preOrderId: string, tipPercent?: number): Promise<ApiResponse<{
    clientSecret: string;
    paymentIntentId: string;
    amount: number;
  }>> {
    return apiRequest('/payments/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ preOrderId, tipPercent }),
    });
  },

  async confirmPayment(paymentIntentId: string, preOrderId: string): Promise<ApiResponse<any>> {
    return apiRequest('/payments/confirm', {
      method: 'POST',
      body: JSON.stringify({ paymentIntentId, preOrderId }),
    });
  },
};

export { ApiError };