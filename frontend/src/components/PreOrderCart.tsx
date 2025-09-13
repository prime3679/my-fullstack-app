'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  ShoppingCart, 
  Minus, 
  Plus, 
  Trash2, 
  Clock, 
  CreditCard,
  CheckCircle,
  AlertCircle 
} from 'lucide-react';
import type { PreOrderCalculation, CreatePreOrderRequest } from '../../shared/types';

interface CartItem {
  sku: string;
  name: string;
  quantity: number;
  basePrice: number;
  modifiers: Array<{
    modifierGroupId: string;
    modifierId: string;
    name: string;
    price: number;
  }>;
  notes?: string;
  totalPrice: number;
}

interface PreOrderCartProps {
  cart: CartItem[];
  onUpdateCart: (cart: CartItem[]) => void;
  restaurantId: string;
  reservationId?: string;
  restaurantName: string;
  onOrderComplete?: (preOrderId: string) => void;
}

export default function PreOrderCart({ 
  cart, 
  onUpdateCart, 
  restaurantId, 
  reservationId, 
  restaurantName,
  onOrderComplete 
}: PreOrderCartProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [calculation, setCalculation] = useState<PreOrderCalculation | null>(null);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [guestInfo, setGuestInfo] = useState({
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (cart.length > 0 && isOpen) {
      calculatePreOrder();
    }
  }, [cart, isOpen]);

  const calculatePreOrder = async () => {
    if (!cart.length) return;

    setLoading(true);
    try {
      const items = cart.map(item => ({
        sku: item.sku,
        quantity: item.quantity,
        modifiers: item.modifiers.map(mod => ({
          modifierGroupId: mod.modifierGroupId,
          modifierId: mod.modifierId
        }))
      }));

      const response = await api.calculatePreOrder(restaurantId, items);
      setCalculation(response.data);
    } catch (error) {
      console.error('Failed to calculate pre-order:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }

    const updatedCart = [...cart];
    const item = updatedCart[index];
    const unitPrice = item.basePrice + item.modifiers.reduce((sum, mod) => sum + mod.price, 0);
    
    updatedCart[index] = {
      ...item,
      quantity,
      totalPrice: unitPrice * quantity
    };

    onUpdateCart(updatedCart);
  };

  const removeItem = (index: number) => {
    onUpdateCart(cart.filter((_, i) => i !== index));
  };

  const placeOrder = async () => {
    if (!reservationId) {
      alert('Reservation ID is required to place order');
      return;
    }

    setPlacing(true);
    try {
      const orderData: CreatePreOrderRequest = {
        reservationId,
        items: cart.map(item => ({
          sku: item.sku,
          quantity: item.quantity,
          modifiers: item.modifiers.map(mod => ({
            modifierGroupId: mod.modifierGroupId,
            modifierId: mod.modifierId
          })),
          notes: item.notes
        }))
      };

      const response = await api.createPreOrder(orderData);
      
      if (response.success && onOrderComplete) {
        onOrderComplete(response.data.id);
        onUpdateCart([]); // Clear cart
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Failed to place order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setPlacing(false);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  if (cart.length === 0) {
    return null;
  }

  return (
    <>
      {/* Floating Cart Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(true)}
          size="lg"
          className="relative shadow-lg"
        >
          <ShoppingCart className="h-5 w-5 mr-2" />
          {cart.length} items - ${(cartTotal / 100).toFixed(2)}
          {cart.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {cart.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Cart Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Your Pre-Order from {restaurantName}
            </DialogTitle>
            <DialogDescription>
              Review your items and complete your pre-order
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Cart Items */}
            <div className="space-y-4">
              {cart.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold">{item.name}</h3>
                      
                      {/* Modifiers */}
                      {item.modifiers.length > 0 && (
                        <div className="mt-1 text-sm text-gray-600">
                          {item.modifiers.map(mod => (
                            <div key={`${mod.modifierGroupId}-${mod.modifierId}`}>
                              • {mod.name} 
                              {mod.price > 0 && ` (+$${(mod.price / 100).toFixed(2)})`}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Notes */}
                      {item.notes && (
                        <div className="mt-1 text-sm text-gray-500 italic">
                          Note: {item.notes}
                        </div>
                      )}

                      {/* Unit Price */}
                      <div className="mt-2 text-sm text-gray-600">
                        ${((item.basePrice + item.modifiers.reduce((sum, mod) => sum + mod.price, 0)) / 100).toFixed(2)} each
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {/* Quantity Controls */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(index, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(index, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>

                      {/* Remove Item */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeItem(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>

                      {/* Item Total */}
                      <div className="w-20 text-right font-medium">
                        ${(item.totalPrice / 100).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Order Summary */}
            {calculation && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>${(calculation.subtotal / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>${(calculation.tax / 100).toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span>${(calculation.total / 100).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Guest Information */}
            {!reservationId && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contact Information</CardTitle>
                  <CardDescription>
                    We'll use this information to confirm your order
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="guest-name">Name *</Label>
                    <Input
                      id="guest-name"
                      value={guestInfo.name}
                      onChange={(e) => setGuestInfo(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="guest-email">Email *</Label>
                    <Input
                      id="guest-email"
                      type="email"
                      value={guestInfo.email}
                      onChange={(e) => setGuestInfo(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="your@email.com"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="guest-phone">Phone</Label>
                    <Input
                      id="guest-phone"
                      type="tel"
                      value={guestInfo.phone}
                      onChange={(e) => setGuestInfo(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Order Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setIsOpen(false)}
                className="flex-1"
              >
                Continue Shopping
              </Button>
              
              {reservationId ? (
                <Button
                  onClick={placeOrder}
                  disabled={placing || loading || cart.length === 0}
                  className="flex-1"
                >
                  {placing ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Placing Order...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Place Pre-Order
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  disabled={!guestInfo.name || !guestInfo.email}
                  className="flex-1"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Continue to Payment
                </Button>
              )}
            </div>

            {/* Info Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-1">Pre-Order Benefits</div>
                  <ul className="space-y-1 text-xs">
                    <li>• Your food will be timed to arrive shortly after you're seated</li>
                    <li>• Skip the wait and enjoy faster service</li>
                    <li>• Make modifications up until 30 minutes before your reservation</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}