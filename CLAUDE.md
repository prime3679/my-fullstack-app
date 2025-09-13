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
coding-project/
├── frontend/                 # Next.js application
│   ├── src/
│   │   ├── app/             # App Router pages and layouts
│   │   └── components/      # React components
├── backend/                 # Fastify API server
│   ├── src/
│   │   ├── index.ts        # Main server file
│   │   ├── lib/            # Database and utilities
│   │   └── seed.ts         # Database seeding script
│   └── prisma/
│       └── schema.prisma   # Database schema
└── shared/                 # Shared types and utilities
    └── types.ts           # Common TypeScript types
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

### Current Endpoints
- `GET /api/health` - Health check with database connectivity
- `GET /api/restaurants` - List restaurants with locations and tables
- `GET /api/reservations` - List reservations with full details

### Planned Endpoints (from PRD)
- `POST /v1/reservations` - Create reservation
- `POST /v1/orders` - Create pre-order with payment
- `POST /v1/checkin` - QR check-in
- `PATCH /console/v1/orders/{id}` - Kitchen operations (HOLD/FIRE/READY)
- GraphQL gateway for complex queries

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

1. **Database Setup**: Ensure PostgreSQL is running locally
2. **Install Dependencies**: `npm install` in root, frontend, and backend
3. **Environment**: Copy `.env.example` to `.env` and configure
4. **Database**: `npm run db:push && npm run db:seed` in backend
5. **Start Dev**: `npm run dev` in root directory

The vision is to make every diner feel like a VIP while giving restaurants predictable operations and higher revenue. The magic happens when technology disappears and hospitality shines.