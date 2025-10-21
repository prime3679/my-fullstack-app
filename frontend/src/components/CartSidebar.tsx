'use client';

import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  restaurantId: string;
  restaurantName: string;
}

export default function CartSidebar({
  isOpen,
  onClose,
  restaurantId,
  restaurantName,
}: CartSidebarProps) {
  const router = useRouter();
  const { items, updateQuantity, removeItem, totalItems, totalPrice, clearCart } =
    useCart();

  const handleCheckout = () => {
    if (items.length === 0) return;
    // Navigate to checkout page
    router.push(`/checkout/${restaurantId}`);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      ></div>

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Your Cart</h2>
            <p className="text-sm text-blue-100">{restaurantName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-100 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🛒</div>
              <p className="text-gray-500 text-lg">Your cart is empty</p>
              <p className="text-gray-400 text-sm mt-2">
                Add items from the menu to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={`${item.menuItemId}-${JSON.stringify(item.modifiers)}`}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      {item.course && (
                        <span className="text-xs text-gray-500">{item.course}</span>
                      )}
                    </div>
                    <button
                      onClick={() => removeItem(item.menuItemId)}
                      className="text-red-500 hover:text-red-700 ml-2"
                    >
                      🗑️
                    </button>
                  </div>

                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="text-sm text-gray-600 mb-2">
                      {item.modifiers.join(', ')}
                    </div>
                  )}

                  {item.specialInstructions && (
                    <div className="text-sm text-gray-600 italic mb-2">
                      Note: {item.specialInstructions}
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.menuItemId, item.quantity - 1)
                        }
                        className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center font-bold"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.menuItemId, item.quantity + 1)
                        }
                        className="w-8 h-8 bg-gray-200 rounded hover:bg-gray-300 flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-bold text-gray-900">
                      ${((item.price * item.quantity) / 100).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-gray-200 p-4 bg-white">
            <div className="flex justify-between items-center mb-4">
              <span className="text-lg font-semibold text-gray-900">Total</span>
              <span className="text-2xl font-bold text-green-600">
                ${(totalPrice / 100).toFixed(2)}
              </span>
            </div>

            <div className="text-sm text-gray-600 mb-4">
              {totalItems} item{totalItems !== 1 ? 's' : ''} in cart
            </div>

            <button
              onClick={handleCheckout}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium mb-2"
            >
              Proceed to Checkout
            </button>

            <button
              onClick={clearCart}
              className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg hover:bg-gray-200 font-medium"
            >
              Clear Cart
            </button>
          </div>
        )}
      </div>
    </>
  );
}
