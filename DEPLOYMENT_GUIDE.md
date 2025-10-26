# La Carta - Complete Deployment Guide

This guide walks you through deploying the La Carta fullstack application to production using Vercel (frontend), Railway (backend), and Neon (database).

## Architecture Overview

```
┌─────────────────┐
│   Vercel        │  Frontend (Next.js 15)
│   :443          │  https://lacarta.vercel.app
└────────┬────────┘
         │ API Calls
         ↓
┌─────────────────┐
│   Railway       │  Backend (Fastify API)
│   :3001         │  https://lacarta-api.railway.app
└────────┬────────┘
         │ Database Queries
         ↓
┌─────────────────┐
│   Neon          │  PostgreSQL Database
│   :5432         │  Serverless Postgres
└─────────────────┘
```

## Prerequisites

- [ ] GitHub account
- [ ] Vercel account (connect to GitHub)
- [ ] Railway account
- [ ] Neon account
- [ ] Stripe account (for payments)
- [ ] Google Cloud Console (for OAuth - optional)
- [ ] Apple Developer account (for Apple Sign-In - optional)

---

## Step 1: Set Up Database (Neon)

### 1.1 Create Database

1. Go to [https://neon.tech](https://neon.tech)
2. Sign in and click **"Create Project"**
3. Name: `lacarta-production`
4. Region: Choose closest to your users (e.g., `us-east-1`)
5. Click **"Create Project"**

### 1.2 Get Database Connection String

1. In your Neon project, go to **"Connection Details"**
2. Copy the connection string (format: `postgresql://user:pass@host/dbname`)
3. **Important**: Add `?sslmode=require` to the end of the connection string

Example:
```
postgresql://user:password@ep-cool-sound-123456.us-east-1.aws.neon.tech/lacarta?sslmode=require
```

4. Save this - you'll need it for Railway and local development

### 1.3 Run Database Migrations

**Option A: From Local Machine**
```bash
cd backend
DATABASE_URL="your-neon-connection-string" npm run db:push
DATABASE_URL="your-neon-connection-string" npm run db:seed
```

**Option B: From Railway (after backend deployment)**
```bash
# Via Railway CLI or dashboard console
npm run db:push
npm run db:seed
```

---

## Step 2: Set Up Backend (Railway)

### 2.1 Create Railway Project

1. Go to [https://railway.app](https://railway.app)
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your repository
5. Railway will detect it's a monorepo - select **backend** directory

### 2.2 Configure Build Settings

In Railway dashboard → Settings:

```yaml
Build Command:    npm install && npm run build
Start Command:    npm start
Watch Paths:      backend/**
Root Directory:   /backend
```

### 2.3 Set Environment Variables

Go to Railway → Variables tab and add:

```bash
# Database
DATABASE_URL=postgresql://user:pass@neon-host/lacarta?sslmode=require

# Server
NODE_ENV=production
PORT=3001

# JWT
JWT_SECRET=<generate-a-long-random-string-here>

# Frontend URL (will be your Vercel URL)
FRONTEND_URL=https://your-app.vercel.app

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_CALLBACK_URL=https://your-api.railway.app/api/v1/auth/google/callback

# Apple OAuth (optional)
APPLE_CLIENT_ID=your.bundle.id
APPLE_TEAM_ID=ABC123
APPLE_KEY_ID=KEY123
APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
APPLE_CALLBACK_URL=https://your-api.railway.app/api/v1/auth/apple/callback

# Email (optional - leave empty to disable)
FROM_EMAIL=noreply@lacarta.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key

# POS Integration
TOAST_API_BASE_URL=https://ws-api.toasttab.com
TOAST_AUTH_BASE_URL=https://ws-auth.toasttab.com
SQUARE_API_BASE_URL=https://connect.squareup.com
SQUARE_API_VERSION=2024-11-20

# Background Jobs
MENU_SYNC_ENABLED=true
MENU_SYNC_INTERVAL_MINUTES=60
MENU_SYNC_MAX_CONCURRENT=3
```

**Generate JWT Secret:**
```bash
# On your local machine
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 2.4 Deploy Backend

1. Railway will automatically deploy when you push to GitHub
2. Go to **Settings → Networking** → **Generate Domain**
3. Copy your Railway URL (e.g., `https://lacarta-api.up.railway.app`)
4. Test the health endpoint:
   ```bash
   curl https://your-api.railway.app/api/health
   ```

Expected response:
```json
{
  "status": "OK",
  "message": "La Carta server is running",
  "database": "connected",
  "timestamp": "2025-10-26T..."
}
```

---

## Step 3: Set Up Frontend (Vercel)

### 3.1 Create Vercel Project

1. Go to [https://vercel.com](https://vercel.com)
2. Click **"Add New Project"**
3. Import your GitHub repository
4. **Root Directory**: Select `frontend`
5. Framework Preset: Next.js (should auto-detect)

### 3.2 Configure Build Settings

Vercel should auto-detect these, but verify:

```yaml
Build Command:       npm run build
Output Directory:    .next
Install Command:     npm install
Development Command: npm run dev
```

### 3.3 Set Environment Variables

Go to Vercel → Settings → Environment Variables:

**For Production:**

```bash
# Backend API URL (your Railway URL)
NEXT_PUBLIC_API_URL=https://your-api.railway.app

# Stripe Public Key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**For Preview/Development:**

Add the same variables but with test/development values:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

### 3.4 Deploy Frontend

1. Click **"Deploy"**
2. Vercel will build and deploy your frontend
3. You'll get a URL like `https://lacarta-abc123.vercel.app`
4. Set up a custom domain (optional):
   - Go to Settings → Domains
   - Add your custom domain (e.g., `lacarta.com`)
   - Follow DNS configuration instructions

### 3.5 Update Railway Environment

**IMPORTANT**: Go back to Railway and update:

```bash
FRONTEND_URL=https://your-app.vercel.app
```

Redeploy the Railway backend after this change.

---

## Step 4: Configure Stripe Webhooks

### 4.1 Create Webhook Endpoint

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks
2. Click **"Add endpoint"**
3. Endpoint URL: `https://your-api.railway.app/api/v1/payments/webhook`
4. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`

### 4.2 Get Webhook Secret

1. After creating the webhook, click to reveal the **Signing Secret**
2. It starts with `whsec_...`
3. Add this to Railway environment variables:
   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

### 4.3 Test Webhook

```bash
# Use Stripe CLI for local testing
stripe listen --forward-to https://your-api.railway.app/api/v1/payments/webhook

# Trigger a test payment
stripe trigger payment_intent.succeeded
```

---

## Step 5: Configure OAuth (Optional)

### 5.1 Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Enable **"Google+ API"**
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Authorized redirect URIs:
   - `https://your-api.railway.app/api/v1/auth/google/callback`
   - `http://localhost:3001/api/v1/auth/google/callback` (for dev)
7. Copy Client ID and Client Secret to Railway environment variables

### 5.2 Apple Sign-In

1. Go to [Apple Developer Portal](https://developer.apple.com)
2. Certificates, Identifiers & Profiles → Keys
3. Create a new key with "Sign in with Apple" capability
4. Download the `.p8` key file
5. Add to Railway:
   ```bash
   APPLE_CLIENT_ID=your.bundle.id
   APPLE_TEAM_ID=ABC123 (from developer account)
   APPLE_KEY_ID=KEY123 (from key you created)
   APPLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n<paste key contents>\n-----END PRIVATE KEY-----"
   ```

---

## Step 6: Testing & Verification

### 6.1 Health Checks

```bash
# Backend health
curl https://your-api.railway.app/api/health

# Frontend (should load the homepage)
curl -I https://your-app.vercel.app
```

### 6.2 Test Full User Flow

1. **Go to frontend**: Open `https://your-app.vercel.app`
2. **Sign up**: Create a new account
3. **Browse restaurants**: Should see demo restaurants from seed data
4. **Make reservation**: Select date, time, party size
5. **Pre-order**: Add menu items to cart
6. **Payment**: Complete Stripe checkout (use test card: `4242 4242 4242 4242`)
7. **Check-in**: Use QR code or manual check-in
8. **Kitchen Dashboard**: Visit `/kitchen` to see order status
9. **Staff Portal**: Visit `/staff` to test staff features

### 6.3 Test WebSocket (Kitchen Dashboard)

1. Open Kitchen Dashboard: `https://your-app.vercel.app/kitchen`
2. In another tab, create a reservation and pre-order
3. Check-in to trigger kitchen ticket
4. Dashboard should update in real-time without refresh

---

## Step 7: Monitoring & Logging

### 7.1 Railway Logs

```bash
# Via Railway dashboard
- Go to your project → Deployments
- Click on a deployment to see logs
- Use the search/filter to find errors

# Via Railway CLI
railway logs
```

### 7.2 Vercel Logs

```bash
# Via Vercel dashboard
- Go to your project → Deployments
- Click on a deployment → View Function Logs

# Via Vercel CLI
vercel logs
```

### 7.3 Error Tracking (Recommended)

Add Sentry for production error tracking:

```bash
npm install @sentry/nextjs @sentry/node
```

Configure in `frontend/src/lib/sentry.ts` and `backend/src/lib/sentry.ts`

---

## Step 8: Continuous Deployment

### 8.1 Automatic Deployments

Both Vercel and Railway are configured for automatic deployments:

- **Push to `main` branch** → Deploys to production
- **Push to other branches** → Creates preview deployments (Vercel only)
- **Pull requests** → Automatic preview deployments

### 8.2 Deployment Workflow

```bash
# 1. Make changes locally
git checkout -b feature/new-feature
# ... make changes ...

# 2. Test locally
npm run dev

# 3. Commit and push
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# 4. Create pull request on GitHub
# Vercel will create a preview deployment

# 5. After review, merge to main
# Both Vercel and Railway will deploy automatically
```

---

## Troubleshooting

### Frontend can't connect to backend

**Symptom**: API calls fail with CORS or network errors

**Solutions**:
1. Verify `NEXT_PUBLIC_API_URL` in Vercel environment variables
2. Check Railway backend is running: `curl https://your-api.railway.app/api/health`
3. Verify `FRONTEND_URL` in Railway matches your Vercel URL exactly

### Database connection fails

**Symptom**: Backend logs show "Can't reach database server"

**Solutions**:
1. Verify `DATABASE_URL` includes `?sslmode=require`
2. Check Neon database is running (check Neon dashboard)
3. Verify database credentials are correct
4. Test connection locally:
   ```bash
   DATABASE_URL="your-connection-string" npm run db:generate
   ```

### Stripe payments fail

**Symptom**: Payment form doesn't load or payments don't process

**Solutions**:
1. Verify `STRIPE_PUBLISHABLE_KEY` in Vercel
2. Verify `STRIPE_SECRET_KEY` in Railway
3. Check Stripe webhook is configured correctly
4. Test in Stripe test mode first (use keys starting with `pk_test_` and `sk_test_`)
5. Check Railway logs for webhook errors

### TypeScript build errors

**Symptom**: Backend build fails with TypeScript errors

**Solutions**:
1. Make sure Prisma client is generated:
   ```bash
   cd backend
   npm run db:generate
   ```
2. Known issues (see `KNOWN_ISSUES.md`):
   - Some implicit `any` types need fixing
   - Error type assertions need updating
   - Stripe API version mismatch

**Quick fix**: Add to Railway environment:
```bash
SKIP_TYPE_CHECK=true
```

Then update `backend/package.json` build script:
```json
"build": "tsc --noEmit || true && tsc"
```

### WebSocket not working

**Symptom**: Kitchen dashboard doesn't update in real-time

**Solutions**:
1. Verify Railway supports WebSocket (it does by default)
2. Check browser console for WebSocket connection errors
3. Try accessing via `wss://your-api.railway.app` directly
4. Check firewall/network restrictions

---

## Performance Optimization

### 1. Enable Edge Functions (Vercel)

Update `frontend/next.config.ts`:

```typescript
export const config = {
  runtime: 'edge',
};
```

### 2. Database Connection Pooling

Add to Railway environment:

```bash
DATABASE_URL=postgresql://...?connection_limit=10&pool_timeout=10
```

### 3. Enable Caching

In `backend/src/index.ts`, add Redis caching layer (optional):

```bash
# Add to Railway
REDIS_URL=redis://...
```

---

## Security Checklist

- [ ] Use production Stripe keys (not test keys)
- [ ] JWT_SECRET is long and random (64+ characters)
- [ ] DATABASE_URL uses SSL (`?sslmode=require`)
- [ ] All environment variables are set in production
- [ ] Stripe webhook secret is configured
- [ ] CORS is configured correctly (FRONTEND_URL matches)
- [ ] Rate limiting is enabled (consider adding Redis-based rate limiting)
- [ ] Input validation is in place (Zod schemas in backend)
- [ ] SQL injection protection (using Prisma ORM)
- [ ] XSS protection (React's built-in escaping)
- [ ] HTTPS only (automatic on Vercel and Railway)

---

## Scaling Considerations

### Database (Neon)

- Neon auto-scales with serverless pricing
- Upgrade to paid plan for:
  - Higher connection limits
  - More compute units
  - Better performance

### Backend (Railway)

- Monitor memory and CPU usage
- Upgrade plan for:
  - More memory (1GB → 2GB → 4GB)
  - More CPU
  - Multiple replicas (horizontal scaling)

### Frontend (Vercel)

- Vercel scales automatically
- Consider adding CDN caching for static assets
- Use `next/image` for optimized images

---

## Cost Estimates (Monthly)

### Free Tier (Development)
- **Neon**: Free (500MB storage, 0.5 compute hours)
- **Railway**: $5 credit/month (usually enough for low traffic)
- **Vercel**: Free (unlimited deployments, 100GB bandwidth)
- **Total**: ~$0-5/month

### Production (Low Traffic - 1000 users/month)
- **Neon**: Free or $20/month
- **Railway**: $10-20/month
- **Vercel**: $20/month (Pro plan)
- **Stripe**: 2.9% + $0.30 per transaction
- **Total**: ~$30-60/month + transaction fees

### Production (High Traffic - 10,000+ users/month)
- **Neon**: $50-100/month
- **Railway**: $50-100/month
- **Vercel**: $20/month (Pro) or $300/month (Enterprise)
- **Stripe**: 2.9% + $0.30 per transaction
- **Total**: ~$120-500/month + transaction fees

---

## Next Steps

After deployment:

1. **Add custom domain**: Set up your own domain name
2. **Enable analytics**: Add Vercel Analytics or Google Analytics
3. **Set up monitoring**: Add Sentry or similar error tracking
4. **Configure backups**: Set up automated database backups in Neon
5. **Add status page**: Create a status.lacarta.com with Uptime Robot
6. **Performance testing**: Use Lighthouse to test and optimize
7. **Load testing**: Use k6 or Artillery to test under load

---

## Support Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Fastify Docs**: https://www.fastify.io/docs/
- **Prisma Docs**: https://www.prisma.io/docs/
- **Stripe Docs**: https://stripe.com/docs
- **Vercel Support**: https://vercel.com/support
- **Railway Docs**: https://docs.railway.app
- **Neon Docs**: https://neon.tech/docs

---

**Last Updated**: October 2025
**Version**: 1.0.0

For questions or issues, please check `TROUBLESHOOTING.md` or open a GitHub issue.
