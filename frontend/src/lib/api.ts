import { 
  ApiResponse, 
  Restaurant, 
  AvailabilityResponse, 
  CreateReservationRequest, 
  Reservation 
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
};

export { ApiError };