import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MenuItemModifier {
  id: string;
  name: string;
  price: number;
}

export interface CartItem {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  modifiers: MenuItemModifier[];
  specialInstructions?: string;
  imageUrl?: string;
}

interface CartStore {
  items: CartItem[];
  restaurantId: string | null;
  reservationId: string | null;
  
  // Actions
  addItem: (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  setRestaurant: (restaurantId: string) => void;
  setReservation: (reservationId: string) => void;
  
  // Computed
  getTotalItems: () => number;
  getSubtotal: () => number;
  getTax: (taxRate?: number) => number;
  getTip: (tipPercent?: number) => number;
  getTotal: (taxRate?: number, tipPercent?: number) => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantId: null,
      reservationId: null,

      addItem: (item) => {
        const id = `${item.sku}-${Date.now()}-${Math.random()}`;
        const newItem: CartItem = { ...item, id };
        
        set((state) => ({
          items: [...state.items, newItem]
        }));
      },

      updateQuantity: (itemId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(itemId);
          return;
        }
        
        set((state) => ({
          items: state.items.map((item) =>
            item.id === itemId ? { ...item, quantity } : item
          )
        }));
      },

      removeItem: (itemId) => {
        set((state) => ({
          items: state.items.filter((item) => item.id !== itemId)
        }));
      },

      clearCart: () => {
        set({ items: [], restaurantId: null, reservationId: null });
      },

      setRestaurant: (restaurantId) => {
        const currentRestaurant = get().restaurantId;
        
        // If switching restaurants, clear the cart
        if (currentRestaurant && currentRestaurant !== restaurantId) {
          get().clearCart();
        }
        
        set({ restaurantId });
      },

      setReservation: (reservationId) => {
        set({ reservationId });
      },

      getTotalItems: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.quantity, 0);
      },

      getSubtotal: () => {
        const { items } = get();
        return items.reduce((total, item) => {
          const itemPrice = item.price;
          const modifiersPrice = item.modifiers.reduce((sum, mod) => sum + mod.price, 0);
          return total + (itemPrice + modifiersPrice) * item.quantity;
        }, 0);
      },

      getTax: (taxRate = 0.0875) => {
        const subtotal = get().getSubtotal();
        return Math.round(subtotal * taxRate);
      },

      getTip: (tipPercent = 18) => {
        const subtotal = get().getSubtotal();
        return Math.round(subtotal * (tipPercent / 100));
      },

      getTotal: (taxRate = 0.0875, tipPercent = 18) => {
        const subtotal = get().getSubtotal();
        const tax = get().getTax(taxRate);
        const tip = get().getTip(tipPercent);
        return subtotal + tax + tip;
      }
    }),
    {
      name: 'lacarta-cart',
      partialize: (state) => ({
        items: state.items,
        restaurantId: state.restaurantId,
        reservationId: state.reservationId
      })
    }
  )
);