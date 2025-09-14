import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ReservationForm from '../ReservationForm'

const mockOnSubmit = jest.fn()

describe('ReservationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders all form fields', () => {
    render(<ReservationForm onSubmit={mockOnSubmit} restaurantId={1} />)
    
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/party size/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/special requests/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reserve/i })).toBeInTheDocument()
  })

  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    render(<ReservationForm onSubmit={mockOnSubmit} restaurantId={1} />)
    
    const dateInput = screen.getByLabelText(/date/i)
    const timeInput = screen.getByLabelText(/time/i)
    const partySizeInput = screen.getByLabelText(/party size/i)
    const notesInput = screen.getByLabelText(/special requests/i)
    
    await user.type(dateInput, '2024-12-25')
    await user.selectOptions(timeInput, '19:00')
    await user.selectOptions(partySizeInput, '4')
    await user.type(notesInput, 'Window seat please')
    
    await user.click(screen.getByRole('button', { name: /reserve/i }))
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        date: '2024-12-25',
        time: '19:00',
        partySize: 4,
        notes: 'Window seat please',
        restaurantId: 1,
      })
    })
  })

  it('validates required fields', async () => {
    const user = userEvent.setup()
    render(<ReservationForm onSubmit={mockOnSubmit} restaurantId={1} />)
    
    await user.click(screen.getByRole('button', { name: /reserve/i }))
    
    expect(await screen.findByText(/date is required/i)).toBeInTheDocument()
    expect(await screen.findByText(/time is required/i)).toBeInTheDocument()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('validates party size range', async () => {
    const user = userEvent.setup()
    render(<ReservationForm onSubmit={mockOnSubmit} restaurantId={1} />)
    
    const partySizeInput = screen.getByLabelText(/party size/i)
    
    await user.clear(partySizeInput)
    await user.type(partySizeInput, '0')
    await user.click(screen.getByRole('button', { name: /reserve/i }))
    
    expect(await screen.findByText(/party size must be at least 1/i)).toBeInTheDocument()
    
    await user.clear(partySizeInput)
    await user.type(partySizeInput, '21')
    await user.click(screen.getByRole('button', { name: /reserve/i }))
    
    expect(await screen.findByText(/party size cannot exceed 20/i)).toBeInTheDocument()
  })

  it('disables past dates', () => {
    render(<ReservationForm onSubmit={mockOnSubmit} restaurantId={1} />)
    
    const dateInput = screen.getByLabelText(/date/i) as HTMLInputElement
    const today = new Date().toISOString().split('T')[0]
    
    expect(dateInput).toHaveAttribute('min', today)
  })

  it('shows loading state during submission', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
    
    render(<ReservationForm onSubmit={mockOnSubmit} restaurantId={1} />)
    
    await user.type(screen.getByLabelText(/date/i), '2024-12-25')
    await user.selectOptions(screen.getByLabelText(/time/i), '19:00')
    await user.click(screen.getByRole('button', { name: /reserve/i }))
    
    expect(screen.getByRole('button', { name: /reserving/i })).toBeDisabled()
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reserve/i })).not.toBeDisabled()
    })
  })

  it('displays available time slots', async () => {
    render(<ReservationForm onSubmit={mockOnSubmit} restaurantId={1} />)
    
    const timeSelect = screen.getByLabelText(/time/i)
    const options = timeSelect.querySelectorAll('option')
    
    expect(options.length).toBeGreaterThan(1)
    expect(options[1]).toHaveTextContent('11:00 AM')
    expect(options[options.length - 1]).toHaveTextContent('10:00 PM')
  })

  it('handles API errors gracefully', async () => {
    const user = userEvent.setup()
    mockOnSubmit.mockRejectedValue(new Error('Reservation failed'))
    
    render(<ReservationForm onSubmit={mockOnSubmit} restaurantId={1} />)
    
    await user.type(screen.getByLabelText(/date/i), '2024-12-25')
    await user.selectOptions(screen.getByLabelText(/time/i), '19:00')
    await user.click(screen.getByRole('button', { name: /reserve/i }))
    
    expect(await screen.findByText(/reservation failed/i)).toBeInTheDocument()
  })
})