# 🚀 La Carta Deployment Guide

## Quick Deploy Options

### 1. Vercel (Frontend) + Railway (Backend) - Recommended
**Cost**: ~$5-20/month
**Time**: 15 minutes

#### Frontend (Vercel - Free):
1. Push your code to GitHub
2. Visit [vercel.com](https://vercel.com)
3. Import your GitHub repo
4. Select the `/frontend` directory
5. Deploy! You'll get a URL like: `lacarta.vercel.app`

#### Backend (Railway):
1. Visit [railway.app](https://railway.app)
2. Create new project → Deploy from GitHub
3. Select your repo and `/backend` directory
4. Add PostgreSQL database
5. Set environment variables from `.env`
6. Deploy! You'll get a URL like: `lacarta.up.railway.app`

### 2. Render.com (All-in-One)
**Cost**: Free tier available
**Time**: 20 minutes

1. Push to GitHub
2. Visit [render.com](https://render.com)
3. Create:
   - Web Service for backend
   - Static Site for frontend
   - PostgreSQL database
4. Connect GitHub repo
5. Auto-deploys on push!

### 3. Heroku (Traditional)
**Cost**: $7/month (Eco tier)
**Time**: 30 minutes

```bash
# Install Heroku CLI
brew install heroku/brew/heroku

# Login
heroku login

# Create apps
heroku create lacarta-app
heroku create lacarta-api

# Add database
heroku addons:create heroku-postgresql:mini -a lacarta-api

# Deploy
git push heroku main
```

## Environment Variables Needed

Create these in your deployment platform:

```env
# Backend
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
FRONTEND_URL=https://your-frontend-url.com

# Frontend
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NEXT_PUBLIC_WS_URL=wss://your-backend-url.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## Custom Domain Setup

1. Buy a domain (e.g., lacarta.app) from:
   - Namecheap (~$12/year)
   - Google Domains (~$12/year)
   - Cloudflare (~$9/year)

2. Point it to your deployment:
   - Add CNAME record: `www → your-app.vercel.app`
   - Add A record: `@ → Vercel's IP`

## Make It Restaurant-Ready

### Essential Features to Add:
1. **Payment Processing**: Connect real Stripe account
2. **SMS Notifications**: Add Twilio for reservation confirmations
3. **Email Service**: Use SendGrid for transactional emails
4. **Analytics**: Add Mixpanel or Segment
5. **Error Tracking**: Install Sentry

### Security Checklist:
- [ ] Change all default passwords
- [ ] Enable HTTPS everywhere
- [ ] Set up rate limiting
- [ ] Add CORS properly
- [ ] Implement proper authentication
- [ ] Regular database backups

## Quick Start Commands

```bash
# Prepare for deployment
npm run build
npm test

# Check everything works
npm run start:prod

# Deploy to Vercel (frontend)
cd frontend && vercel

# Deploy to Railway (backend)
railway up
```

## Support & Monitoring

1. **Uptime Monitoring**: Use UptimeRobot (free)
2. **Performance**: Connect Datadog or New Relic
3. **Logs**: Use LogTail or Papertrail
4. **Support**: Add Intercom or Crisp chat

---

## 🎉 You're Ready!

Once deployed, share your custom URL with friends:
- `https://lacarta.app` (or your chosen domain)

They can:
- Browse restaurants
- Make reservations
- Pre-order meals
- Pay in advance
- Get real-time updates

Need help? The deployment platforms above all have excellent documentation and support!