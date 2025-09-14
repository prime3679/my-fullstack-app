# La Carta API Documentation

## Base URL
- Development: `http://localhost:3001/api/v1`
- Production: `https://api.lacarta.app/api/v1`

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Available Endpoints

### Health Check
- `GET /api/health` - Server health status with database connectivity

### Authentication (`/auth`)
- `POST /auth/signup` - Create new user account
- `POST /auth/signin` - Sign in with email/phone and password
- `POST /auth/quick-signup` - Quick signup with phone only
- `POST /auth/verify-phone` - Verify phone number with SMS code
- `GET /auth/google` - Google OAuth login
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/apple` - Apple OAuth login
- `POST /auth/apple/callback` - Apple OAuth callback
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user profile
- `PATCH /auth/profile` - Update user profile
- `POST /auth/refresh` - Refresh JWT token

### Staff Management (`/staff`)
- `GET /staff` - List all staff members for a restaurant
- `POST /staff/invite` - Invite new staff member
- `PATCH /staff/:userId/role` - Update staff member role
- `DELETE /staff/:userId` - Remove staff member
- `GET /staff/permissions` - Get role permissions

### Restaurants (`/restaurants`)
- `GET /restaurants` - List all restaurants
- `GET /restaurants/:id` - Get restaurant details
- `POST /restaurants` - Create new restaurant (admin only)
- `PATCH /restaurants/:id` - Update restaurant details
- `DELETE /restaurants/:id` - Delete restaurant (admin only)
- `GET /restaurants/:id/locations` - Get restaurant locations
- `POST /restaurants/:id/locations` - Add new location
- `GET /restaurants/:id/tables` - Get restaurant tables
- `GET /restaurants/:id/availability` - Check availability for date/time

### Reservations (`/reservations`)
- `GET /reservations` - List user's reservations
- `GET /reservations/:id` - Get reservation details
- `POST /reservations` - Create new reservation
- `PATCH /reservations/:id` - Update reservation
- `DELETE /reservations/:id` - Cancel reservation
- `POST /reservations/:id/checkin` - Check in for reservation
- `GET /reservations/upcoming` - Get upcoming reservations
- `GET /reservations/history` - Get reservation history

### Menu Management (`/menu`)
- `GET /menu` - Get full menu for restaurant
- `GET /menu/categories` - Get menu categories
- `GET /menu/items/:id` - Get menu item details
- `POST /menu/items` - Add menu item (staff only)
- `PATCH /menu/items/:id` - Update menu item (staff only)
- `DELETE /menu/items/:id` - Remove menu item (staff only)
- `POST /menu/categories` - Add menu category (staff only)
- `GET /menu/search` - Search menu items

### Pre-Orders (`/preorders`)
- `GET /preorders/:id` - Get pre-order details
- `POST /preorders` - Create pre-order for reservation
- `PATCH /preorders/:id` - Update pre-order
- `POST /preorders/:id/items` - Add items to pre-order
- `DELETE /preorders/:id/items/:itemId` - Remove item from pre-order
- `POST /preorders/:id/submit` - Submit pre-order
- `GET /preorders/:id/receipt` - Get pre-order receipt

### Kitchen Operations (`/kitchen`)
- `GET /kitchen/tickets` - Get kitchen tickets (staff only)
- `GET /kitchen/tickets/:id` - Get ticket details
- `PATCH /kitchen/tickets/:id/status` - Update ticket status
- `POST /kitchen/tickets/:id/hold` - Put ticket on hold
- `POST /kitchen/tickets/:id/fire` - Fire ticket
- `POST /kitchen/tickets/:id/ready` - Mark ticket as ready
- `GET /kitchen/metrics` - Get kitchen performance metrics
- `WS /kitchen/subscribe` - Subscribe to real-time updates

### Check-in System (`/checkin`)
- `GET /checkin/:code` - Get check-in details by QR code
- `POST /checkin/:code/confirm` - Confirm check-in
- `POST /checkin/:code/table` - Assign table number
- `GET /checkin/:code/status` - Get check-in status
- `POST /checkin/manual` - Manual check-in (staff only)

### Payments (`/payments`) - Currently being fixed
- `POST /payments/create-payment-intent` - Create Stripe payment intent
- `PATCH /payments/payment-intent/:id` - Update payment intent (tip change)
- `POST /payments/confirm-payment` - Confirm payment completion
- `POST /payments/payment-intent/:id/cancel` - Cancel payment
- `POST /payments/refund` - Create refund
- `POST /payments/setup-payment-method` - Setup saved card
- `GET /payments/payment-methods` - List saved payment methods
- `POST /payments/webhook` - Stripe webhook handler

## WebSocket Events

### Kitchen Dashboard WebSocket
Connect to: `ws://localhost:3001/ws/kitchen`

Events:
- `ticket:created` - New ticket created
- `ticket:updated` - Ticket status changed
- `ticket:fired` - Ticket fired to kitchen
- `ticket:ready` - Food ready for service
- `ticket:served` - Food served to table

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message",
  "details": "Additional information (optional)",
  "code": "ERROR_CODE (optional)"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Rate Limited
- `500` - Internal Server Error

## Rate Limiting
- Default: 100 requests per minute per IP
- Authentication endpoints: 5 requests per minute
- Payment endpoints: 20 requests per minute

## Testing with Demo Data
After seeding (`npm run db:seed`), you can test with:
- Restaurant ID: `cmfjqkr8i0000un9375rq1kic`
- Check-in codes: `demo-res-001`, `demo-res-002`
- Test users created with seed data

## Postman Collection
Import the Postman collection from `/postman/la-carta-api.json` for easy testing.