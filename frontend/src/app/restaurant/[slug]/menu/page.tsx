'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectItem
} from '@/components/ui/select';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Minus, Plus, Search, Clock, AlertTriangle } from 'lucide-react';
import PreOrderCart from '@/components/PreOrderCart';
import type { MenuResponse, MenuItem, Restaurant } from '../../../../../../shared/types';

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

export default function MenuPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const reservationId = searchParams.get('reservationId');

  const [menu, setMenu] = useState<MenuResponse | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDietary, setSelectedDietary] = useState<string>('');
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [itemModifiers, setItemModifiers] = useState<Record<string, string>>({});
  const [itemNotes, setItemNotes] = useState('');
  const [itemQuantity, setItemQuantity] = useState(1);

  const loadRestaurantAndMenu = useCallback(async () => {
    try {
      const [restaurantRes, menuRes] = await Promise.all([
        api.getRestaurant(slug),
        api.getRestaurant(slug).then(res => {
          if (!res.data) {
            throw new Error('Restaurant not found');
          }
          return api.getRestaurantMenu(res.data.id);
        })
      ]);

      setRestaurant(restaurantRes.data || null);
      setMenu(menuRes.data || null);
    } catch (error) {
      console.error('Failed to load restaurant and menu:', error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadRestaurantAndMenu();
  }, [loadRestaurantAndMenu]);

  const addToCart = (item: MenuItem) => {
    const modifiers = Object.entries(itemModifiers).map(([groupId, modifierId]) => {
      const group = item.modifierGroups.find(g => g.id === groupId);
      const modifier = group?.modifiers.find(m => m.id === modifierId);
      return {
        modifierGroupId: groupId,
        modifierId,
        name: modifier?.name || '',
        price: modifier?.price || 0
      };
    });

    const modifierPrice = modifiers.reduce((sum, mod) => sum + mod.price, 0);
    const totalPrice = (item.price + modifierPrice) * itemQuantity;

    const cartItem: CartItem = {
      sku: item.sku,
      name: item.name,
      quantity: itemQuantity,
      basePrice: item.price,
      modifiers,
      notes: itemNotes || undefined,
      totalPrice
    };

    setCart(prev => {
      const existingIndex = prev.findIndex(
        cartItem => 
          cartItem.sku === item.sku && 
          JSON.stringify(cartItem.modifiers) === JSON.stringify(modifiers) &&
          cartItem.notes === itemNotes
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex].quantity += itemQuantity;
        updated[existingIndex].totalPrice += totalPrice;
        return updated;
      } else {
        return [...prev, cartItem];
      }
    });

    // Reset modal state
    setSelectedItem(null);
    setItemModifiers({});
    setItemNotes('');
    setItemQuantity(1);
  };

  const handleOrderComplete = (preOrderId: string) => {
    console.log('Pre-order created:', preOrderId);
    // Redirect to payment page
    window.location.href = `/restaurant/${slug}/preorder/${preOrderId}/payment`;
  };

  const filteredItems = menu?.categories.flatMap(category => 
    category.items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDietary = !selectedDietary || 
        item.dietaryTags.includes(selectedDietary);

      return matchesSearch && matchesDietary && item.isAvailable && !item.is86;
    })
  ) || [];

  const openItemModal = (item: MenuItem) => {
    setSelectedItem(item);
    setItemModifiers({});
    setItemNotes('');
    setItemQuantity(1);
  };

  const handleModifierChange = (groupId: string, modifierId: string) => {
    setItemModifiers(prev => ({
      ...prev,
      [groupId]: modifierId
    }));
  };

  const canAddToCart = () => {
    if (!selectedItem) return false;

    // Check required modifier groups
    const requiredGroups = selectedItem.modifierGroups.filter(group => group.isRequired);
    return requiredGroups.every(group => itemModifiers[group.id]);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant || !menu) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Menu not found</h1>
        <p className="text-gray-600">Unable to load the menu for this restaurant.</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {restaurant.name} Menu
            </h1>
            <p className="text-gray-600">
              Choose your items for pre-order
            </p>
          </div>
          
        </div>

        {/* Search and Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <Select 
            value={selectedDietary} 
            onChange={(e) => setSelectedDietary(e.target.value)}
            className="w-48"
          >
            <SelectItem value="">All items</SelectItem>
            <SelectItem value="vegetarian">Vegetarian</SelectItem>
            <SelectItem value="vegan">Vegan</SelectItem>
            <SelectItem value="gluten-free">Gluten-free</SelectItem>
            <SelectItem value="dairy-free">Dairy-free</SelectItem>
            <SelectItem value="keto">Keto</SelectItem>
          </Select>
        </div>
      </div>

      {/* Menu Content */}
      {searchQuery || selectedDietary ? (
        // Search Results View
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Search Results ({filteredItems.length} items)
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map(item => (
              <MenuItemCard 
                key={item.id} 
                item={item} 
                onAddToCart={() => openItemModal(item)} 
              />
            ))}
          </div>
        </div>
      ) : (
        // Category Tabs View
        <Tabs defaultValue={menu.categories[0]?.id} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            {menu.categories.map(category => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {menu.categories.map(category => (
            <TabsContent key={category.id} value={category.id}>
              <div className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold">{category.name}</h2>
                  {category.description && (
                    <p className="text-gray-600 mt-1">{category.description}</p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {category.items
                    .filter(item => item.isAvailable && !item.is86)
                    .map(item => (
                      <MenuItemCard 
                        key={item.id} 
                        item={item} 
                        onAddToCart={() => openItemModal(item)} 
                      />
                    ))}
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      {/* Item Detail Modal */}
      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedItem.name}</DialogTitle>
                <DialogDescription>
                  {selectedItem.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Price and prep time */}
                <div className="flex justify-between items-center">
                  <div className="text-2xl font-bold">
                    ${(selectedItem.price / 100).toFixed(2)}
                  </div>
                  {selectedItem.prepTimeMinutes && (
                    <div className="flex items-center text-gray-500">
                      <Clock className="h-4 w-4 mr-1" />
                      {selectedItem.prepTimeMinutes} min
                    </div>
                  )}
                </div>

                {/* Dietary tags and allergens */}
                <div className="space-y-2">
                  {selectedItem.dietaryTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selectedItem.dietaryTags.map(tag => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {selectedItem.allergensJson && selectedItem.allergensJson.length > 0 && (
                    <div className="flex items-center gap-2 text-amber-600 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      Contains: {selectedItem.allergensJson.join(', ')}
                    </div>
                  )}
                </div>

                {/* Modifier Groups */}
                {selectedItem.modifierGroups.map(group => (
                  <div key={group.id} className="space-y-3">
                    <div>
                      <h4 className="font-semibold">
                        {group.name} 
                        {group.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </h4>
                      {group.description && (
                        <p className="text-sm text-gray-600">{group.description}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {group.modifiers
                        .filter(mod => mod.isAvailable)
                        .map(modifier => (
                          <label key={modifier.id} className="flex items-center space-x-3 cursor-pointer">
                            <input
                              type="radio"
                              name={group.id}
                              value={modifier.id}
                              checked={itemModifiers[group.id] === modifier.id}
                              onChange={() => handleModifierChange(group.id, modifier.id)}
                              className="text-blue-600"
                            />
                            <div className="flex-1 flex justify-between">
                              <span>{modifier.name}</span>
                              {modifier.price > 0 && (
                                <span className="text-gray-500">
                                  +${(modifier.price / 100).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </label>
                        ))}
                    </div>
                  </div>
                ))}

                {/* Special instructions */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium">
                    Special instructions (optional)
                  </label>
                  <Textarea
                    value={itemNotes}
                    onChange={(e) => setItemNotes(e.target.value)}
                    placeholder="Any special requests or modifications..."
                    rows={3}
                  />
                </div>

                {/* Quantity and Add to Cart */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center space-x-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-lg font-medium w-8 text-center">{itemQuantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setItemQuantity(Math.min(10, itemQuantity + 1))}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button
                    onClick={() => addToCart(selectedItem)}
                    disabled={!canAddToCart()}
                    size="lg"
                  >
                    Add to Cart - ${(((selectedItem.price + 
                      Object.entries(itemModifiers).reduce((sum, [groupId, modifierId]) => {
                        const group = selectedItem.modifierGroups.find(g => g.id === groupId);
                        const modifier = group?.modifiers.find(m => m.id === modifierId);
                        return sum + (modifier?.price || 0);
                      }, 0)) * itemQuantity) / 100).toFixed(2)}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Pre-Order Cart */}
      {restaurant && (
        <PreOrderCart
          cart={cart}
          onUpdateCart={setCart}
          restaurantId={restaurant.id}
          reservationId={reservationId || undefined}
          restaurantName={restaurant.name}
          onOrderComplete={handleOrderComplete}
        />
      )}
    </div>
  );
}

function MenuItemCard({ item, onAddToCart }: { item: MenuItem; onAddToCart: () => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Item header */}
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{item.name}</h3>
              {item.description && (
                <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                  {item.description}
                </p>
              )}
            </div>
            {item.imageUrl && (
              <Image 
                src={item.imageUrl} 
                alt={item.name}
                width={64}
                height={64}
                className="w-16 h-16 object-cover rounded-md ml-4"
              />
            )}
          </div>

          {/* Tags and allergens */}
          <div className="space-y-2">
            {item.dietaryTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item.dietaryTags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {item.dietaryTags.length > 3 && (
                  <Badge variant="secondary" className="text-xs">
                    +{item.dietaryTags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {item.allergensJson && item.allergensJson.length > 0 && (
              <div className="flex items-center text-amber-600 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Contains allergens
              </div>
            )}
          </div>

          {/* Price and action */}
          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">
                ${(item.price / 100).toFixed(2)}
              </span>
              {item.prepTimeMinutes && (
                <div className="flex items-center text-gray-500 text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {item.prepTimeMinutes}m
                </div>
              )}
            </div>
            <Button onClick={onAddToCart}>
              Add to Cart
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
