import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MenuItem from '../MenuItem';
import { useCartStore } from '@/store/cartStore';

// Mock the cart store
jest.mock('@/store/cartStore');

describe('MenuItem', () => {
  const mockAddItem = jest.fn();
  const mockSetRestaurant = jest.fn();

  const defaultItem = {
    id: '1',
    sku: 'ITEM001',
    name: 'Test Item',
    description: 'A delicious test item',
    price: 1500,
    imageUrl: 'https://example.com/image.jpg',
    allergens: ['Nuts', 'Dairy'],
    dietaryTags: ['Vegetarian'],
    calories: 450,
    is86: false,
    isAvailable: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useCartStore as unknown as jest.Mock).mockReturnValue({
      addItem: mockAddItem,
      setRestaurant: mockSetRestaurant,
    });
  });

  it('renders item information correctly', () => {
    render(<MenuItem item={defaultItem} restaurantId="restaurant-1" />);

    expect(screen.getByText('Test Item')).toBeInTheDocument();
    expect(screen.getByText('A delicious test item')).toBeInTheDocument();
    expect(screen.getByText('$15.00')).toBeInTheDocument();
    expect(screen.getByText('Vegetarian')).toBeInTheDocument();
    expect(screen.getByText('450 cal')).toBeInTheDocument();
  });

  it('displays image when provided', () => {
    render(<MenuItem item={defaultItem} restaurantId="restaurant-1" />);

    const image = screen.getByAltText('Test Item');
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg');
  });

  it('shows allergen info when button is clicked', async () => {
    const user = userEvent.setup();
    render(<MenuItem item={defaultItem} restaurantId="restaurant-1" />);

    const allergenButton = screen.getByText('Allergen info');
    await user.click(allergenButton);

    expect(screen.getByText('Contains:')).toBeInTheDocument();
    expect(screen.getByText('Nuts, Dairy')).toBeInTheDocument();
  });

  it('handles quantity increase and decrease', async () => {
    const user = userEvent.setup();
    render(<MenuItem item={defaultItem} restaurantId="restaurant-1" />);

    const increaseButton = screen.getAllByRole('button')[1]; // Plus button
    const decreaseButton = screen.getAllByRole('button')[0]; // Minus button

    // Initially quantity is 1
    expect(screen.getByText('1')).toBeInTheDocument();

    // Increase quantity
    await user.click(increaseButton);
    expect(screen.getByText('2')).toBeInTheDocument();

    // Decrease quantity
    await user.click(decreaseButton);
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('prevents quantity from going below 1', async () => {
    const user = userEvent.setup();
    render(<MenuItem item={defaultItem} restaurantId="restaurant-1" />);

    const decreaseButton = screen.getAllByRole('button')[0]; // Minus button
    
    // Try to decrease below 1
    await user.click(decreaseButton);
    
    // Quantity should still be 1
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('adds item to cart when Add to Cart is clicked', async () => {
    const user = userEvent.setup();
    render(<MenuItem item={defaultItem} restaurantId="restaurant-1" />);

    const addButton = screen.getByText('Add to Cart');
    await user.click(addButton);

    expect(mockSetRestaurant).toHaveBeenCalledWith('restaurant-1');
    expect(mockAddItem).toHaveBeenCalledWith({
      sku: 'ITEM001',
      name: 'Test Item',
      description: 'A delicious test item',
      price: 1500,
      quantity: 1,
      modifiers: [],
      imageUrl: 'https://example.com/image.jpg',
    });
  });

  it('adds multiple items when quantity is increased', async () => {
    const user = userEvent.setup();
    render(<MenuItem item={defaultItem} restaurantId="restaurant-1" />);

    const increaseButton = screen.getAllByRole('button')[1]; // Plus button
    const addButton = screen.getByText('Add to Cart');

    // Increase quantity to 3
    await user.click(increaseButton);
    await user.click(increaseButton);

    // Add to cart
    await user.click(addButton);

    // Should be called 3 times
    expect(mockAddItem).toHaveBeenCalledTimes(3);
  });

  it('shows Out of Stock overlay when item is 86ed', () => {
    const unavailableItem = { ...defaultItem, is86: true };
    render(<MenuItem item={unavailableItem} restaurantId="restaurant-1" />);

    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
    expect(screen.queryByText('Add to Cart')).not.toBeInTheDocument();
  });

  it('shows Currently Unavailable when item is not available', () => {
    const unavailableItem = { ...defaultItem, isAvailable: false };
    render(<MenuItem item={unavailableItem} restaurantId="restaurant-1" />);

    expect(screen.getByText('Currently Unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Add to Cart')).not.toBeInTheDocument();
  });

  it('applies opacity when item is unavailable', () => {
    const unavailableItem = { ...defaultItem, is86: true };
    const { container } = render(<MenuItem item={unavailableItem} restaurantId="restaurant-1" />);

    const card = container.firstChild;
    expect(card).toHaveClass('opacity-60');
  });

  it('formats price correctly', () => {
    const itemWithDifferentPrice = { ...defaultItem, price: 999 };
    render(<MenuItem item={itemWithDifferentPrice} restaurantId="restaurant-1" />);

    expect(screen.getByText('$9.99')).toBeInTheDocument();
  });

  it('handles items without optional fields', () => {
    const minimalItem = {
      id: '2',
      sku: 'ITEM002',
      name: 'Minimal Item',
      price: 1000,
    };

    render(<MenuItem item={minimalItem} restaurantId="restaurant-1" />);

    expect(screen.getByText('Minimal Item')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.queryByText('Allergen info')).not.toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('resets quantity after adding to cart', async () => {
    const user = userEvent.setup();
    render(<MenuItem item={defaultItem} restaurantId="restaurant-1" />);

    const increaseButton = screen.getAllByRole('button')[1];
    const addButton = screen.getByText('Add to Cart');

    // Increase quantity to 2
    await user.click(increaseButton);
    expect(screen.getByText('2')).toBeInTheDocument();

    // Add to cart
    await user.click(addButton);

    // Quantity should reset to 1
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});