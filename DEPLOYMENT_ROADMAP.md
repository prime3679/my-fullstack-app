# La Carta - Deployment & Feature Roadmap

**Status:** 65-70% of PRD Vision Complete
**Core Features:** 85% Complete | **Advanced Features:** 30% Complete
**Deployment Target:** Replit
**Last Updated:** October 27, 2025

---

## Executive Summary

La Carta has a **solid, production-ready foundation** for the core reservation → pre-order → payment → kitchen flow. The next phase focuses on:

1. **Deployment to Replit** (Week 1-2)
2. **Revenue-generating AI features** (Week 3-6)
3. **Operational efficiency** via POS integrations (Week 7-10)
4. **Customer retention** via loyalty & communications (Week 11-14)

---

## Phase 0: Replit Deployment Setup (Week 1-2)

### Objective
Deploy La Carta to Replit with full backend + frontend + database functionality.

### Tasks

#### 1.1 Backend Deployment Configuration
- [ ] Create `.replit` configuration file
- [ ] Set up `replit.nix` for Node.js + PostgreSQL
- [ ] Configure environment variables in Replit Secrets:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY`
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - `APPLE_CLIENT_ID` / `APPLE_CLIENT_SECRET`
  - `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS`
- [ ] Update backend start script for Replit port binding (use `0.0.0.0`)
- [ ] Add health check endpoint monitoring

#### 1.2 Database Setup
- [ ] Provision PostgreSQL database (Replit Postgres or external Neon/Supabase)
- [ ] Run Prisma migrations: `npx prisma migrate deploy`
- [ ] Seed database with demo data: `npm run db:seed`
- [ ] Verify database connectivity via `/api/health` endpoint

#### 1.3 Frontend Deployment
- [ ] Configure Next.js for Replit hosting
- [ ] Update `NEXT_PUBLIC_API_URL` environment variable to Replit backend URL
- [ ] Test frontend build: `npm run build`
- [ ] Configure rewrites for API proxy if needed

#### 1.4 Concurrent Dev Setup
- [ ] Ensure `npm run dev` starts both frontend + backend concurrently
- [ ] Configure Replit ports (3000 for frontend, 3001 for backend)
- [ ] Test WebSocket connections on Replit environment
- [ ] Verify Stripe webhook endpoint is publicly accessible

#### 1.5 Testing & Monitoring
- [ ] Run full end-to-end test:
  - Signup → Login
  - Browse restaurants → Make reservation
  - Pre-order menu items → Payment
  - Check-in → Kitchen dashboard updates
- [ ] Set up basic error logging (consider Sentry or LogRocket)
- [ ] Monitor performance (response times, WebSocket latency)

**Success Criteria:**
- La Carta fully operational on Replit
- All core flows working (reservation, payment, kitchen)
- No downtime during deployment

---

## Phase 1: AI-Powered Personalization (Week 3-6)

### Objective
Implement AI-driven menu recommendations and upsells to increase average check size by 15%.

### 1.1 Menu Item Embeddings (Week 3)
- [ ] Generate embeddings for all menu items using OpenAI/Cohere API
- [ ] Store embeddings in `Embedding` table (schema already exists)
- [ ] Index embeddings for fast similarity search (pgvector)
- [ ] Create embedding update pipeline for new menu items

**Tech Stack:** OpenAI Embeddings API, pgvector PostgreSQL extension

#### 1.2 Personalized Recommendations (Week 4)
- [ ] Build recommendation engine service (`/backend/src/services/recommendationService.ts`)
- [ ] Implement recommendation logic:
  - Past order history (favorited items)
  - Dietary preferences (allergens, dietary tags)
  - Similar item embeddings (cosine similarity)
  - Popular items at restaurant
- [ ] Create API endpoint: `GET /api/recommendations/:restaurantId`
- [ ] Frontend: Display "You might like" section in menu

**Algorithm:**
```
score = 0.4 * past_order_score + 0.3 * dietary_match_score + 0.2 * embedding_similarity + 0.1 * popularity_score
```

#### 1.3 AI Upsell Suggestions (Week 5)
- [ ] Integrate LLM (GPT-4 or Claude) for upsell generation
- [ ] Create upsell prompt templates with safety rules:
  - Respect dietary restrictions
  - Stay within budget (+20% max)
  - Focus on pairings (wine, appetizers, desserts)
- [ ] API endpoint: `POST /api/upsells` (input: current cart, output: suggestions)
- [ ] Frontend: Display upsells during checkout
- [ ] A/B test upsell copy

**Example Prompt:**
```
Given the user's current order: [Ribeye Steak, Caesar Salad],
suggest 2 complementary items from the menu that:
1. Pair well with steak
2. User has no allergies to: [dairy, gluten]
3. Total addition < $30

Format: JSON with item, reason, price
```

#### 1.4 ETA Predictions with ML (Week 6)
- [ ] Collect historical kitchen ticket data (prep times by item)
- [ ] Train gradient boosting model (XGBoost/LightGBM) to predict prep time
- [ ] Features: item complexity, modifiers, kitchen load, time of day, staff count
- [ ] Deploy model to backend (ONNX or pickle)
- [ ] Update kitchen ticket fire time with ML predictions
- [ ] Monitor prediction accuracy (MAE < 5 minutes)

**Success Metrics:**
- 15% increase in average check size
- 40% of users accept at least one recommendation
- NPS improvement from upsells (+5 points)

---

## Phase 2: Complete POS Integrations (Week 7-10)

### Objective
Seamlessly sync menus and inject orders into Square/Toast POS systems.

### 2.1 Square POS Integration (Week 7-8)

#### Implement Menu Sync
- [ ] Complete `syncMenuFromSquare()` in `/backend/src/integrations/square.ts`
- [ ] API call: `GET /v2/catalog/list` (Square Catalog API)
- [ ] Map Square catalog to La Carta menu items:
  - CatalogItem → MenuItem
  - CatalogModifierList → ModifierGroup
  - CatalogModifier → Modifier
- [ ] Handle item variations (sizes, prices)
- [ ] Detect menu changes (new items, 86'd items, price changes)
- [ ] Schedule sync: Every 15 minutes via cron job

#### Implement Order Injection
- [ ] Complete `injectOrderToSquare()` in `/backend/src/integrations/square.ts`
- [ ] API call: `POST /v2/orders` (Square Orders API)
- [ ] Map PreOrder + PreOrderItems to Square order format
- [ ] Include modifiers, special instructions, customer info
- [ ] Handle order status callbacks (accepted, in-progress, ready)
- [ ] Retry logic for failed injections (3 retries with exponential backoff)

#### OAuth & Token Management
- [ ] Implement Square OAuth flow (`/api/pos/square/oauth`)
- [ ] Store access tokens securely (encrypted in database)
- [ ] Implement token refresh logic (tokens expire every 30 days)
- [ ] Handle authorization errors gracefully

**Endpoint:**
```
POST /api/pos/square/inject-order
Body: { preOrderId, locationId }
Response: { success, squareOrderId, status }
```

### 2.2 Toast POS Integration (Week 9-10)

#### Implement Menu Sync
- [ ] Complete `syncMenuFromToast()` in `/backend/src/integrations/toast.ts`
- [ ] API call: `GET /v2/menus` (Toast Menus API)
- [ ] Map Toast menu to La Carta format
- [ ] Handle menu item availability (Toast uses `isSuspended`)
- [ ] Schedule sync: Every 15 minutes

#### Implement Order Injection
- [ ] Complete `injectOrderToToast()` in `/backend/src/integrations/toast.ts`
- [ ] API call: `POST /v2/orders` (Toast Orders API)
- [ ] Map PreOrder to Toast order format
- [ ] Send check modifications (add items to existing checks)
- [ ] Handle order callbacks (sent to kitchen, fulfilled)

#### Testing
- [ ] Set up Square sandbox account
- [ ] Set up Toast sandbox account
- [ ] Test menu sync with 100+ item menus
- [ ] Test order injection during peak load (20+ orders/minute)
- [ ] Monitor error rates and retry success

**Success Metrics:**
- 100% menu sync accuracy
- < 5 second order injection latency
- 99.9% order injection success rate
- Zero duplicate orders

---

## Phase 3: Loyalty & Guest Communications (Week 11-14)

### Objective
Build loyalty program to drive repeat visits and improve customer retention by 30%.

### 3.1 Loyalty System (Week 11-12)

#### Point Earning Logic
- [ ] Implement loyalty service (`/backend/src/services/loyaltyService.ts`)
- [ ] Award points on payment completion:
  - 1 point per $1 spent
  - Bonus points for first visit (100 points)
  - Bonus points for referrals (200 points)
- [ ] Update `LoyaltyAccount` table on payment webhook
- [ ] Create API: `GET /api/loyalty/:userId`

#### Tier System
- [ ] Define tiers:
  - Bronze: 0-499 points
  - Silver: 500-999 points
  - Gold: 1000+ points
- [ ] Tier benefits:
  - Bronze: 5% off
  - Silver: 10% off + priority reservations
  - Gold: 15% off + free appetizer + exclusive menu access
- [ ] Auto-upgrade users when threshold reached
- [ ] Send tier upgrade email

#### Point Redemption
- [ ] Create redemption API: `POST /api/loyalty/redeem`
- [ ] Redemption options:
  - 100 points = $5 discount
  - 500 points = Free appetizer
  - 1000 points = $50 off
- [ ] Apply discounts to `PreOrder` pricing
- [ ] Track redemption history

#### Frontend
- [ ] Loyalty dashboard page (`/frontend/src/app/loyalty/page.tsx`)
- [ ] Display: current points, tier, benefits, redemption options
- [ ] Show points history (earned, redeemed)
- [ ] Gamification: progress bar to next tier

**Database Updates:**
```prisma
model LoyaltyAccount {
  id            String   @id @default(cuid())
  userId        String   @unique
  restaurantId  String
  currentPoints Int      @default(0)
  lifetimePoints Int     @default(0)
  tier          String   @default("BRONZE") // BRONZE, SILVER, GOLD
  tierExpiry    DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user          User       @relation(fields: [userId], references: [id])
  restaurant    Restaurant @relation(fields: [restaurantId], references: [id])
  transactions  LoyaltyTransaction[]
}

model LoyaltyTransaction {
  id          String   @id @default(cuid())
  accountId   String
  points      Int      // positive for earn, negative for redeem
  type        String   // EARNED, REDEEMED, EXPIRED, BONUS
  reason      String   // "Purchase", "Referral", "Birthday", etc.
  orderId     String?
  createdAt   DateTime @default(now())

  account     LoyaltyAccount @relation(fields: [accountId], references: [id])
}
```

### 3.2 Guest Email Communications (Week 13)

#### Reservation Confirmation
- [ ] Send email immediately after reservation created
- [ ] Include:
  - Reservation details (date, time, party size, restaurant)
  - QR code for check-in
  - Link to modify/cancel reservation
  - Pre-order menu link
- [ ] Template: `/backend/src/templates/email/reservation-confirmation.hbs`

#### Reminder Emails
- [ ] Schedule reminder emails:
  - 24 hours before: "Your reservation is tomorrow"
  - 1 hour before: "See you soon! Here's your QR code"
- [ ] Use job queue (Bull + Redis) for scheduling
- [ ] Include weather, parking tips, dress code

#### Post-Dining Follow-Up
- [ ] Send 6 hours after check-in completed
- [ ] Request feedback (NPS survey)
- [ ] Display loyalty points earned
- [ ] Suggest booking next visit
- [ ] Personalized recommendations based on order

#### Kitchen Status Updates (Optional)
- [ ] Send SMS when:
  - Order received by kitchen (10 min before arrival)
  - Food ready (at check-in)
- [ ] Requires Twilio integration

**Email Schedule:**
```
Reservation Created → [Immediate] Confirmation Email
                   ↓
              24h before → Reminder #1
                   ↓
               1h before → Reminder #2 + QR Code
                   ↓
          Check-in Complete → [6h later] Feedback Survey
```

### 3.3 Reservation Modifications (Week 14)

#### Cancellation Flow
- [ ] API: `POST /api/reservations/:id/cancel`
- [ ] Cancellation policies:
  - > 24h before: Full refund
  - 12-24h: 50% refund
  - < 12h: No refund
- [ ] Update reservation status to `CANCELLED`
- [ ] Trigger Stripe refund
- [ ] Send cancellation confirmation email
- [ ] Free up table inventory

#### Modification Flow
- [ ] API: `PATCH /api/reservations/:id`
- [ ] Allow changes: party size, time (within same day), special requests
- [ ] Check new time availability
- [ ] Send modification confirmation email
- [ ] Update kitchen ticket if pre-order affected

#### Waiting List
- [ ] API: `POST /api/waitlist`
- [ ] Store waitlist entries with phone number
- [ ] Send SMS when table available (Twilio)
- [ ] 15-minute claim window
- [ ] Automatically convert to reservation

**Success Metrics:**
- 30% repeat visit rate (loyalty program impact)
- 70+ NPS score
- < 5% no-show rate (reminder emails)
- 40% loyalty program enrollment

---

## Phase 4: Admin Analytics & Operations (Week 15-18)

### Objective
Provide restaurant owners with actionable business intelligence.

### 4.1 Analytics Dashboard (Week 15-16)

#### Key Metrics
- [ ] Create analytics service (`/backend/src/services/analyticsService.ts`)
- [ ] Calculate KPIs:
  - **Revenue:** Daily, weekly, monthly totals
  - **Table Turn Time:** Average time from check-in to completion
  - **Average Check Size:** Total revenue / # orders
  - **Reservation Conversion:** Reservations → checked-in → completed
  - **No-Show Rate:** Cancelled + no-shows / total reservations
  - **Peak Hours:** Heatmap of busiest times
  - **Popular Items:** Top 10 menu items by quantity sold
  - **Staff Performance:** Orders per hour, average prep time

#### API Endpoints
- [ ] `GET /api/analytics/dashboard?restaurantId=&dateRange=`
- [ ] `GET /api/analytics/revenue?restaurantId=&dateRange=`
- [ ] `GET /api/analytics/menu-performance?restaurantId=`
- [ ] `GET /api/analytics/reservations?restaurantId=&dateRange=`

#### Frontend Dashboard
- [ ] Admin dashboard page (`/frontend/src/app/admin/analytics/page.tsx`)
- [ ] Charts library (Recharts or Chart.js)
- [ ] Visualizations:
  - Line chart: Revenue over time
  - Bar chart: Top menu items
  - Heatmap: Peak reservation times
  - Pie chart: Reservation status breakdown
- [ ] Date range picker (today, last 7 days, last 30 days, custom)
- [ ] Export to CSV

**Example Query:**
```sql
-- Average table turn time
SELECT
  AVG(EXTRACT(EPOCH FROM (r.updatedAt - ci.checkedInAt)) / 60) AS avg_turn_time_minutes
FROM "Reservation" r
JOIN "CheckIn" ci ON ci."reservationId" = r.id
WHERE r."restaurantId" = $1
  AND r.status = 'COMPLETED'
  AND ci."checkedInAt" > NOW() - INTERVAL '30 days';
```

### 4.2 Operational Reports (Week 17)

#### Daily Operations Report
- [ ] Scheduled email at 6 AM daily
- [ ] Include:
  - Today's reservations (count, party size total)
  - Staff scheduled
  - Popular items expected (based on pre-orders)
  - Inventory alerts (86'd items)
  - Yesterday's revenue summary
- [ ] Template: `/backend/src/templates/email/daily-operations.hbs`

#### Weekly Performance Report
- [ ] Scheduled email every Monday
- [ ] Include:
  - Week-over-week revenue comparison
  - Top performing menu items
  - Staff performance summary
  - Customer feedback highlights (NPS scores)
  - Recommendations for improvement

#### Real-Time Alerts
- [ ] Alert triggers:
  - Kitchen ticket taking > 2x expected prep time
  - Revenue < 50% of daily target by 8 PM
  - No-show rate > 10%
  - Low inventory on popular items
- [ ] Send via email + SMS (Twilio)

### 4.3 Advanced Features (Week 18)

#### Cohort Analysis
- [ ] Track user cohorts by signup month
- [ ] Metrics: retention rate, lifetime value, repeat visit rate
- [ ] Visualization: Cohort retention matrix

#### Menu Engineering
- [ ] Classify menu items by profitability + popularity:
  - **Stars:** High profit, high popularity (promote)
  - **Plow Horses:** Low profit, high popularity (increase price)
  - **Puzzles:** High profit, low popularity (remarket)
  - **Dogs:** Low profit, low popularity (remove)
- [ ] Recommend menu changes

#### Predictive Analytics
- [ ] Forecast revenue for next 7/30 days
- [ ] Predict peak hours based on historical data
- [ ] Recommend optimal table inventory

**Success Metrics:**
- Restaurant managers use dashboard 5+ times per week
- 20% reduction in table turn time (operational insights)
- 10% increase in revenue from menu optimization

---

## Phase 5: Mobile PWA & Polish (Week 19-22)

### Objective
Create a best-in-class mobile experience with offline support.

### 5.1 Progressive Web App (Week 19-20)

#### Service Worker
- [ ] Set up Next.js PWA plugin
- [ ] Create service worker for offline caching
- [ ] Cache strategies:
  - **Static assets:** Cache-first (HTML, CSS, JS, images)
  - **API calls:** Network-first with fallback
  - **Menu data:** Stale-while-revalidate
- [ ] Offline fallback page

#### Install Prompt
- [ ] Detect PWA install eligibility
- [ ] Show custom install banner
- [ ] Track install analytics

#### Push Notifications
- [ ] Register for push notifications (Web Push API)
- [ ] Backend: Send notifications via Firebase Cloud Messaging (FCM)
- [ ] Notification triggers:
  - Reservation reminder (1 hour before)
  - Kitchen ready (your food is ready!)
  - Loyalty tier upgrade
  - Exclusive offers

#### Manifest Configuration
```json
{
  "name": "La Carta",
  "short_name": "La Carta",
  "description": "Dinner, accelerated to delight",
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "display": "standalone",
  "start_url": "/",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### 5.2 Mobile Optimizations (Week 21)

#### Performance
- [ ] Lazy load images (Next.js Image component)
- [ ] Code splitting by route
- [ ] Prefetch critical routes
- [ ] Optimize bundle size (< 200kb initial JS)
- [ ] Lighthouse score > 90

#### UX Improvements
- [ ] Bottom navigation for mobile
- [ ] Swipe gestures (swipe to refresh, swipe to delete cart items)
- [ ] Haptic feedback (vibration on actions)
- [ ] Biometric authentication (Face ID, Touch ID via WebAuthn)
- [ ] Dark mode support

#### Deep Linking
- [ ] Universal links for iOS
- [ ] App links for Android
- [ ] Link formats:
  - `lacarta.com/r/:reservationId` → Open reservation details
  - `lacarta.com/menu/:restaurantId` → Open menu
  - `lacarta.com/checkin/:reservationId` → Open check-in page

### 5.3 Compliance & Security Audit (Week 22)

#### WCAG 2.1 AA Compliance
- [ ] Keyboard navigation support
- [ ] Screen reader testing (NVDA, VoiceOver)
- [ ] Color contrast ratios (4.5:1 minimum)
- [ ] Alt text for all images
- [ ] ARIA labels for interactive elements

#### GDPR Compliance
- [ ] Cookie consent banner
- [ ] Privacy policy page
- [ ] Data export API: `GET /api/users/:id/export` (JSON download)
- [ ] Account deletion API: `DELETE /api/users/:id`
- [ ] Consent management (marketing emails, analytics tracking)

#### Security Hardening
- [ ] Rate limiting (express-rate-limit)
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] XSS protection (Content Security Policy headers)
- [ ] CSRF tokens for state-changing operations
- [ ] HTTPS enforcement
- [ ] Security headers (helmet.js already configured)
- [ ] Dependency vulnerability scan (npm audit)

**Success Metrics:**
- 50%+ mobile users install PWA
- Lighthouse performance score > 90
- Zero critical security vulnerabilities
- WCAG 2.1 AA compliance certification

---

## Phase 6: Scale & Optimize (Week 23-26)

### Objective
Prepare La Carta for 100+ restaurants and 10,000+ daily orders.

### 6.1 Performance Optimization (Week 23)

#### Database
- [ ] Add database indexes for common queries
- [ ] Implement query result caching (Redis)
- [ ] Connection pooling optimization (Prisma connection limit)
- [ ] Partition large tables (Reservation, Event, AuditLog)
- [ ] Archive old data (> 1 year) to cold storage

#### API
- [ ] Implement response caching (Redis)
- [ ] GraphQL DataLoader for N+1 query prevention
- [ ] Compress API responses (gzip)
- [ ] CDN for static assets (Cloudflare)
- [ ] Lazy load non-critical data

#### Monitoring
- [ ] Set up APM (Application Performance Monitoring) with New Relic or Datadog
- [ ] Monitor key metrics:
  - API response times (P50, P95, P99)
  - Database query times
  - WebSocket connection count
  - Error rates
  - Memory usage
- [ ] Set up alerts for anomalies

### 6.2 Multi-Location Chain Management (Week 24)

#### Chain-Wide Features
- [ ] Corporate admin dashboard
- [ ] Chain-level analytics (aggregate across locations)
- [ ] Menu template system:
  - Create master menu
  - Clone to all locations
  - Allow location-specific customizations
- [ ] Centralized pricing management
- [ ] Staff cross-location assignments

#### API Updates
- [ ] `GET /api/chain/:chainId/analytics`
- [ ] `POST /api/chain/:chainId/menu-template`
- [ ] `GET /api/chain/:chainId/locations`

#### Frontend
- [ ] Location switcher in navigation
- [ ] Chain admin portal (`/admin/chain`)
- [ ] Location comparison dashboard

### 6.3 Advanced Kitchen Pacing (Week 25)

#### ML-Based Prep Time Prediction
- [ ] Collect training data:
  - Historical prep times
  - Item complexity (# modifiers)
  - Kitchen load (concurrent tickets)
  - Staff count
  - Time of day
- [ ] Train XGBoost model
- [ ] Deploy model to backend
- [ ] Real-time predictions for fire times
- [ ] A/B test: ML predictions vs. static prep times

#### Multi-Course Pacing
- [ ] Detect courses in pre-order (appetizer, entree, dessert)
- [ ] Fire courses with delays:
  - Appetizers: Fire at check-in
  - Entrees: Fire after appetizers ready + 10 min
  - Desserts: Fire after entrees cleared
- [ ] Kitchen dashboard: Show course status

#### Kitchen Load Balancing
- [ ] Detect kitchen capacity (max concurrent tickets)
- [ ] Hold tickets if kitchen overloaded
- [ ] Dynamic ETA adjustments
- [ ] Alert staff when falling behind

**Algorithm:**
```python
def calculate_fire_time(ticket, kitchen_state):
    base_prep_time = ml_model.predict(ticket)
    load_factor = kitchen_state.active_tickets / kitchen_state.capacity
    adjusted_time = base_prep_time * (1 + load_factor * 0.3)
    fire_time = check_in_time + target_serve_time - adjusted_time
    return fire_time
```

### 6.4 Testing & QA (Week 26)

#### Backend Tests
- [ ] Expand unit tests (services, utilities)
- [ ] Integration tests (API endpoints)
- [ ] Load tests (k6 or Artillery):
  - 100 concurrent users
  - 1000 requests/second
  - WebSocket connections (100+ simultaneous)
- [ ] Target: P95 response time < 200ms

#### Frontend Tests
- [ ] Unit tests (components with Vitest)
- [ ] E2E tests (Playwright):
  - Complete user journey (signup → reservation → payment → check-in)
  - Mobile responsiveness
  - Offline mode
- [ ] Visual regression tests (Percy or Chromatic)

#### Security Tests
- [ ] Penetration testing (OWASP ZAP)
- [ ] Vulnerability scanning (Snyk)
- [ ] Dependency audit (npm audit fix)

**Success Metrics:**
- P95 API response time < 200ms
- 99.9% uptime
- Test coverage > 80%
- Zero critical vulnerabilities

---

## Quick Wins (Parallel to Phases 1-6)

These can be completed in 1-2 weeks and provide immediate value.

### 1. SMS Verification (Week 3)
- [ ] Integrate Twilio for SMS
- [ ] Send verification codes in `/api/auth/signup-phone`
- [ ] Verify codes in `/api/auth/verify-phone`

### 2. Email Unsubscribe Management (Week 4)
- [ ] Add `emailPreferences` to User model (marketing, transactional)
- [ ] Create unsubscribe page (`/unsubscribe?token=`)
- [ ] Add unsubscribe links to all marketing emails
- [ ] API: `POST /api/users/email-preferences`

### 3. Email Job Queue (Week 5)
- [ ] Set up Bull queue with Redis
- [ ] Move email sending to async jobs
- [ ] Schedule delayed emails (reminders, follow-ups)
- [ ] Monitor job failures

### 4. TypeScript Strict Mode (Week 6)
- [ ] Enable `strict: true` in tsconfig.json
- [ ] Fix any type errors
- [ ] Remove any types in WebSocket manager
- [ ] Add return type annotations

### 5. API Documentation (Week 7)
- [ ] Generate OpenAPI/Swagger docs
- [ ] Host at `/api/docs`
- [ ] Include request/response examples
- [ ] Authentication instructions

### 6. Error Tracking (Week 8)
- [ ] Integrate Sentry for error monitoring
- [ ] Track frontend errors
- [ ] Track backend exceptions
- [ ] Set up alerts for critical errors

---

## Success Metrics by Phase

| Phase | Key Metrics | Target |
|-------|-------------|--------|
| **Phase 0: Deployment** | Uptime | 99.9% |
| | Response time (P95) | < 500ms |
| **Phase 1: AI** | Average check size increase | +15% |
| | Recommendation acceptance | 40% |
| **Phase 2: POS** | Order injection success rate | 99.9% |
| | Menu sync accuracy | 100% |
| **Phase 3: Loyalty** | Repeat visit rate | 30% |
| | NPS score | 70+ |
| | Loyalty enrollment | 40% |
| **Phase 4: Analytics** | Dashboard usage (weekly) | 5+ times |
| | Table turn time reduction | 20% |
| **Phase 5: Mobile** | PWA install rate | 50% |
| | Lighthouse score | 90+ |
| **Phase 6: Scale** | P95 response time | < 200ms |
| | Test coverage | 80%+ |

---

## Resource Requirements

### Development Team (Recommended)
- **Full-Stack Engineer (x1):** API + frontend + integrations
- **ML Engineer (x0.5):** AI recommendations + ETA predictions
- **DevOps Engineer (x0.25):** Deployment + monitoring
- **QA Engineer (x0.25):** Testing + security audit

### External Services & Costs
- **Replit:** $20/month (Pro plan for deployments)
- **PostgreSQL Database:** $10-25/month (Neon/Supabase)
- **Stripe:** 2.9% + $0.30 per transaction
- **OpenAI API:** ~$50/month (embeddings + upsells)
- **Twilio SMS:** $0.0075 per SMS
- **Redis:** $10/month (Upstash or Redis Cloud)
- **Email (SMTP):** Free tier (Resend/SendGrid) or $10/month
- **Error Tracking (Sentry):** Free tier or $26/month
- **Total:** ~$150-200/month

---

## Risk Mitigation

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| **Replit downtime** | High | Deploy backend to backup (Railway, Render) |
| **Database performance** | Medium | Implement caching (Redis), optimize queries |
| **Stripe API failures** | High | Retry logic, payment status reconciliation |
| **POS integration errors** | Medium | Fallback to manual order entry |
| **AI hallucinations (upsells)** | Low | Strict prompt engineering, human review |

### Business Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| **Low restaurant adoption** | High | Freemium model, onboarding support |
| **Customer privacy concerns** | Medium | GDPR compliance, transparent data usage |
| **Competition (OpenTable, Resy)** | High | Focus on unique value: pre-order + payment |
| **High payment processing fees** | Medium | Volume discounts with Stripe |

---

## Next Steps

### Immediate Actions (This Week)
1. **Set up Replit environment** (create `.replit`, `replit.nix`)
2. **Provision PostgreSQL database** (Neon or Replit Postgres)
3. **Configure environment variables** in Replit Secrets
4. **Deploy backend + frontend** to Replit
5. **Test end-to-end flow** (reservation → payment → kitchen)

### First 30 Days
1. Complete **Phase 0: Replit Deployment**
2. Begin **Phase 1: AI Personalization** (embeddings + recommendations)
3. Complete **Quick Win: SMS Verification**
4. Set up error tracking (Sentry)

### First 90 Days
1. Complete Phases 1-3 (AI, POS, Loyalty)
2. Launch with 3-5 pilot restaurants
3. Gather feedback and iterate
4. Achieve 70+ NPS score

---

## Conclusion

La Carta has a **rock-solid foundation** with 65-70% of the PRD vision complete. The next 26 weeks focus on:

1. **Deployment** (Replit + production-ready infrastructure)
2. **Revenue optimization** (AI upsells + loyalty)
3. **Operational efficiency** (POS integrations + analytics)
4. **User experience** (mobile PWA + communications)
5. **Scale** (performance + multi-location)

The roadmap is designed for **iterative delivery**, with each phase producing tangible business value. By Week 26, La Carta will be a best-in-class hospitality platform ready for 100+ restaurants and 10,000+ daily orders.

**Next step:** Deploy to Replit this week and begin Phase 1 (AI personalization) to drive immediate revenue impact.

---

**Questions or feedback?** Let's discuss priorities and adjust the roadmap as needed.
