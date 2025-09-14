import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter, useSearchParams } from 'next/navigation';
import CheckoutPage from './page';
import { useCartStore } from '@/store/cartStore';
import { loadStripe } from '@stripe/stripe-js';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

// Mock cart store
jest.mock('@/store/cartStore');

// Mock Stripe
jest.mock('@stripe/stripe-js', () => ({
  loadStripe: jest.fn(),
}));

jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: any) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element">Payment Element</div>,
  useStripe: () => ({
    confirmPayment: jest.fn(),
  }),
  useElements: () => ({}),
}));

// Mock fetch
global.fetch = jest.fn();

describe('CheckoutPage', () => {
  const mockRouter = {
    push: jest.fn(),
    back: jest.fn(),
  };

  const mockSearchParams = {
    get: jest.fn(),
  };

  const mockCartStore = {
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
      },
    ],
    restaurantId: 'rest_123',
    getSubtotal: jest.fn(() => 3500),
    getTax: jest.fn(() => 306),
    getTotal: jest.fn(() => 4436),
    clearCart: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    (useCartStore as unknown as jest.Mock).mockReturnValue(mockCartStore);
    (loadStripe as jest.Mock).mockResolvedValue({});
  });

  it('should redirect to home if cart is empty', () => {
    (useCartStore as unknown as jest.Mock).mockReturnValue({
      ...mockCartStore,
      items: [],
    });

    render(<CheckoutPage />);

    expect(mockRouter.push).toHaveBeenCalledWith('/');
  });

  it('should create payment intent on mount', async () => {
    const mockPaymentIntent = {
      success: true,
      data: {
        clientSecret: 'pi_test_secret',
        paymentIntentId: 'pi_test123',
        amount: 4436,
        breakdown: {
          subtotal: 3500,
          tax: 306,
          tip: 630,
          total: 4436,
        },
      },
    };

    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockPaymentIntent,
    });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/payments/create-payment-intent'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('tipPercent'),
        })
      );
    });
  });

  it('should display order items', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          clientSecret: 'pi_test_secret',
        },
      }),
    });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText('Order Items (2)')).toBeInTheDocument();
      expect(screen.getByText('2x')).toBeInTheDocument();
      expect(screen.getByText('Burger')).toBeInTheDocument();
      expect(screen.getByText('1x')).toBeInTheDocument();
      expect(screen.getByText('Fries')).toBeInTheDocument();
    });
  });

  it('should handle tip selection', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          clientSecret: 'pi_test_secret',
        },
      }),
    });

    render(<CheckoutPage />);

    await waitFor(() => {
      const tip20Button = screen.getByRole('button', { name: '20%' });
      expect(tip20Button).toBeInTheDocument();
    });

    const tip20Button = screen.getByRole('button', { name: '20%' });
    fireEvent.click(tip20Button);

    // Check that 20% tip button is selected
    expect(tip20Button).toHaveClass('bg-blue-600');
  });

  it('should display error when payment intent creation fails', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
    });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to create payment intent')).toBeInTheDocument();
    });
  });

  it('should navigate back when back button is clicked', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          clientSecret: 'pi_test_secret',
        },
      }),
    });

    render(<CheckoutPage />);

    await waitFor(() => {
      const backButton = screen.getByText('Back to menu');
      expect(backButton).toBeInTheDocument();
    });

    const backButton = screen.getByText('Back to menu');
    fireEvent.click(backButton);

    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('should display payment breakdown correctly', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          clientSecret: 'pi_test_secret',
          breakdown: {
            subtotal: 3500,
            tax: 306,
            tip: 630,
            total: 4436,
          },
        },
      }),
    });

    render(<CheckoutPage />);

    await waitFor(() => {
      expect(screen.getByText('$35.00')).toBeInTheDocument(); // Subtotal
      expect(screen.getByText('$3.06')).toBeInTheDocument(); // Tax
    });
  });
});