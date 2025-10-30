'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../../../../../lib/api';

interface MenuItemData {
  id: string;
  sku: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  is86: boolean;
  category: {
    id: string;
    name: string;
  };
  modifierGroups: Array<{
    modifierGroup: {
      id: string;
      name: string;
      description?: string;
      minSelections: number;
      maxSelections: number;
      isRequired: boolean;
      modifiers: Array<{
        id: string;
        name: string;
        description?: string;
        price: number;
        isAvailable: boolean;
      }>;
    };
    isRequired: boolean;
  }>;
}

interface PreOrderItem {
  sku: string;
  name: string;
  quantity: number;
  basePrice: number;
  totalPrice: number;
  modifiers?: Array<{
    modifierGroupId: string;
    modifierId: string;
    name: string;
    price: number;
  }>;
  notes?: string;
}

interface CartItem {
  sku: string;
  quantity: number;
  modifiers: Array<{
    modifierGroupId: string;
    modifierId: string;
  }>;
  notes?: string;
}

export default function PreOrderPage() {
  const params = useParams();
  const router = useRouter();
  const restaurantSlug = params.slug as string;
  const reservationId = params.reservationId as string;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showItemModal, setShowItemModal] = useState<string | null>(null);
  const [currentItemModifiers, setCurrentItemModifiers] = useState<Array<{
    modifierGroupId: string;
    modifierId: string;
  }>>([]);
  const [currentItemNotes, setCurrentItemNotes] = useState('');
  const [currentItemQuantity, setCurrentItemQuantity] = useState(1);

  // Fetch reservation details
  const { data: reservation, isLoading: loadingReservation } = useQuery({
    queryKey: ['reservation', reservationId],
    queryFn: () => api.getReservation(reservationId),
  });

  // Check if reservation already has a pre-order
  const hasExistingPreOrder = reservation?.data?.preOrder;

  // Fetch menu items
  const { data: menuData, isLoading: loadingMenu } = useQuery({
    queryKey: ['menu', reservation?.data?.restaurant?.id],
    queryFn: () => api.getMenu(reservation?.data?.restaurant?.id),
    enabled: !!reservation?.data?.restaurant?.id,
  });

  // Pre-order calculation
  const { data: calculation, isLoading: calculatingPrice } = useQuery({
    queryKey: ['preorder-calculation', reservation?.data?.restaurant?.id, cart],
    queryFn: () => api.calculatePreOrder(reservation?.data?.restaurant?.id, cart),
    enabled: !!reservation?.data?.restaurant?.id && cart.length > 0,
  });

  // Create pre-order mutation
  const createPreOrderMutation = useMutation({
    mutationFn: (data: { reservationId: string; items: CartItem[] }) => 
      api.createPreOrder(data.reservationId, data.items),
    onSuccess: (response) => {
      console.log('Pre-order created:', response);
      // For now, just redirect to confirmation with success message
      // TODO: Implement payment flow
      router.push(`/payment?preOrderId=${response.data.id}`);
    },
    onError: (error) => {
      console.error('Failed to create pre-order:', error);
      alert('Failed to create pre-order. Please try again.');
    }
  });

  // If reservation already has a pre-order, redirect to confirmation
  useEffect(() => {
    if (hasExistingPreOrder) {
      router.push(`/restaurant/${restaurantSlug}/reserve/${reservationId}/confirmation?preorder=exists`);
    }
  }, [hasExistingPreOrder, router, restaurantSlug, reservationId]);

  const categories = menuData?.data?.categories || [];
  const menuItems = categories.flatMap((category: any) => 
    category.items ? category.items : []
  ) || [];

  // Filter items by selected category
  const filteredItems = selectedCategory 
    ? menuItems.filter((item: MenuItemData) => item.category.id === selectedCategory)
    : menuItems;

  // Get cart total
  const cartTotal = calculation?.total || 0;
  const cartSubtotal = calculation?.subtotal || 0;
  const cartTax = calculation?.tax || 0;

  const addToCart = (item: MenuItemData) => {
    setShowItemModal(item.id);
    setCurrentItemModifiers([]);
    setCurrentItemNotes('');
    setCurrentItemQuantity(1);
  };

  const confirmAddToCart = () => {
    if (!showItemModal) return;

    const newItem: CartItem = {
      sku: menuItems.find((item: MenuItemData) => item.id === showItemModal)?.sku || '',
      quantity: currentItemQuantity,
      modifiers: currentItemModifiers,
      notes: currentItemNotes
    };

    setCart(prev => {
      const existingIndex = prev.findIndex(cartItem => 
        cartItem.sku === newItem.sku && 
        JSON.stringify(cartItem.modifiers) === JSON.stringify(newItem.modifiers)
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += newItem.quantity;
        return updated;
      } else {
        return [...prev, newItem];
      }
    });

    setShowItemModal(null);
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateCartItemQuantity = (index: number, quantity: number) => {
    if (quantity === 0) {
      removeFromCart(index);
      return;
    }

    setCart(prev => {
      const updated = [...prev];
      updated[index].quantity = quantity;
      return updated;
    });
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Please add items to your cart first');
      return;
    }
    
    // Show loading state
    console.log('Creating pre-order with items:', cart);
    
    createPreOrderMutation.mutate({
      reservationId,
      items: cart
    });
  };

  const skipPreOrder = () => {
    router.push(`/restaurant/${restaurantSlug}/reserve/${reservationId}/confirmation`);
  };

  if (loadingReservation || loadingMenu) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (!reservation?.data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reservation Not Found</h1>
          <p className="text-gray-600">The reservation you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  if (hasExistingPreOrder) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Pre-order already exists. Redirecting...</p>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Reservation Not Found</h1>
          <p className="text-gray-600">The reservation you're looking for doesn't exist.</p>
        </div>
      </div>
    );
  }

  const selectedItem = showItemModal ? menuItems.find((item: MenuItemData) => item.id === showItemModal) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pre-Order for Your Reservation</h1>
              <p className="text-gray-600 mt-1">
                {reservation?.data?.restaurant?.name} • {new Date(reservation?.data?.startAt).toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit'
                })}
              </p>
            </div>
            <button
              onClick={skipPreOrder}
              className="text-amber-600 hover:text-amber-700 font-medium"
            >
              Skip Pre-Order →
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Menu Section */}
          <div className="lg:col-span-2">
            {/* Category Filter */}
            <div className="mb-6">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === null
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  All Items
                </button>
                {categories.map((category: any) => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-amber-600 text-white'
                        : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Items */}
            <div className="space-y-4">
              {filteredItems.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <p className="text-gray-600">No menu items available</p>
                  <p className="text-gray-500 text-sm mt-2">Check browser console for debugging info</p>
                </div>
              ) : (
                filteredItems.map((item: MenuItemData) => (
                <div key={item.id} className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                      {item.description && (
                        <p className="text-gray-600 text-sm mt-1">{item.description}</p>
                      )}
                      <p className="text-amber-600 font-semibold mt-2">
                        ${(item.price / 100).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => addToCart(item)}
                      disabled={!item.isAvailable || item.is86}
                      className="ml-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      {!item.isAvailable || item.is86 ? 'Unavailable' : 'Add to Order'}
                    </button>
                  </div>
                </div>
              )))}
            </div>
          </div>

          {/* Cart Section */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Pre-Order</h2>
              
              {cart.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No items in your order yet</p>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {calculation?.items?.map((item: PreOrderItem, index: number) => (
                      <div key={index} className="border-b border-gray-200 pb-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900">{item.name}</h4>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <div className="text-sm text-gray-600 mt-1">
                                {item.modifiers.map((mod, modIndex) => (
                                  <div key={modIndex}>• {mod.name} (+${(mod.price / 100).toFixed(2)})</div>
                                ))}
                              </div>
                            )}
                            {cart[index]?.notes && (
                              <p className="text-sm text-gray-600 mt-1 italic">Note: {cart[index].notes}</p>
                            )}
                          </div>
                          <div className="ml-4 text-right">
                            <p className="font-medium text-gray-900">${(item.totalPrice / 100).toFixed(2)}</p>
                            <div className="flex items-center mt-1">
                              <button
                                onClick={() => updateCartItemQuantity(index, item.quantity - 1)}
                                className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                              >
                                -
                              </button>
                              <span className="mx-2 text-sm text-gray-700">{item.quantity}</span>
                              <button
                                onClick={() => updateCartItemQuantity(index, item.quantity + 1)}
                                className="w-6 h-6 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order Summary */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span>${(cartSubtotal / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax</span>
                      <span>${(cartTax / 100).toFixed(2)}</span>
                    </div>
                    <div className="border-t border-gray-200 pt-2 flex justify-between font-semibold">
                      <span>Total</span>
                      <span>${(cartTotal / 100).toFixed(2)}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleCheckout}
                    disabled={createPreOrderMutation.isPending || cart.length === 0}
                    className="w-full mt-6 px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
                  >
                    {createPreOrderMutation.isPending ? 'Processing...' : 'Continue to Payment'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Item Modal */}
      {selectedItem && showItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">{selectedItem.name}</h3>
                <button
                  onClick={() => setShowItemModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              {selectedItem.description && (
                <p className="text-gray-600 mb-4">{selectedItem.description}</p>
              )}

              <p className="text-amber-600 font-semibold text-lg mb-6">
                ${(selectedItem.price / 100).toFixed(2)}
              </p>

              {/* Modifier Groups */}
              {selectedItem.modifierGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="mb-6">
                  <h4 className="font-medium text-gray-900 mb-2">
                    {group.modifierGroup.name} 
                    {group.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </h4>
                  {group.modifierGroup.description && (
                    <p className="text-gray-600 text-sm mb-3">{group.modifierGroup.description}</p>
                  )}
                  <div className="space-y-2">
                    {group.modifierGroup.modifiers.map((modifier) => (
                      <label key={modifier.id} className="flex items-center">
                        <input
                          type={group.modifierGroup.maxSelections === 1 ? 'radio' : 'checkbox'}
                          name={`modifier-group-${group.modifierGroup.id}`}
                          checked={currentItemModifiers.some(m => m.modifierId === modifier.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              if (group.modifierGroup.maxSelections === 1) {
                                // Radio behavior: replace existing selection
                                setCurrentItemModifiers(prev => [
                                  ...prev.filter(m => m.modifierGroupId !== group.modifierGroup.id),
                                  { modifierGroupId: group.modifierGroup.id, modifierId: modifier.id }
                                ]);
                              } else {
                                // Checkbox behavior: add to existing selections
                                setCurrentItemModifiers(prev => [
                                  ...prev,
                                  { modifierGroupId: group.modifierGroup.id, modifierId: modifier.id }
                                ]);
                              }
                            } else {
                              setCurrentItemModifiers(prev => 
                                prev.filter(m => m.modifierId !== modifier.id)
                              );
                            }
                          }}
                          className="mr-3"
                          disabled={!modifier.isAvailable}
                        />
                        <span className="flex-1 text-gray-900">
                          {modifier.name}
                          {modifier.price > 0 && (
                            <span className="text-gray-600"> (+${(modifier.price / 100).toFixed(2)})</span>
                          )}
                          {!modifier.isAvailable && (
                            <span className="text-red-500 ml-2">(Unavailable)</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* Notes */}
              <div className="mb-6">
                <label htmlFor="notes" className="block font-medium text-gray-900 mb-2">
                  Special Instructions (Optional)
                </label>
                <textarea
                  id="notes"
                  value={currentItemNotes}
                  onChange={(e) => setCurrentItemNotes(e.target.value)}
                  placeholder="Any special requests for this item?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  rows={3}
                />
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-between mb-6">
                <span className="font-medium text-gray-900">Quantity</span>
                <div className="flex items-center">
                  <button
                    onClick={() => setCurrentItemQuantity(Math.max(1, currentItemQuantity - 1))}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    -
                  </button>
                  <span className="mx-4 text-lg font-medium">{currentItemQuantity}</span>
                  <button
                    onClick={() => setCurrentItemQuantity(Math.min(10, currentItemQuantity + 1))}
                    className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Add to Cart Button */}
              <button
                onClick={confirmAddToCart}
                className="w-full px-4 py-3 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
              >
                Add to Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}