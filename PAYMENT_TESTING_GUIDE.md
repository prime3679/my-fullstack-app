# End-to-End Payment Flow Testing Guide

This guide provides comprehensive testing procedures for La Carta's payment system.

## Overview

The complete payment flow includes:
1. User creates reservation
2. User creates pre-order with menu items
3. User completes payment via Stripe
4. System creates kitchen ticket automatically
5. User receives confirmation with QR code

## Prerequisites

### Required Environment Variables

**Backend (.env):**
```bash
DATABASE_URL="postgresql://..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
JWT_SECRET="your-jwt-secret"
```

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_API_URL="http://localhost:3001/api/v1"
```

### Database Setup

```bash
cd backend
npm run db:push    # Apply schema
npm run db:seed    # Seed demo data
```

### Start Servers

```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Stripe Webhooks (for local testing)
stripe listen --forward-to localhost:3001/api/v1/payments/webhook
```

## Test Scenarios

### Scenario 1: Successful Payment Flow (Happy Path)

#### Step 1: Create Reservation

**API Call:**
```bash
curl -X POST http://localhost:3001/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "YOUR_RESTAURANT_ID",
    "userId": "YOUR_USER_ID",
    "partySize": 2,
    "startAt": "2025-10-22T19:00:00.000Z"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "reservation_id_here",
    "status": "BOOKED",
    ...
  }
}
```

**UI Test:**
1. Navigate to http://localhost:3000/restaurant/[slug]/reserve
2. Fill in party size and select date/time
3. Click "Reserve Table"
4. Verify reservation confirmation

#### Step 2: Create Pre-Order

**API Call:**
```bash
curl -X POST http://localhost:3001/api/v1/preorders \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": "RESERVATION_ID_FROM_STEP_1",
    "items": [
      {
        "sku": "BURGER-001",
        "quantity": 1,
        "modifiers": [],
        "notes": "No onions"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "preorder_id_here",
    "status": "DRAFT",
    "subtotal": 1200,
    "tax": 99,
    "total": 1299,
    ...
  }
}
```

**UI Test:**
1. Navigate to /restaurant/[slug]/menu
2. Add items to cart
3. Click "Proceed to Payment"
4. Verify order summary displays correctly

#### Step 3: Complete Payment

**API Call (Get Payment Intent):**
```bash
curl -X POST http://localhost:3001/api/v1/payments/payment-intent \
  -H "Content-Type: application/json" \
  -d '{
    "preOrderId": "PREORDER_ID_FROM_STEP_2",
    "tipAmount": 200
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "clientSecret": "pi_...secret_...",
    "paymentIntentId": "pi_xxxxx",
    "amount": 1499
  }
}
```

**UI Test:**
1. Navigate to /restaurant/[slug]/preorder/[id]/payment
2. Enter test card: `4242 4242 4242 4242`
3. Expiry: Any future date (e.g., 12/25)
4. CVC: Any 3 digits (e.g., 123)
5. Select tip amount (e.g., 15%)
6. Click "Pay $14.99"
7. Wait for processing
8. Verify redirect to confirmation page

**Stripe Test Cards:**
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Insufficient funds: `4000 0000 0000 9995`
- Expired card: `4000 0000 0000 0069`
- Incorrect CVC: `4000 0000 0000 0127`

#### Step 4: Verify Payment Confirmation

**Expected:**
- ✅ Payment status shows "CAPTURED"
- ✅ PreOrder status updated to "AUTHORIZED"
- ✅ Kitchen ticket created with status "PENDING"
- ✅ User redirected to confirmation page
- ✅ QR code displayed
- ✅ Add to calendar button works
- ✅ Share functionality works

**API Verification:**
```bash
# Check payment status
curl http://localhost:3001/api/v1/payments/status/PREORDER_ID

# Check pre-order status
curl http://localhost:3001/api/v1/preorders/PREORDER_ID

# Check kitchen ticket created
curl http://localhost:3001/api/v1/kitchen/tickets?status=PENDING
```

**Expected Results:**
- Payment record exists with `status: "CAPTURED"`
- PreOrder has `status: "AUTHORIZED"`
- KitchenTicket exists with `status: "PENDING"`

#### Step 5: Webhook Verification

**Check Stripe CLI Output:**
```
> payment_intent.succeeded [evt_...]
  POST http://localhost:3001/api/v1/payments/webhook [200]
```

**Check Backend Logs:**
```
Webhook signature verified successfully { eventId: 'evt_...', eventType: 'payment_intent.succeeded' }
Processing payment_intent.succeeded { paymentIntentId: 'pi_...', amount: 1499 }
Webhook event processed successfully { eventId: 'evt_...', eventType: 'payment_intent.succeeded' }
```

---

### Scenario 2: Failed Payment (Card Declined)

#### Steps:
1. Create reservation and pre-order (same as Scenario 1)
2. Use declined test card: `4000 0000 0000 0002`
3. Click "Pay"

**Expected Behavior:**
- ❌ Payment fails with error message
- ❌ Error displays: "Your card was declined"
- ✅ Suggestion shown: "Please try a different payment method or contact your bank"
- ✅ Retry button appears
- ✅ Attempt counter shows
- ✅ User can retry with different card

**API Verification:**
```bash
curl http://localhost:3001/api/v1/payments/status/PREORDER_ID
```

**Expected:**
- Payment record created with `status: "FAILED"`
- PreOrder remains in `status: "DRAFT"`
- No kitchen ticket created

---

### Scenario 3: Payment Retry After Failure

#### Steps:
1. Fail payment with declined card (Scenario 2)
2. Click "Try again with different payment method"
3. Enter successful test card: `4242 4242 4242 4242`
4. Click "Pay"

**Expected Behavior:**
- ✅ Error clears
- ✅ Attempt counter increments
- ✅ Payment succeeds
- ✅ Redirect to confirmation page
- ✅ Kitchen ticket created

---

### Scenario 4: Multiple Failed Attempts

#### Steps:
1. Attempt payment 3 times with declined card

**Expected Behavior:**
- Attempt 1: Error shown, retry button appears
- Attempt 2: "Retry attempt 2 of 3" shown
- Attempt 3: "Retry attempt 3 of 3" shown
- After 3: Support message appears
- Message: "Please contact support at support@lacarta.app"

---

### Scenario 5: Backend Confirmation Failure

**Simulate:**
1. Stop backend server after Stripe payment succeeds
2. Complete payment

**Expected Behavior:**
- ✅ Payment succeeds with Stripe
- ❌ Backend confirmation fails
- ✅ Error: "Payment confirmation failed"
- ✅ Suggestion: "Your payment was processed but we had trouble confirming it. Please contact support."

---

### Scenario 6: Webhook Event Processing

#### Test Events:

**Success Event:**
```bash
stripe trigger payment_intent.succeeded
```

**Expected:**
- Backend processes event
- Payment confirmed
- Kitchen ticket created
- Event logged in database

**Failed Event:**
```bash
stripe trigger payment_intent.payment_failed
```

**Expected:**
- Payment record created with `FAILED` status
- Event logged with failure details
- No kitchen ticket created

---

## Database Validation Queries

### Check Payment Status
```sql
SELECT * FROM payment WHERE preorder_id = 'PREORDER_ID';
```

### Check PreOrder Status
```sql
SELECT id, status, subtotal, tax, tip, total
FROM pre_order
WHERE id = 'PREORDER_ID';
```

### Check Kitchen Ticket Created
```sql
SELECT * FROM kitchen_ticket
WHERE reservation_id = 'RESERVATION_ID';
```

### Check Events Logged
```sql
SELECT * FROM event
WHERE kind IN ('payment_captured', 'payment_failed', 'preorder_created')
ORDER BY created_at DESC
LIMIT 10;
```

---

## Performance Benchmarks

**Expected Response Times:**
- Create reservation: < 100ms
- Create pre-order: < 150ms
- Create payment intent: < 500ms (Stripe API call)
- Confirm payment: < 200ms
- Webhook processing: < 300ms

**Acceptable:**
- Payment intent: < 2000ms
- Payment confirmation: < 1000ms

---

## Common Issues & Solutions

### Issue: "Webhook signature verification failed"

**Cause:** Mismatched webhook secret or incorrect raw body

**Solution:**
1. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe CLI output
2. Check Stripe CLI is forwarding to correct URL
3. Restart backend server after changing .env

### Issue: Kitchen ticket not created

**Cause:** Payment confirmation may have failed

**Solution:**
1. Check backend logs for errors
2. Verify payment status is "CAPTURED"
3. Check if webhook was processed
4. Manually verify kitchen_ticket table

### Issue: "Pre-order not found"

**Cause:** Pre-order ID mismatch or not created

**Solution:**
1. Verify pre-order exists in database
2. Check pre-order ID in URL matches database
3. Verify reservation has associated pre-order

---

## Automated Testing Checklist

- [ ] User can create reservation
- [ ] User can create pre-order
- [ ] User can complete payment with test card
- [ ] Payment confirmation page displays
- [ ] QR code renders correctly
- [ ] Kitchen ticket auto-created
- [ ] Payment decline shows error
- [ ] Retry functionality works
- [ ] Multiple attempts show support message
- [ ] Webhook events process correctly
- [ ] Database records created correctly
- [ ] Event logging captures all actions

---

## Production Readiness Checklist

- [ ] Environment variables configured
- [ ] Database schema migrated
- [ ] Stripe webhook endpoint created
- [ ] Webhook secret configured
- [ ] Payment flow tested end-to-end
- [ ] Error handling tested
- [ ] Retry logic tested
- [ ] Performance benchmarks met
- [ ] Logging verified
- [ ] Support contact info configured

---

## Support & Debugging

**Enable Debug Logging:**
```bash
# Backend
DEBUG=* npm run dev

# Check webhook deliveries
# Visit: https://dashboard.stripe.com/webhooks
```

**View Real-time Logs:**
```bash
# Backend logs
tail -f backend/logs/app.log

# Stripe events
stripe logs tail
```

**Contact:**
- Technical issues: dev@lacarta.app
- Payment support: support@lacarta.app
- Stripe dashboard: https://dashboard.stripe.com
