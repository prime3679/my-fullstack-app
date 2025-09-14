import { act, renderHook } from '@testing-library/react';
import { useCartStore } from '../cartStore';

describe('CartStore', () => {
  beforeEach(() => {
    // Clear the store before each test
    const { result } = renderHook(() => useCartStore());
    act(() => {
      result.current.clearCart();
    });
  });

  describe('addItem', () => {
    it('should add an item to the cart', () => {
      const { result } = renderHook(() => useCartStore());
      
      act(() => {
        result.current.addItem({
          sku: 'ITEM001',
          name: 'Test Item',
          price: 1000,
          quantity: 1,
          modifiers: [],
        });
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].sku).toBe('ITEM001');
      expect(result.current.items[0].name).toBe('Test Item');
    });

    it('should generate unique IDs for each item', () => {
      const { result } = renderHook(() => useCartStore());
      
      act(() => {
        result.current.addItem({
          sku: 'ITEM001',
          name: 'Test Item',
          price: 1000,
          quantity: 1,
          modifiers: [],
        });
        result.current.addItem({
          sku: 'ITEM001',
          name: 'Test Item',
          price: 1000,
          quantity: 1,
          modifiers: [],
        });
      });

      expect(result.current.items).toHaveLength(2);
      expect(result.current.items[0].id).not.toBe(result.current.items[1].id);
    });
  });

  describe('updateQuantity', () => {
    it('should update item quantity', () => {
      const { result } = renderHook(() => useCartStore());
      
      act(() => {
        result.current.addItem({
          sku: 'ITEM001',
          name: 'Test Item',
          price: 1000,
          quantity: 1,
          modifiers: [],
        });
      });

      const itemId = result.current.items[0].id;

      act(() => {
        result.current.updateQuantity(itemId, 3);
      });

      expect(result.current.items[0].quantity).toBe(3);
    });

    it('should remove item when quantity is 0', () => {
      const { result } = renderHook(() => useCartStore());
      
      act(() => {
        result.current.addItem({
          sku: 'ITEM001',
          name: 'Test Item',
          price: 1000,
          quantity: 1,
          modifiers: [],
        });
      });

      const itemId = result.current.items[0].id;

      act(() => {
        result.current.updateQuantity(itemId, 0);
      });

      expect(result.current.items).toHaveLength(0);
    });
  });

  describe('removeItem', () => {
    it('should remove item from cart', () => {
      const { result } = renderHook(() => useCartStore());
      
      act(() => {
        result.current.addItem({
          sku: 'ITEM001',
          name: 'Item 1',
          price: 1000,
          quantity: 1,
          modifiers: [],
        });
        result.current.addItem({
          sku: 'ITEM002',
          name: 'Item 2',
          price: 2000,
          quantity: 1,
          modifiers: [],
        });
      });

      const itemToRemove = result.current.items[0].id;

      act(() => {
        result.current.removeItem(itemToRemove);
      });

      expect(result.current.items).toHaveLength(1);
      expect(result.current.items[0].name).toBe('Item 2');
    });
  });

  describe('setRestaurant', () => {
    it('should set restaurant ID', () => {
      const { result } = renderHook(() => useCartStore());
      
      act(() => {
        result.current.setRestaurant('restaurant-123');
      });

      expect(result.current.restaurantId).toBe('restaurant-123');
    });

    it('should clear cart when switching restaurants', () => {
      const { result } = renderHook(() => useCartStore());
      
      act(() => {
        result.current.setRestaurant('restaurant-123');
        result.current.addItem({
          sku: 'ITEM001',
          name: 'Test Item',
          price: 1000,
          quantity: 1,
          modifiers: [],
        });
      });

      expect(result.current.items).toHaveLength(1);

      act(() => {
        result.current.setRestaurant('restaurant-456');
      });

      expect(result.current.items).toHaveLength(0);
      expect(result.current.restaurantId).toBe('restaurant-456');
    });
  });

  describe('calculations', () => {
    beforeEach(() => {
      const { result } = renderHook(() => useCartStore());
      
      act(() => {
        result.current.addItem({
          sku: 'ITEM001',
          name: 'Item 1',
          price: 1000,
          quantity: 2,
          modifiers: [],
        });
        result.current.addItem({
          sku: 'ITEM002',
          name: 'Item 2',
          price: 1500,
          quantity: 1,
          modifiers: [
            { id: 'mod1', name: 'Extra cheese', price: 200 }
          ],
        });
      });
    });

    it('should calculate total items correctly', () => {
      const { result } = renderHook(() => useCartStore());
      expect(result.current.getTotalItems()).toBe(3);
    });

    it('should calculate subtotal correctly', () => {
      const { result } = renderHook(() => useCartStore());
      // (1000 * 2) + (1500 + 200) * 1 = 2000 + 1700 = 3700
      expect(result.current.getSubtotal()).toBe(3700);
    });

    it('should calculate tax correctly', () => {
      const { result } = renderHook(() => useCartStore());
      const tax = result.current.getTax(0.10); // 10% tax
      expect(tax).toBe(370); // 3700 * 0.10 = 370
    });

    it('should calculate tip correctly', () => {
      const { result } = renderHook(() => useCartStore());
      const tip = result.current.getTip(20); // 20% tip
      expect(tip).toBe(740); // 3700 * 0.20 = 740
    });

    it('should calculate total correctly', () => {
      const { result } = renderHook(() => useCartStore());
      const total = result.current.getTotal(0.10, 20);
      // Subtotal: 3700, Tax: 370, Tip: 740
      expect(total).toBe(4810);
    });
  });

  describe('clearCart', () => {
    it('should clear all items and reset state', () => {
      const { result } = renderHook(() => useCartStore());
      
      act(() => {
        result.current.setRestaurant('restaurant-123');
        result.current.setReservation('reservation-456');
        result.current.addItem({
          sku: 'ITEM001',
          name: 'Test Item',
          price: 1000,
          quantity: 1,
          modifiers: [],
        });
      });

      act(() => {
        result.current.clearCart();
      });

      expect(result.current.items).toHaveLength(0);
      expect(result.current.restaurantId).toBeNull();
      expect(result.current.reservationId).toBeNull();
    });
  });
});