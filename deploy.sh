#!/bin/bash

# La Carta - Automated Deployment Script
# This script helps you deploy to Vercel (frontend) and Railway (backend)

set -e  # Exit on error

echo "🚀 La Carta Deployment Script"
echo "=============================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if required CLIs are installed
check_cli() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}❌ $1 is not installed${NC}"
        echo "Install with: $2"
        return 1
    else
        echo -e "${GREEN}✅ $1 is installed${NC}"
        return 0
    fi
}

echo "📋 Checking prerequisites..."
echo ""

# Check for required CLIs
VERCEL_OK=false
RAILWAY_OK=false

if check_cli "vercel" "npm install -g vercel"; then
    VERCEL_OK=true
fi

if check_cli "railway" "npm install -g @railway/cli"; then
    RAILWAY_OK=true
fi

echo ""

if [ "$VERCEL_OK" = false ] || [ "$RAILWAY_OK" = false ]; then
    echo -e "${YELLOW}⚠️  Please install missing CLIs and run this script again${NC}"
    echo ""
    echo "Quick install:"
    echo "  npm install -g vercel @railway/cli"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites met!${NC}"
echo ""

# Ask user what they want to deploy
echo "What would you like to deploy?"
echo "1) Backend only (Railway)"
echo "2) Frontend only (Vercel)"
echo "3) Both (recommended)"
echo "4) Database setup only (Neon)"
read -p "Choose (1-4): " DEPLOY_CHOICE

echo ""

# Database setup
if [ "$DEPLOY_CHOICE" = "4" ] || [ "$DEPLOY_CHOICE" = "3" ]; then
    echo -e "${BLUE}📊 Database Setup${NC}"
    echo "================================"
    echo ""
    echo "1. Go to https://neon.tech"
    echo "2. Create a new project: 'lacarta-production'"
    echo "3. Copy your connection string"
    echo ""
    read -p "Paste your DATABASE_URL here: " DATABASE_URL

    if [ -z "$DATABASE_URL" ]; then
        echo -e "${RED}❌ DATABASE_URL is required${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Database URL saved${NC}"
    echo ""
fi

# Backend deployment
if [ "$DEPLOY_CHOICE" = "1" ] || [ "$DEPLOY_CHOICE" = "3" ]; then
    echo -e "${BLUE}🔧 Deploying Backend to Railway${NC}"
    echo "================================"
    echo ""

    # Check if logged in to Railway
    if ! railway whoami &> /dev/null; then
        echo "Logging in to Railway..."
        railway login
    fi

    cd backend

    # Initialize Railway project if needed
    if [ ! -f "railway.toml" ]; then
        echo "Initializing Railway project..."
        railway init
    fi

    # Set environment variables
    echo "Setting environment variables..."
    railway variables set DATABASE_URL="$DATABASE_URL"
    railway variables set NODE_ENV="production"
    railway variables set PORT="3001"

    # Generate JWT secret
    JWT_SECRET=$(openssl rand -hex 64)
    railway variables set JWT_SECRET="$JWT_SECRET"

    echo ""
    echo -e "${YELLOW}⚠️  You need to set these environment variables manually:${NC}"
    echo "  - STRIPE_SECRET_KEY"
    echo "  - STRIPE_PUBLISHABLE_KEY"
    echo "  - STRIPE_WEBHOOK_SECRET"
    echo "  - FRONTEND_URL (your Vercel URL)"
    echo ""
    echo "Run: railway variables set KEY=VALUE"
    echo ""
    read -p "Press Enter when ready to continue..."

    # Deploy
    echo "Deploying to Railway..."
    railway up

    # Get the URL
    RAILWAY_URL=$(railway domain)
    echo ""
    echo -e "${GREEN}✅ Backend deployed!${NC}"
    echo "URL: $RAILWAY_URL"
    echo ""

    cd ..
fi

# Frontend deployment
if [ "$DEPLOY_CHOICE" = "2" ] || [ "$DEPLOY_CHOICE" = "3" ]; then
    echo -e "${BLUE}🎨 Deploying Frontend to Vercel${NC}"
    echo "================================"
    echo ""

    cd frontend

    # Check if logged in to Vercel
    if ! vercel whoami &> /dev/null; then
        echo "Logging in to Vercel..."
        vercel login
    fi

    # Get backend URL if we just deployed it
    if [ -n "$RAILWAY_URL" ]; then
        BACKEND_URL="$RAILWAY_URL"
    else
        read -p "Enter your backend URL (Railway): " BACKEND_URL
    fi

    read -p "Enter your STRIPE_PUBLISHABLE_KEY: " STRIPE_KEY

    # Deploy to production
    echo "Deploying to Vercel..."
    vercel --prod \
        -e NEXT_PUBLIC_API_URL="$BACKEND_URL" \
        -e NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="$STRIPE_KEY"

    VERCEL_URL=$(vercel inspect --prod 2>&1 | grep "url:" | awk '{print $2}')

    echo ""
    echo -e "${GREEN}✅ Frontend deployed!${NC}"
    echo "URL: $VERCEL_URL"
    echo ""

    cd ..
fi

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Update Railway FRONTEND_URL to: $VERCEL_URL"
echo "2. Configure Stripe webhook: $BACKEND_URL/api/v1/payments/webhook"
echo "3. Run database migrations: railway run npm run db:push"
echo "4. Seed database: railway run npm run db:seed"
echo ""
echo "View your app:"
if [ -n "$VERCEL_URL" ]; then
    echo "  Frontend: $VERCEL_URL"
fi
if [ -n "$RAILWAY_URL" ]; then
    echo "  Backend: $RAILWAY_URL"
fi
echo ""
echo "For more details, see DEPLOYMENT_GUIDE.md"
