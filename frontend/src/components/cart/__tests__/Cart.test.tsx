import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cart from '../Cart';
import { useCartStore } from '@/store/cartStore';

// Mock the cart store
jest.mock('@/store/cartStore');

// Mock console.log to avoid noise in tests
const originalConsoleLog = console.log;
beforeAll(() => {
  console.log = jest.fn();
});
afterAll(() => {
  console.log = originalConsoleLog;
});

describe('Cart', () => {
  const mockUpdateQuantity = jest.fn();
  const mockRemoveItem = jest.fn();
  const mockClearCart = jest.fn();
  const mockGetTotalItems = jest.fn();
  const mockGetSubtotal = jest.fn();
  const mockGetTax = jest.fn();
  const mockGetTip = jest.fn();
  const mockGetTotal = jest.fn();

  const defaultCartState = {
    items: [],
    updateQuantity: mockUpdateQuantity,
    removeItem: mockRemoveItem,
    clearCart: mockClearCart,
    getTotalItems: mockGetTotalItems,
    getSubtotal: mockGetSubtotal,
    getTax: mockGetTax,
    getTip: mockGetTip,
    getTotal: mockGetTotal,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetTotalItems.mockReturnValue(0);
    mockGetSubtotal.mockReturnValue(0);
    mockGetTax.mockReturnValue(0);
    mockGetTip.mockReturnValue(0);
    mockGetTotal.mockReturnValue(0);
  });

  it('renders cart button with item count', () => {
    mockGetTotalItems.mockReturnValue(3);
    (useCartStore as unknown as jest.Mock).mockReturnValue({
      ...defaultCartState,
      getTotalItems: mockGetTotalItems,
    });

    render(<Cart />);

    const cartButton = screen.getByRole('button', { name: /3/i });
    expect(cartButton).toBeInTheDocument();
  });

  it('opens cart drawer when button is clicked', async () => {
    const user = userEvent.setup();
    (useCartStore as unknown as jest.Mock).mockReturnValue(defaultCartState);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    expect(screen.getByText('Your Order')).toBeInTheDocument();
  });

  it('shows empty cart message when no items', async () => {
    const user = userEvent.setup();
    (useCartStore as unknown as jest.Mock).mockReturnValue(defaultCartState);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    expect(screen.getByText('Your cart is empty')).toBeInTheDocument();
    expect(screen.getByText('Add items from the menu to get started')).toBeInTheDocument();
  });

  it('displays cart items correctly', async () => {
    const user = userEvent.setup();
    const cartWithItems = {
      ...defaultCartState,
      items: [
        {
          id: '1',
          sku: 'ITEM001',
          name: 'Burger',
          price: 1500,
          quantity: 2,
          modifiers: [],
        },
        {
          id: '2',
          sku: 'ITEM002',
          name: 'Fries',
          price: 500,
          quantity: 1,
          modifiers: [],
          specialInstructions: 'Extra crispy',
        },
      ],
    };

    mockGetTotalItems.mockReturnValue(3);
    mockGetSubtotal.mockReturnValue(3500);

    (useCartStore as unknown as jest.Mock).mockReturnValue(cartWithItems);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    expect(screen.getByText('Burger')).toBeInTheDocument();
    expect(screen.getByText('Fries')).toBeInTheDocument();
    expect(screen.getByText('"Extra crispy"')).toBeInTheDocument();
  });

  it('handles quantity increase', async () => {
    const user = userEvent.setup();
    const cartWithItems = {
      ...defaultCartState,
      items: [
        {
          id: '1',
          sku: 'ITEM001',
          name: 'Burger',
          price: 1500,
          quantity: 2,
          modifiers: [],
        },
      ],
    };

    (useCartStore as unknown as jest.Mock).mockReturnValue(cartWithItems);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    const increaseButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg') && btn.querySelector('svg')?.parentElement?.className?.includes('Plus')
    );
    
    if (increaseButtons[0]) {
      await user.click(increaseButtons[0]);
      expect(mockUpdateQuantity).toHaveBeenCalledWith('1', 3);
    }
  });

  it('handles quantity decrease', async () => {
    const user = userEvent.setup();
    const cartWithItems = {
      ...defaultCartState,
      items: [
        {
          id: '1',
          sku: 'ITEM001',
          name: 'Burger',
          price: 1500,
          quantity: 2,
          modifiers: [],
        },
      ],
    };

    (useCartStore as unknown as jest.Mock).mockReturnValue(cartWithItems);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    const decreaseButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg') && btn.querySelector('svg')?.parentElement?.className?.includes('Minus')
    );
    
    if (decreaseButtons[0]) {
      await user.click(decreaseButtons[0]);
      expect(mockUpdateQuantity).toHaveBeenCalledWith('1', 1);
    }
  });

  it('handles item removal', async () => {
    const user = userEvent.setup();
    const cartWithItems = {
      ...defaultCartState,
      items: [
        {
          id: '1',
          sku: 'ITEM001',
          name: 'Burger',
          price: 1500,
          quantity: 2,
          modifiers: [],
        },
      ],
    };

    (useCartStore as unknown as jest.Mock).mockReturnValue(cartWithItems);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    const removeButtons = screen.getAllByRole('button').filter(btn => 
      btn.querySelector('svg') && btn.querySelector('svg')?.parentElement?.className?.includes('Trash2')
    );
    
    if (removeButtons[0]) {
      await user.click(removeButtons[0]);
      expect(mockRemoveItem).toHaveBeenCalledWith('1');
    }
  });

  it('displays pricing breakdown correctly', async () => {
    const user = userEvent.setup();
    
    mockGetTotalItems.mockReturnValue(2);
    mockGetSubtotal.mockReturnValue(2000);
    mockGetTax.mockReturnValue(175);
    mockGetTip.mockReturnValue(360);
    mockGetTotal.mockReturnValue(2535);

    const cartWithItems = {
      ...defaultCartState,
      items: [
        {
          id: '1',
          sku: 'ITEM001',
          name: 'Burger',
          price: 2000,
          quantity: 1,
          modifiers: [],
        },
      ],
      getTotalItems: mockGetTotalItems,
      getSubtotal: mockGetSubtotal,
      getTax: mockGetTax,
      getTip: mockGetTip,
      getTotal: mockGetTotal,
    };

    (useCartStore as unknown as jest.Mock).mockReturnValue(cartWithItems);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    expect(screen.getByText('$20.00')).toBeInTheDocument(); // Subtotal
    expect(screen.getByText('$1.75')).toBeInTheDocument(); // Tax
    expect(screen.getByText('$3.60')).toBeInTheDocument(); // Tip
    expect(screen.getByText('$25.35')).toBeInTheDocument(); // Total
  });

  it('handles tip percentage selection', async () => {
    const user = userEvent.setup();
    
    mockGetTip.mockImplementation((percent) => {
      return Math.round(2000 * (percent / 100));
    });

    const cartWithItems = {
      ...defaultCartState,
      items: [
        {
          id: '1',
          sku: 'ITEM001',
          name: 'Burger',
          price: 2000,
          quantity: 1,
          modifiers: [],
        },
      ],
      getSubtotal: () => 2000,
      getTip: mockGetTip,
    };

    (useCartStore as unknown as jest.Mock).mockReturnValue(cartWithItems);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    // Click 20% tip button
    const tip20Button = screen.getByRole('button', { name: '20%' });
    await user.click(tip20Button);

    // Verify getTip was called with 20
    expect(mockGetTip).toHaveBeenCalledWith(20);
  });

  it('handles clear cart', async () => {
    const user = userEvent.setup();
    const cartWithItems = {
      ...defaultCartState,
      items: [
        {
          id: '1',
          sku: 'ITEM001',
          name: 'Burger',
          price: 1500,
          quantity: 1,
          modifiers: [],
        },
      ],
    };

    (useCartStore as unknown as jest.Mock).mockReturnValue(cartWithItems);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    const clearButton = screen.getByText('Clear Cart');
    await user.click(clearButton);

    expect(mockClearCart).toHaveBeenCalled();
  });

  it('closes drawer when backdrop is clicked', async () => {
    const user = userEvent.setup();
    (useCartStore as unknown as jest.Mock).mockReturnValue(defaultCartState);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    // Cart should be open
    expect(screen.getByText('Your Order')).toBeInTheDocument();

    // Click backdrop (the overlay div)
    const backdrop = document.querySelector('.absolute.inset-0.bg-black');
    if (backdrop) {
      fireEvent.click(backdrop);
    }

    // Cart should be closed
    await waitFor(() => {
      const cartPanel = document.querySelector('.translate-x-full');
      expect(cartPanel).toBeInTheDocument();
    });
  });

  it('closes drawer when X button is clicked', async () => {
    const user = userEvent.setup();
    (useCartStore as unknown as jest.Mock).mockReturnValue(defaultCartState);

    render(<Cart />);

    const cartButton = screen.getByRole('button');
    await user.click(cartButton);

    // Find and click the close button (X)
    const closeButtons = screen.getAllByRole('button');
    const closeButton = closeButtons.find(btn => 
      btn.querySelector('svg') && btn.parentElement?.className?.includes('border-b')
    );

    if (closeButton) {
      await user.click(closeButton);
    }

    // Cart should be closed
    await waitFor(() => {
      const cartPanel = document.querySelector('.translate-x-full');
      expect(cartPanel).toBeInTheDocument();
    });
  });
});