# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**La Carta** - A sophisticated restaurant reservation + pre-order + pre-pay platform that compresses the gap between "I'm hungry" and "first bite" into minutes that feel luxurious, not rushed.

**Vision**: "Dinner, accelerated to delight"

**Tech Stack**:
- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS, and App Router
- **Backend**: Node.js with Fastify, TypeScript, and REST API + GraphQL
- **Database**: PostgreSQL with Prisma ORM
- **Payments**: Stripe with Apple/Google Pay support
- **Integrations**: OpenTable, Toast POS, Square POS
- **Real-time**: WebSockets for kitchen pacing dashboard
- **AI**: Menu personalization and upsell suggestions

## Development Commands

### Start Development Servers
```bash
# Start both frontend and backend concurrently
npm run dev

# Start individual services
npm run dev:frontend  # Next.js dev server on :3000
npm run dev:backend   # Fastify API server on :3001
```

### Database Operations
```bash
# Backend database commands
cd backend
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema to database (development)
npm run db:migrate    # Create and run migration
npm run db:studio     # Open Prisma Studio
npm run db:seed       # Seed database with demo data
```

### Build & Production
```bash
# Build both frontend and backend
npm run build

# Start production servers
npm run start
```

## Project Structure

```
my-fullstack-app/
├── frontend/                # Next.js 15 application
│   ├── src/
│   │   ├── app/            # App Router pages and layouts
│   │   ├── components/     # React components
│   │   ├── contexts/       # React contexts (Auth, etc.)
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # API client, Stripe, utilities
│   ├── public/             # Static assets
│   ├── .env.local          # Frontend environment vars (gitignored)
│   ├── .env.example        # Frontend env template
│   ├── package.json
│   └── next.config.ts
│
├── backend/                # Fastify API server
│   ├── src/
│   │   ├── index.ts       # Main server file
│   │   ├── routes/        # API route handlers
│   │   ├── services/      # Business logic services
│   │   ├── lib/           # Database, auth, websocket, logger
│   │   ├── integrations/  # Toast POS, Square POS
│   │   ├── jobs/          # Background jobs (menu sync)
│   │   ├── utils/         # Helper functions
│   │   ├── types/         # TypeScript type definitions
│   │   ├── seed.ts        # Main database seeding
│   │   └── seed-staff.ts  # Staff user seeding
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   ├── .env               # Backend environment vars (gitignored)
│   ├── .env.example       # Backend env template
│   └── package.json
│
├── shared/                # Shared types between frontend/backend
├── package.json           # Root package (runs both servers)
├── CLAUDE.md             # This file
├── DEPLOYMENT_GUIDE.md   # Production deployment guide
├── QUICK_START.md        # Local development setup
├── KNOWN_ISSUES.md       # Known issues and fixes
├── DEPLOYMENT.md         # Older deployment notes
└── README.md             # Project overview
```

## Core Features & User Journey

1. **Discovery**: Diner finds restaurant, sees availability
2. **Reservation**: Books table with party size and time
3. **Pre-order**: Selects menu items with modifiers, allergens, notes
4. **Payment**: Pre-pays via Stripe (Apple Pay/Google Pay) with tips
5. **Arrival**: QR check-in triggers kitchen timing
6. **Kitchen**: ETA-driven firing so plates arrive within 5 minutes of seating
7. **Dining**: Real-time pacing, optional add-ons, AI-powered upsells
8. **Departure**: Automatic payment settlement, loyalty points

## Database Schema

**Core Entities**:
- `Restaurant` → `Location` → `Table`
- `User` (multi-role: diner, host, server, manager, etc.)
- `Reservation` → `PreOrder` → `PreOrderItem`
- `Payment` (Stripe integration)
- `CheckIn` → `KitchenTicket` (workflow states)
- `LoyaltyAccount`, `Event`, `AuditLog`

**Key Relationships**:
- Users can have multiple roles per restaurant
- Reservations link to pre-orders and kitchen tickets
- Events track all user actions for analytics

## API Endpoints

All API endpoints are under `/api/v1/` prefix (except legacy demo endpoints).

### Implemented Endpoints

**Authentication** (`/api/v1/auth`):
- POST `/signup` - Create diner account
- POST `/signin` - Sign in
- POST `/verify-phone` - Phone verification
- GET `/me` - Get current user
- GET/POST `/google`, `/google/callback` - Google OAuth
- GET/POST `/apple`, `/apple/callback` - Apple OAuth

**Restaurants** (`/api/v1/restaurants`):
- GET `/` - List all restaurants with locations
- GET `/:id` - Get restaurant details
- GET `/:id/availability` - Check table availability

**Reservations** (`/api/v1/reservations`):
- GET `/availability` - Check time slot availability
- POST `/` - Create reservation
- GET `/` - List reservations
- GET `/:id/details` - Get full reservation details
- PATCH `/:id` - Update reservation
- DELETE `/:id` - Cancel reservation

**Menu** (`/api/v1/menu`):
- GET `/restaurants/:restaurantId` - Get full menu
- GET `/categories/:restaurantId` - Get categories only
- PATCH `/availability` - Update item availability

**Pre-orders** (`/api/v1/preorders`):
- POST `/` - Create pre-order
- GET `/:id` - Get pre-order details
- PATCH `/:id` - Update pre-order
- PATCH `/:id/confirm` - Confirm pre-order
- POST `/:id/inject-to-pos` - Send to POS system
- DELETE `/:id` - Delete pre-order

**Payments** (`/api/v1/payments`):
- POST `/payment-intent` - Create Stripe payment intent
- POST `/confirm` - Confirm payment
- POST `/webhook` - Stripe webhook handler
- POST `/refund` - Refund payment
- GET `/history` - Get payment history

**Check-in** (`/api/v1/checkin`):
- POST `/qr` - QR code check-in
- POST `/assign-table` - Manual table assignment
- GET `/by-reservation/:id` - Get check-in details
- GET `/by-location/:locationId` - Get location check-ins

**Kitchen** (`/api/v1/kitchen`):
- GET `/tickets` - List kitchen tickets
- GET `/dashboard` - Get kitchen dashboard data
- PATCH `/tickets/:id` - Update ticket status (HOLD/FIRE/READY/SERVED)

**Host Operations** (`/api/v1/host`):
- GET `/reservations` - List reservations for host
- PATCH `/table-assignment` - Assign tables
- PATCH `/seating-status` - Update seating status
- GET `/dashboard` - Host dashboard data

**Staff Management** (`/api/v1/staff`):
- POST `/invite` - Invite staff member
- POST `/onboard` - Onboard new staff
- POST `/login` - Staff login
- GET `/list` - List staff members
- PATCH `/profile` - Update staff profile

**Admin Menu** (`/api/v1/admin/menu`):
- Full CRUD for menu categories, items, modifiers, and modifier groups
- ~20 endpoints for complete menu management

**Admin** (`/api/v1/admin`):
- GET `/restaurants` - List all restaurants
- POST `/restaurants` - Create restaurant
- PATCH `/restaurants/:id` - Update restaurant

**POS Integration** (`/api/v1/pos`):
- GET `/config/:restaurantId` - Get POS config
- PUT `/config/:restaurantId` - Update POS config
- POST `/sync-menu/:restaurantId` - Sync menu from POS
- POST `/inject-order` - Inject order to POS
- POST `/webhook/:provider` - Handle POS webhooks (Toast/Square)

**Legacy Demo Endpoints** (root level):
- GET `/api/health` - Health check with DB connectivity
- GET `/api/restaurants` - Demo restaurant list
- GET `/api/reservations` - Demo reservation list

## Development Notes

**State Machines**:
- Reservation: DRAFT → BOOKED → CHECKED_IN → COMPLETED
- PreOrder: DRAFT → AUTHORIZED → INJECTED_TO_POS → CLOSED  
- KitchenTicket: PENDING → HOLD → FIRED → READY → SERVED

**Key Integrations**:
- OpenTable API for reservation management
- Stripe Payment Element for secure payments
- Toast/Square POS for menu sync and order injection
- WebSocket for real-time kitchen dashboard updates

**AI Components**:
- Menu item embeddings for personalized recommendations
- Gradient boosted regression for ETA predictions
- LLM-generated upsell suggestions with safety rules

## Environment Variables

### Backend (.env)
```
DATABASE_URL="postgresql://..."
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""
OPENTABLE_API_KEY=""
JWT_SECRET=""
```

## Success Metrics (from PRD)

- **Throughput**: 20% reduction in table turn time
- **Revenue**: 15% increase in average ticket size
- **Experience**: NPS 70+, 80% of guests smile before host greeting
- **Adoption**: 40% of guests opt into preference sharing

## Getting Started

1. **Database Setup**: Ensure PostgreSQL is running locally (or use Neon free tier)
2. **Install Dependencies**: `npm install` in root, then `cd frontend && npm install && cd ../backend && npm install`
3. **Environment**: Copy `.env.example` to `.env` in backend, and `.env.example` to `.env.local` in frontend
4. **Database**: In backend directory: `npm run db:generate && npm run db:push && npm run db:seed`
5. **Start Dev**: From root: `npm run dev` (starts both frontend and backend)
6. **Open App**: Frontend at http://localhost:3000, Backend at http://localhost:3001

**For detailed setup instructions, see `QUICK_START.md`.**

## Current Status

### ✅ Fully Implemented

- Complete reservation flow (search, book, confirm)
- Pre-order with menu browsing, cart, and modifiers
- Stripe payment integration with webhooks
- QR code check-in
- Real-time kitchen dashboard with WebSocket
- Multi-role staff portal (host, server, kitchen, manager, admin)
- Full menu management admin panel
- Staff onboarding and management
- Toast and Square POS integration framework
- Background jobs (menu sync)
- OAuth authentication (Google, Apple)
- Comprehensive API with 60+ endpoints
- Database schema with state machines and audit logging

### 🚧 Partially Implemented

- AI menu recommendations (Embedding model exists, no service logic)
- Loyalty program (database schema exists, no frontend UI)
- OpenTable integration (mentioned but not implemented)
- ETA predictions (basic pacing, no ML model)
- Email notifications (framework exists, disabled by default)

### 📝 Known Issues

- TypeScript build errors in backend (see `KNOWN_ISSUES.md` for fixes)
- Some frontend pages missing null checks for optional chaining
- Google Fonts removed (can be re-added for production)
- Prisma Client generation requires network access

**For complete list of issues and fixes, see `KNOWN_ISSUES.md`.**

## Deployment

- **Frontend**: Deploy to Vercel (configured with `vercel.json`)
- **Backend**: Deploy to Railway (configured with `railway.json`)
- **Database**: Use Neon (serverless PostgreSQL)

**For step-by-step deployment instructions, see `DEPLOYMENT_GUIDE.md`.**

## Documentation

- **`QUICK_START.md`** - Local development setup (start here!)
- **`DEPLOYMENT_GUIDE.md`** - Production deployment to Vercel/Railway/Neon
- **`KNOWN_ISSUES.md`** - Known bugs and how to fix them
- **`DEPLOYMENT.md`** - Legacy deployment notes
- **`POS_INTEGRATION_SETUP.md`** - Toast and Square POS setup
- **`WEBHOOK_SETUP.md`** - Webhook configuration
- **`PAYMENT_TESTING_GUIDE.md`** - Stripe payment testing
- **`SOCIAL_LOGIN_SETUP.md`** - Google and Apple OAuth setup

The vision is to make every diner feel like a VIP while giving restaurants predictable operations and higher revenue. The magic happens when technology disappears and hospitality shines.