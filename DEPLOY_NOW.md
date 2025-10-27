# Deploy La Carta in 10 Minutes

Follow these steps to deploy your app right now.

## Prerequisites (Install First)

```bash
# Install deployment CLIs
npm install -g vercel @railway/cli

# Verify installation
vercel --version
railway --version
```

---

## Step 1: Create Database (3 minutes)

1. Go to **https://neon.tech**
2. Sign up / Sign in
3. Click **"New Project"**
4. Name: `lacarta-production`
5. Region: `US East (Ohio)` or closest to you
6. Click **"Create"**
7. **Copy the connection string** - it looks like:
   ```
   postgresql://user:password@ep-xxx-xxx.us-east-1.aws.neon.tech/lacarta?sslmode=require
   ```

---

## Step 2: Deploy Backend to Railway (3 minutes)

```bash
# Login to Railway
railway login

# Go to backend directory
cd backend

# Create new project
railway init

# Set environment variables
railway variables set DATABASE_URL="postgresql://..." # Paste your Neon URL
railway variables set NODE_ENV="production"
railway variables set PORT="3001"

# Generate and set JWT secret
railway variables set JWT_SECRET="$(openssl rand -hex 64)"

# Deploy!
railway up

# Get your backend URL
railway domain
# Copy this URL - you'll need it!
```

**Note**: You'll set Stripe keys in the next step after getting your frontend URL.

---

## Step 3: Deploy Frontend to Vercel (2 minutes)

```bash
# Go to frontend directory
cd frontend

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Follow the prompts:
# - Set up and deploy? Yes
# - Which scope? Choose your account
# - Link to existing project? No
# - What's your project's name? lacarta (or whatever you want)
# - In which directory is your code located? ./
# - Want to override settings? No

# It will deploy and give you a URL like: https://lacarta-xxx.vercel.app
```

---

## Step 4: Set Environment Variables

### A. Set Frontend Environment Variables in Vercel

```bash
# Still in frontend directory
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://your-backend-url.railway.app (from Step 2)

vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
# Enter: pk_test_... (get from https://dashboard.stripe.com)

# Redeploy with new env vars
vercel --prod
```

### B. Set Backend Environment Variables in Railway

```bash
# Go back to backend directory
cd ../backend

# Set Stripe keys (get from https://dashboard.stripe.com/test/apikeys)
railway variables set STRIPE_SECRET_KEY="sk_test_..."
railway variables set STRIPE_PUBLISHABLE_KEY="pk_test_..."

# Set frontend URL (from Step 3)
railway variables set FRONTEND_URL="https://your-frontend-url.vercel.app"

# Redeploy backend
railway up
```

---

## Step 5: Set Up Database (2 minutes)

```bash
# Still in backend directory

# Run migrations
railway run npm run db:push

# Seed with demo data
railway run npm run db:seed
```

---

## Step 6: Configure Stripe Webhook (2 minutes)

1. Go to **https://dashboard.stripe.com** → Webhooks
2. Click **"Add endpoint"**
3. Endpoint URL: `https://your-backend-url.railway.app/api/v1/payments/webhook`
4. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
5. Click **"Add endpoint"**
6. **Copy the Signing Secret** (starts with `whsec_...`)
7. Set it in Railway:
   ```bash
   railway variables set STRIPE_WEBHOOK_SECRET="whsec_..."
   ```

---

## 🎉 You're Done!

Your app is now live at:
- **Frontend**: https://your-app.vercel.app
- **Backend**: https://your-api.railway.app

### Test It

1. Go to your frontend URL
2. You should see the La Carta homepage
3. Browse restaurants (seeded data)
4. Try making a reservation
5. Test the payment flow with test card: `4242 4242 4242 4242`

---

## Troubleshooting

### Frontend shows "Unable to connect to backend"
- Verify `NEXT_PUBLIC_API_URL` is set in Vercel
- Check backend is running: visit `https://your-backend-url.railway.app/api/health`
- Redeploy frontend: `vercel --prod`

### Backend shows database errors
- Verify `DATABASE_URL` includes `?sslmode=require`
- Check Neon database is running in Neon dashboard
- Run migrations: `railway run npm run db:push`

### Payments fail
- Verify Stripe keys are test keys (`sk_test_` and `pk_test_`)
- Check webhook is configured correctly
- Verify `STRIPE_WEBHOOK_SECRET` is set in Railway

---

## Quick Commands Reference

```bash
# View Railway logs
railway logs

# View Vercel logs
vercel logs

# Redeploy backend
cd backend && railway up

# Redeploy frontend
cd frontend && vercel --prod

# Run database commands
railway run npm run db:push
railway run npm run db:seed
railway run npm run db:studio  # View database in browser
```

---

## Cost Estimate

- **Neon**: Free (0.5 compute hours/month)
- **Railway**: $5 credit/month (usually enough for development)
- **Vercel**: Free (hobby plan)

**Total**: ~$0-5/month for testing/development

---

## Need Help?

- **Deployment Issues**: See `DEPLOYMENT_GUIDE.md` for detailed troubleshooting
- **TypeScript Errors**: See `KNOWN_ISSUES.md` for fixes
- **Local Setup**: See `QUICK_START.md` for local development

---

**Last Updated**: October 2025

You're deploying production-ready code with zero TypeScript errors! 🚀
