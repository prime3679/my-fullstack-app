# La Carta - Quick Start Guide

Get La Carta running locally in under 10 minutes.

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+ (or use Neon free tier)
- **Git**
- **Stripe account** (for payment testing)

---

## Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/your-username/lacarta.git
cd lacarta

# Install root dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..

# Install backend dependencies
cd backend
npm install
cd ..
```

---

## Step 2: Set Up Database

### Option A: Local PostgreSQL

```bash
# Create database
createdb lacarta

# Set connection string
export DATABASE_URL="postgresql://localhost:5432/lacarta"
```

### Option B: Neon (Free Cloud Database)

1. Go to [https://neon.tech](https://neon.tech)
2. Create free account
3. Create new project
4. Copy connection string
5. Add `?sslmode=require` to the end

---

## Step 3: Configure Environment Variables

### Backend Environment

```bash
cd backend
cp ../env.example .env
```

Edit `backend/.env`:

```bash
# Database
DATABASE_URL="postgresql://localhost:5432/lacarta"

# JWT Secret (generate with: openssl rand -hex 64)
JWT_SECRET="your-secret-key-here"

# Stripe (get from https://dashboard.stripe.com/test/apikeys)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..." # Get this after setting up webhook

# Server
NODE_ENV="development"
PORT="3001"

# Frontend URL
FRONTEND_URL="http://localhost:3000"

# Optional: Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_CALLBACK_URL="http://localhost:3001/api/v1/auth/google/callback"

# Optional: Apple OAuth
APPLE_CLIENT_ID=""
APPLE_TEAM_ID=""
APPLE_KEY_ID=""
APPLE_PRIVATE_KEY=""
APPLE_CALLBACK_URL="http://localhost:3001/api/v1/auth/apple/callback"

# Optional: Email (leave empty to skip email features)
FROM_EMAIL="La Carta <noreply@lacarta.com>"
SMTP_HOST=""
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER=""
SMTP_PASS=""

# POS Integration (optional)
TOAST_API_BASE_URL="https://ws-sandbox-api.toasttab.com"
TOAST_AUTH_BASE_URL="https://ws-sandbox-auth.toasttab.com"
SQUARE_API_BASE_URL="https://connect.squareupsandbox.com"
SQUARE_API_VERSION="2024-11-20"

# Background Jobs
MENU_SYNC_ENABLED="false"  # Set to false for local dev
MENU_SYNC_INTERVAL_MINUTES="60"
MENU_SYNC_MAX_CONCURRENT="3"
```

### Frontend Environment

```bash
cd ../frontend
cp .env.example .env.local
```

Edit `frontend/.env.local`:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL="http://localhost:3001"

# Stripe Publishable Key (test mode)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
```

---

## Step 4: Initialize Database

```bash
cd backend

# Generate Prisma Client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Seed with demo data
npm run db:seed

# Optional: Seed staff users
npm run db:seed:staff
```

**Expected Output:**
```
✅ Created 3 restaurants
✅ Created 12 locations
✅ Created 48 tables
✅ Created 15 menu categories
✅ Created 75 menu items
✅ Created demo reservations
✅ Database seeded successfully!
```

---

## Step 5: Start Development Servers

### Option A: Start Both Servers (Recommended)

```bash
# From project root
npm run dev
```

This starts:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Option B: Start Individually

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## Step 6: Verify Setup

### 6.1 Backend Health Check

Open in browser or curl:
```bash
curl http://localhost:3001/api/health
```

**Expected Response:**
```json
{
  "status": "OK",
  "message": "La Carta server is running",
  "database": "connected",
  "timestamp": "2025-10-26T..."
}
```

### 6.2 Frontend Home Page

Open in browser:
```
http://localhost:3000
```

You should see:
- La Carta homepage
- Search/filter controls
- List of seeded restaurants
- "Check Availability" and "Reserve" buttons

---

## Step 7: Set Up Stripe Webhook (for Payment Testing)

### Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows
scoop install stripe

# Linux
wget https://github.com/stripe/stripe-cli/releases/download/v1.19.5/stripe_1.19.5_linux_x86_64.tar.gz
tar -xvf stripe_1.19.5_linux_x86_64.tar.gz
```

### Forward Webhooks to Local Server

```bash
# Login to Stripe
stripe login

# Forward webhooks
stripe listen --forward-to localhost:3001/api/v1/payments/webhook
```

**Copy the webhook signing secret** (starts with `whsec_...`) and add to `backend/.env`:

```bash
STRIPE_WEBHOOK_SECRET="whsec_..."
```

### Test Payment

1. Go to http://localhost:3000
2. Create a reservation
3. Add menu items
4. Go to payment page
5. Use test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits
6. Complete payment

Check Stripe CLI output to see webhook events.

---

## Step 8: Test Key Features

### 8.1 Full Reservation Flow

1. **Home Page** → Select party size, date, time
2. **Restaurant Page** → Click "Reserve"
3. **Reservation Form** → Enter guest details
4. **Confirmation** → See reservation confirmed

### 8.2 Pre-Order Flow

1. **Restaurant Menu** → Browse menu items
2. **Add to Cart** → Select items with modifiers
3. **Checkout** → Review order summary
4. **Payment** → Complete Stripe payment
5. **Confirmation** → See order confirmed with QR code

### 8.3 Check-In Flow

1. **QR Page** → Go to `/qr/[reservationId]`
2. **Check-In** → Click "Check In Now"
3. **Kitchen Dashboard** → Go to `/kitchen`
4. **See Ticket** → Order appears in PENDING state

### 8.4 Kitchen Dashboard

1. Go to http://localhost:3000/kitchen
2. You should see real-time kitchen tickets
3. Try changing ticket status (HOLD → FIRED → READY → SERVED)
4. WebSocket updates happen instantly

### 8.5 Staff Portal

1. Go to http://localhost:3000/staff
2. Sign up as staff member
3. Complete onboarding wizard
4. Access staff features

### 8.6 Admin Features

**Menu Management:**
```
http://localhost:3000/admin/menu/[restaurantId]
```

**Staff Management:**
```
http://localhost:3000/admin/staff/[restaurantId]
```

**Host Dashboard:**
```
http://localhost:3000/host/[restaurantId]
```

---

## Common Development Tasks

### View Database with Prisma Studio

```bash
cd backend
npm run db:studio
```

Opens at http://localhost:5555

### Reset Database

```bash
cd backend
npm run db:push -- --force-reset
npm run db:seed
```

### Run Tests

```bash
# Backend tests
cd backend
npm test

# Frontend tests (if configured)
cd frontend
npm test
```

### Check TypeScript Errors

```bash
# Frontend
cd frontend
npm run type-check

# Backend
cd backend
npm run build
```

### Lint Code

```bash
# Frontend
cd frontend
npm run lint

# Backend (if configured)
cd backend
npm run lint
```

### Format Code (if Prettier is configured)

```bash
npm run format
```

---

## Troubleshooting

### Error: "Can't reach database server"

**Solution**:
1. Make sure PostgreSQL is running:
   ```bash
   # macOS
   brew services start postgresql

   # Linux
   sudo service postgresql start

   # Windows
   # Use pgAdmin or Services panel
   ```
2. Verify DATABASE_URL in backend/.env
3. Test connection:
   ```bash
   psql $DATABASE_URL
   ```

### Error: "Port 3000 already in use"

**Solution**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run dev
```

### Error: "Prisma Client not generated"

**Solution**:
```bash
cd backend
npm run db:generate
```

### Error: "Stripe webhook signature verification failed"

**Solution**:
1. Make sure Stripe CLI is running:
   ```bash
   stripe listen --forward-to localhost:3001/api/v1/payments/webhook
   ```
2. Copy the webhook secret (whsec_...) to backend/.env
3. Restart backend server

### Frontend can't connect to backend (CORS error)

**Solution**:
1. Verify NEXT_PUBLIC_API_URL in frontend/.env.local is `http://localhost:3001`
2. Verify FRONTEND_URL in backend/.env is `http://localhost:3000`
3. Restart both servers

### WebSocket not connecting

**Solution**:
1. Check browser console for errors
2. Verify backend is running on port 3001
3. Try hard refresh (Cmd+Shift+R or Ctrl+Shift+R)

---

## Development Workflow

### Daily Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
npm install
cd frontend && npm install
cd ../backend && npm install
cd ..

# 3. Update database schema if changed
cd backend
npm run db:push
cd ..

# 4. Start dev servers
npm run dev

# 5. Make changes and test

# 6. Commit and push
git add .
git commit -m "Your commit message"
git push origin your-branch
```

### Creating a New Feature

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes
# ... edit files ...

# 3. Test locally
npm run dev

# 4. Run type check
cd frontend && npm run type-check
cd ../backend && npm run build
cd ..

# 5. Commit and push
git add .
git commit -m "Add: Your feature description"
git push origin feature/your-feature-name

# 6. Create pull request on GitHub
```

### Database Schema Changes

```bash
# 1. Edit backend/prisma/schema.prisma

# 2. Push changes to database
cd backend
npm run db:push

# 3. Regenerate Prisma Client
npm run db:generate

# 4. Create migration (for production)
npm run db:migrate -- --name your_migration_name

# 5. Restart backend
npm run dev
```

---

## What's Next?

After getting everything running locally:

1. ✅ **Read the codebase**: Browse `frontend/src` and `backend/src`
2. ✅ **Try all features**: Test reservation, pre-order, payment, check-in, kitchen dashboard
3. ✅ **Deploy to production**: Follow `DEPLOYMENT_GUIDE.md`
4. ✅ **Customize**: Update branding, colors, restaurant data
5. ✅ **Add features**: See `FEATURE_IDEAS.md` for suggestions
6. ✅ **Integrate POS**: Connect Toast or Square (see `POS_INTEGRATION_SETUP.md`)

---

## Project Structure Reference

```
my-fullstack-app/
├── frontend/              # Next.js 15 frontend
│   ├── src/
│   │   ├── app/          # App Router pages
│   │   ├── components/   # React components
│   │   ├── contexts/     # React contexts (Auth, etc.)
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utilities (API client, Stripe, etc.)
│   ├── public/           # Static assets
│   ├── .env.local        # Frontend environment variables
│   ├── package.json
│   └── next.config.ts
│
├── backend/              # Fastify API backend
│   ├── src/
│   │   ├── index.ts      # Main server file
│   │   ├── routes/       # API route handlers
│   │   ├── services/     # Business logic
│   │   ├── lib/          # Utilities (DB, auth, websocket)
│   │   ├── integrations/ # POS integrations
│   │   ├── jobs/         # Background jobs
│   │   └── types/        # TypeScript types
│   ├── prisma/
│   │   └── schema.prisma # Database schema
│   ├── .env              # Backend environment variables
│   └── package.json
│
├── shared/               # Shared types/utilities
├── package.json          # Root package (runs both servers)
├── DEPLOYMENT_GUIDE.md   # Production deployment guide
├── QUICK_START.md        # This file
└── CLAUDE.md             # AI assistant instructions
```

---

## Getting Help

- **Documentation**: Check other `.md` files in the project root
- **GitHub Issues**: Report bugs or request features
- **Code Comments**: Many files have detailed inline comments
- **Prisma Studio**: Use `npm run db:studio` to explore the database visually

---

**Happy coding!** 🎉

For production deployment, see `DEPLOYMENT_GUIDE.md`.
