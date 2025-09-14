import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RestaurantCard from '../RestaurantCard'

const mockRestaurant = {
  id: 1,
  name: 'Test Restaurant',
  slug: 'test-restaurant',
  description: 'A great place to eat',
  primaryCuisine: 'Italian',
  rating: 4.5,
  image: '/test-image.jpg',
  priceRange: '$$',
  location: 'Downtown',
}

describe('RestaurantCard', () => {
  it('renders restaurant information correctly', () => {
    render(<RestaurantCard restaurant={mockRestaurant} />)
    
    expect(screen.getByText('Test Restaurant')).toBeInTheDocument()
    expect(screen.getByText('A great place to eat')).toBeInTheDocument()
    expect(screen.getByText('Italian')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('$$')).toBeInTheDocument()
  })

  it('displays restaurant image with correct alt text', () => {
    render(<RestaurantCard restaurant={mockRestaurant} />)
    
    const image = screen.getByRole('img', { name: 'Test Restaurant' })
    expect(image).toHaveAttribute('src', expect.stringContaining('test-image.jpg'))
  })

  it('links to restaurant detail page', () => {
    render(<RestaurantCard restaurant={mockRestaurant} />)
    
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/restaurants/test-restaurant')
  })

  it('handles missing optional fields gracefully', () => {
    const minimalRestaurant = {
      id: 2,
      name: 'Minimal Restaurant',
      slug: 'minimal',
    }
    
    render(<RestaurantCard restaurant={minimalRestaurant} />)
    
    expect(screen.getByText('Minimal Restaurant')).toBeInTheDocument()
    expect(screen.queryByText('$$')).not.toBeInTheDocument()
  })

  it('applies hover effect on mouse enter', async () => {
    const user = userEvent.setup()
    render(<RestaurantCard restaurant={mockRestaurant} />)
    
    const card = screen.getByTestId('restaurant-card')
    
    await user.hover(card)
    expect(card).toHaveClass('hover:shadow-lg')
  })
})