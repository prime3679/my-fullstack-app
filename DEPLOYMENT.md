# La Carta - Production Deployment Guide

This guide walks you through deploying La Carta to production using:
- **Frontend**: Vercel (Next.js)
- **Backend**: Railway (Fastify)
- **Database**: Neon (PostgreSQL)
- **Payments**: Stripe

## Prerequisites

- GitHub account with access to this repository
- Credit card for service signups (all have free tiers)
- Domain name (optional, services provide subdomains)

## Part 1: Database Setup (Neon PostgreSQL)

### 1.1 Create Neon Account

1. Go to https://neon.tech
2. Sign up with GitHub
3. Create a new project:
   - Name: `lacarta-production`
   - Region: Choose closest to your users (e.g., US East, EU West)
   - PostgreSQL version: 16 (latest)

### 1.2 Get Database URL

1. In Neon dashboard, go to your project
2. Click "Connection Details"
3. Copy the connection string - looks like:
   ```
   postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require
   ```
4. Save this for later - you'll need it for Railway

### 1.3 Configure Database

Neon is ready to use immediately. We'll run migrations after deploying the backend.

**Cost**: Free tier includes:
- 0.5 GB storage
- 100 hours compute per month
- Enough for development and low-traffic production

---

## Part 2: Backend Deployment (Railway)

### 2.1 Create Railway Account

1. Go to https://railway.app
2. Sign up with GitHub
3. Verify your account

### 2.2 Deploy Backend

1. Click "New Project"
2. Select "Deploy from GitHub repo"
3. Authorize Railway to access your repositories
4. Select: `prime3679/my-fullstack-app`
5. Click "Deploy Now"

### 2.3 Configure Build

Railway will auto-detect the backend. If needed:

1. Go to project settings
2. Set **Root Directory**: `backend`
3. Set **Build Command**: `npm install && npx prisma generate && npm run build`
4. Set **Start Command**: `npm run start`

### 2.4 Add Environment Variables

In Railway project settings, add these variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Stripe (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Server
PORT=3001
NODE_ENV=production

# CORS (will update after Vercel deployment)
CORS_ORIGIN=https://your-app.vercel.app

# Optional: SMTP for emails
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@lacarta.com

# Optional: POS Integration
TOAST_API_KEY=your-toast-key
TOAST_RESTAURANT_GUID=your-guid
SQUARE_ACCESS_TOKEN=your-square-token
SQUARE_LOCATION_ID=your-location-id
```

### 2.5 Run Database Migration

1. In Railway, go to your backend service
2. Click on "Deployments" tab
3. Wait for deployment to complete
4. The `release` command in Procfile will automatically run: `npx prisma migrate deploy`
5. Check logs to verify migration succeeded

### 2.6 Get Backend URL

1. In Railway project, click on your backend service
2. Go to "Settings" → "Domains"
3. Click "Generate Domain"
4. You'll get a URL like: `https://your-app-production.up.railway.app`
5. Test it: `curl https://your-app-production.up.railway.app/api/health`
6. Save this URL for frontend configuration

**Cost**: Free tier includes:
- $5 free credit per month
- Enough for development and low-traffic apps
- Scales automatically

---

## Part 3: Frontend Deployment (Vercel)

### 3.1 Create Vercel Account

1. Go to https://vercel.com
2. Sign up with GitHub
3. Verify your account

### 3.2 Deploy Frontend

1. Click "Add New..." → "Project"
2. Import `prime3679/my-fullstack-app`
3. Configure project:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)

### 3.3 Add Environment Variables

In Vercel project settings, add:

```bash
# Backend API URL (from Railway)
NEXT_PUBLIC_API_URL=https://your-app-production.up.railway.app/api/v1

# Stripe Publishable Key (get from https://dashboard.stripe.com/apikeys)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxxxx

# Optional: Analytics
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

### 3.4 Deploy

1. Click "Deploy"
2. Wait 2-3 minutes for build to complete
3. You'll get a URL like: `https://your-app.vercel.app`

### 3.5 Update Backend CORS

1. Go back to Railway
2. Update the `CORS_ORIGIN` environment variable with your Vercel URL:
   ```
   CORS_ORIGIN=https://your-app.vercel.app
   ```
3. Railway will automatically redeploy

### 3.6 Add Custom Domain (Optional)

1. In Vercel project settings, go to "Domains"
2. Add your custom domain (e.g., `app.lacarta.com`)
3. Follow DNS configuration instructions
4. Update Railway CORS_ORIGIN to include custom domain

**Cost**: Free tier includes:
- Unlimited deployments
- 100 GB bandwidth per month
- Automatic HTTPS and CDN

---

## Part 4: Stripe Configuration

### 4.1 Get API Keys

1. Go to https://dashboard.stripe.com/apikeys
2. Toggle from "Test mode" to "Live mode"
3. Copy **Publishable key** (starts with `pk_live_`)
4. Copy **Secret key** (starts with `sk_live_`)

### 4.2 Configure Webhooks

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Set URL: `https://your-app-production.up.railway.app/api/v1/webhooks/stripe`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add to Railway environment as `STRIPE_WEBHOOK_SECRET`

### 4.3 Test Payment Flow

1. Go to your Vercel frontend
2. Create a test reservation with pre-order
3. Use Stripe test card: `4242 4242 4242 4242`, any future date, any CVC
4. Verify payment appears in Stripe dashboard

---

## Part 5: Seed Database

### 5.1 Connect to Database

You have two options:

**Option A: Railway CLI** (recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Run seed
railway run npm run db:seed --prefix backend
```

**Option B: Direct Connection**
```bash
# In backend directory
cd backend

# Set DATABASE_URL temporarily
export DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"

# Run seed
npm run db:seed
```

### 5.2 Verify Seed Data

1. Go to https://console.neon.tech
2. Open your project
3. Go to "SQL Editor"
4. Run queries:
   ```sql
   SELECT * FROM "Restaurant" LIMIT 5;
   SELECT * FROM "User" WHERE role = 'ORG_ADMIN';
   SELECT * FROM "MenuItem" LIMIT 10;
   ```

---

## Part 6: Testing & Verification

### 6.1 Health Checks

Test each service:

```bash
# Backend health
curl https://your-app-production.up.railway.app/api/health

# Expected response:
# {"status":"ok","timestamp":"2025-10-22T...","database":"connected"}

# Frontend (should load)
curl -I https://your-app.vercel.app

# Expected: 200 OK
```

### 6.2 Feature Testing Checklist

- [ ] Homepage loads with restaurant list
- [ ] Click on a restaurant shows availability
- [ ] Create a reservation (select date, time, party size)
- [ ] Add menu items to pre-order
- [ ] Complete payment with Stripe
- [ ] QR check-in works
- [ ] Kitchen dashboard shows active orders
- [ ] Host dashboard displays reservations
- [ ] Menu management allows CRUD operations
- [ ] Staff panel allows role management

### 6.3 Monitor Logs

**Railway (Backend):**
1. Go to Railway project
2. Click on backend service
3. Click "Logs" tab
4. Watch for errors

**Vercel (Frontend):**
1. Go to Vercel project
2. Click "Logs" tab
3. Filter by "Errors"

---

## Part 7: Post-Deployment

### 7.1 Set Up Monitoring

**Recommended tools:**
- **Sentry** (errors): https://sentry.io
- **LogRocket** (session replay): https://logrocket.com
- **Uptime Robot** (availability): https://uptimerobot.com

### 7.2 Database Backups

Neon provides automatic backups:
1. Go to Neon dashboard
2. Navigate to "Backups"
3. Enable daily backups (included in paid plan)

### 7.3 Security Checklist

- [ ] All environment variables use production values (not test)
- [ ] JWT_SECRET is at least 32 random characters
- [ ] Stripe webhook secret is configured
- [ ] CORS_ORIGIN only includes your frontend domain
- [ ] Database credentials are not committed to git
- [ ] SSL/HTTPS is enabled (automatic with Vercel/Railway)

### 7.4 Performance Optimization

**Frontend (Vercel):**
- Vercel automatically optimizes images
- CDN caching is enabled by default
- Consider upgrading to Pro for advanced analytics

**Backend (Railway):**
- Monitor memory usage in Railway dashboard
- Consider upgrading to 2GB RAM for higher traffic
- Add Redis for session storage (Railway marketplace)

**Database (Neon):**
- Add indexes for frequently queried fields
- Monitor query performance in Neon dashboard
- Consider upgrading to larger compute for more connections

---

## Troubleshooting

### Backend won't start

**Issue**: Railway deployment fails with build error

**Solution**:
1. Check Railway logs for specific error
2. Verify all environment variables are set
3. Ensure DATABASE_URL is valid
4. Run locally: `cd backend && npm run build`

### Frontend shows API errors

**Issue**: "Failed to fetch" errors on frontend

**Solution**:
1. Verify NEXT_PUBLIC_API_URL is correct (include `/api/v1`)
2. Check Railway backend is running
3. Verify CORS_ORIGIN in Railway matches Vercel URL
4. Check browser console for CORS errors

### Database connection fails

**Issue**: "Unable to connect to database"

**Solution**:
1. Verify DATABASE_URL in Railway
2. Ensure Neon database is active (check Neon dashboard)
3. Check connection string includes `?sslmode=require`
4. Test connection with psql:
   ```bash
   psql "postgresql://user:password@ep-xxx.region.aws.neon.tech/dbname?sslmode=require"
   ```

### Stripe webhooks not working

**Issue**: Payments succeed but database not updated

**Solution**:
1. Verify webhook endpoint in Stripe dashboard
2. Check STRIPE_WEBHOOK_SECRET in Railway
3. Test webhook with Stripe CLI:
   ```bash
   stripe trigger payment_intent.succeeded
   ```
4. Check Railway logs for webhook errors

### Migrations fail

**Issue**: `npx prisma migrate deploy` fails

**Solution**:
1. Check if migration files exist in `backend/prisma/migrations`
2. Verify DATABASE_URL is correct
3. Run manually via Railway CLI:
   ```bash
   railway run npx prisma migrate deploy --prefix backend
   ```
4. If needed, reset database (⚠️ destroys data):
   ```bash
   railway run npx prisma migrate reset --prefix backend
   ```

---

## Cost Breakdown

### Free Tier (Suitable for MVP/Testing)

- **Neon**: $0/month (0.5GB storage, 100h compute)
- **Railway**: $5 credit/month (covers low traffic)
- **Vercel**: $0/month (100GB bandwidth)
- **Stripe**: 2.9% + $0.30 per transaction
- **Total Fixed**: ~$0-5/month

### Production (Moderate Traffic)

- **Neon**: $19/month (Scale plan, 10GB storage)
- **Railway**: $20/month (Pro plan, 8GB RAM)
- **Vercel**: $20/month (Pro plan, 1TB bandwidth)
- **Stripe**: 2.9% + $0.30 per transaction
- **Total Fixed**: ~$60/month + transaction fees

### High Traffic (1000+ reservations/day)

- **Neon**: $69/month (Business plan)
- **Railway**: $50/month (2x services, 16GB RAM)
- **Vercel**: $20/month (Pro plan sufficient with CDN)
- **Total Fixed**: ~$140/month + transaction fees

---

## Next Steps

1. **Set up monitoring** - Add Sentry for error tracking
2. **Configure email** - Set up SendGrid for transactional emails
3. **Add analytics** - Integrate Google Analytics or PostHog
4. **Performance testing** - Use Artillery or k6 for load testing
5. **Documentation** - Create user guides for restaurant staff
6. **Marketing site** - Build landing page for customer acquisition

---

## Support & Resources

- **Neon Docs**: https://neon.tech/docs
- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Stripe Docs**: https://stripe.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Prisma Docs**: https://www.prisma.io/docs
- **Fastify Docs**: https://www.fastify.io/docs

---

## Quick Reference

### Environment Variables Checklist

**Backend (Railway):**
```bash
DATABASE_URL=postgresql://...
JWT_SECRET=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://your-app.vercel.app
```

**Frontend (Vercel):**
```bash
NEXT_PUBLIC_API_URL=https://your-backend.railway.app/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### Useful Commands

```bash
# Check backend health
curl https://your-backend.railway.app/api/health

# Check frontend
curl -I https://your-app.vercel.app

# View Railway logs
railway logs

# Run migrations
railway run npx prisma migrate deploy --prefix backend

# Seed database
railway run npm run db:seed --prefix backend

# Access Prisma Studio
railway run npx prisma studio --prefix backend
```

---

**Deployment Complete!** 🎉

Your La Carta platform is now live. Test thoroughly before announcing to customers.
