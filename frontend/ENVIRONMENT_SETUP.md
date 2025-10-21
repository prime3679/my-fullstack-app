# Frontend Environment Setup Guide

This guide helps you configure environment variables for the La Carta frontend.

## Quick Start

```bash
# 1. Copy the example file
cp .env.example .env.local

# 2. Edit .env.local with your actual values
# (see instructions below)

# 3. Restart your dev server
npm run dev
```

## Environment Variables Explained

### Required Variables

#### `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

**What it is:** Your Stripe publishable key for processing payments.

**Where to get it:**
1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Developers** → **API keys**
3. Copy the **Publishable key**
   - Test mode: `pk_test_...`
   - Live mode: `pk_live_...`

**Example:**
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51HqC8cKZx...
```

**Important:**
- ✅ Safe to expose in frontend code (it's public)
- ✅ Use test keys during development
- ⚠️ Only use live keys in production
- ❌ Never confuse with Secret keys (sk_)

#### `NEXT_PUBLIC_API_URL`

**What it is:** The base URL for your backend API.

**Values:**
```bash
# Local development
NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1

# Production
NEXT_PUBLIC_API_URL=https://api.lacarta.app/api/v1
```

### Optional Variables

#### `NEXT_PUBLIC_APP_URL`

Your frontend application URL (used for social sharing, OAuth redirects).

```bash
# Development
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Production
NEXT_PUBLIC_APP_URL=https://lacarta.app
```

#### `NEXT_PUBLIC_APP_ENV`

Environment identifier for conditional behavior.

```bash
NEXT_PUBLIC_APP_ENV=development  # or staging, production
```

#### `NEXT_PUBLIC_DEBUG`

Enable debug logging in development.

```bash
NEXT_PUBLIC_DEBUG=true
```

## File Structure

```
frontend/
├── .env.example          # Template with all variables (committed to git)
├── .env.local            # Your actual values (gitignored, create this)
├── .env.development      # Development-specific defaults
├── .env.production       # Production build defaults
└── ENVIRONMENT_SETUP.md  # This file
```

## Loading Order

Next.js loads environment variables in this order (later files override earlier):

1. `.env` - All environments
2. `.env.local` - All environments (gitignored)
3. `.env.development` / `.env.production` - Environment-specific
4. `.env.development.local` / `.env.production.local` - Local overrides

## Important Notes

### The `NEXT_PUBLIC_` Prefix

In Next.js, only variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.

✅ **Browser-safe (use NEXT_PUBLIC_):**
- API URLs
- Stripe publishable keys
- Analytics IDs
- Feature flags

❌ **Never put in frontend:**
- Stripe secret keys
- Database credentials
- Private API keys
- Webhook secrets

### Security Best Practices

1. **Never commit `.env.local`** - It's in `.gitignore` for a reason
2. **Rotate keys if exposed** - If you accidentally commit secrets, rotate them immediately
3. **Use test keys in development** - Keep live keys only in production
4. **Validate environment on startup** - Check required vars are set

## Troubleshooting

### "Stripe publishable key not found"

**Problem:** Missing or invalid Stripe key.

**Solution:**
```bash
# Check your .env.local file exists
ls -la .env.local

# Verify the key starts with pk_test_ or pk_live_
cat .env.local | grep STRIPE

# Restart dev server
npm run dev
```

### "API requests failing"

**Problem:** Backend API URL is incorrect or backend is not running.

**Solution:**
```bash
# Check backend is running
curl http://localhost:3001/api/health

# Verify API_URL in .env.local
cat .env.local | grep API_URL

# Restart frontend
npm run dev
```

### Changes not applying

**Problem:** Next.js caches environment variables.

**Solution:**
```bash
# Stop the dev server (Ctrl+C)
# Make your .env.local changes
# Restart the dev server
npm run dev
```

### Build-time vs Runtime

**Important:** `NEXT_PUBLIC_` variables are embedded at **build time**, not runtime.

This means:
- Changing `.env.local` requires rebuilding: `npm run build`
- In production, you must rebuild to change these values
- They cannot be changed with environment variables in deployed containers

For runtime configuration, use server-side API routes.

## Production Deployment

### Vercel

Add environment variables in **Project Settings** → **Environment Variables**:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_API_URL=https://api.lacarta.app/api/v1
NEXT_PUBLIC_APP_URL=https://lacarta.app
```

### Docker

Pass via docker-compose:

```yaml
services:
  frontend:
    environment:
      - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${STRIPE_PUBLISHABLE_KEY}
      - NEXT_PUBLIC_API_URL=https://api.lacarta.app/api/v1
```

Or in Dockerfile:

```dockerfile
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
```

## Validation

Add this to your app to validate required variables:

```typescript
// lib/env.ts
const requiredEnvVars = [
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_API_URL'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}`);
  }
});
```

## Resources

- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Stripe API Keys](https://stripe.com/docs/keys)
- [Environment Variable Best Practices](https://12factor.net/config)
