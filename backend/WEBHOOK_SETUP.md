# Stripe Webhook Setup Guide

This guide explains how to configure Stripe webhooks for La Carta's payment system.

## Overview

Stripe webhooks notify our application about payment events in real-time. This is critical for:
- Confirming successful payments
- Handling payment failures
- Processing refunds
- Maintaining accurate payment status

## Local Development Setup

### 1. Install Stripe CLI

```bash
# macOS
brew install stripe/stripe-cli/stripe

# Linux
# Download from https://github.com/stripe/stripe-cli/releases/latest

# Windows
scoop install stripe
```

### 2. Login to Stripe

```bash
stripe login
```

This will open your browser to authorize the Stripe CLI.

### 3. Forward Webhooks to Local Server

```bash
# Start your backend server first
cd backend
npm run dev

# In another terminal, forward webhooks
stripe listen --forward-to localhost:3001/api/v1/payments/webhook
```

### 4. Copy Webhook Signing Secret

The `stripe listen` command will output a webhook signing secret:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

Add this to your `.env` file:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 5. Test Webhook

Trigger a test payment event:

```bash
stripe trigger payment_intent.succeeded
```

You should see logs in your backend console showing the webhook was received and processed.

## Production Setup

### 1. Create Webhook Endpoint in Stripe Dashboard

1. Go to [Stripe Dashboard > Developers > Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter your endpoint URL: `https://yourdomain.com/api/v1/payments/webhook`
4. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
5. Click "Add endpoint"

### 2. Configure Webhook Secret

1. Click on your newly created webhook endpoint
2. Click "Reveal" under "Signing secret"
3. Copy the secret (starts with `whsec_`)
4. Add to your production environment variables:

```bash
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### 3. Verify Setup

#### Test in Stripe Dashboard

1. Go to your webhook endpoint in the dashboard
2. Click "Send test webhook"
3. Select `payment_intent.succeeded`
4. Click "Send test webhook"
5. Check the response - should be `200 OK`

#### Monitor Webhook Logs

In Stripe Dashboard:
- Go to Developers > Webhooks
- Click on your endpoint
- View "Recent deliveries" to see webhook attempts

## Webhook Events Handled

| Event | Description | Action |
|-------|-------------|--------|
| `payment_intent.succeeded` | Payment completed successfully | Create Payment record, update PreOrder to AUTHORIZED, create Kitchen Ticket |
| `payment_intent.payment_failed` | Payment failed | Create Payment record with FAILED status, log event |
| `payment_intent.canceled` | Payment canceled by user/system | Log event (currently no special handling) |

## Security Features

### Signature Verification

Every webhook request is verified using Stripe's signature verification:

```typescript
stripe.webhooks.constructEvent(
  body,      // Raw request body
  signature, // stripe-signature header
  webhookSecret
);
```

If signature verification fails, the webhook returns `400 Bad Request`.

### Idempotency

Payment confirmation includes idempotency checks:
- Duplicate `payment_intent.succeeded` events won't create duplicate Payment records
- Uses `stripePaymentIntentId` as unique constraint

### Error Handling

- **400**: Signature verification failure (not retried)
- **500**: Processing error (Stripe will retry)
- Retry attempts: Stripe retries failed webhooks for up to 3 days

## Troubleshooting

### Webhook Not Received

1. Check webhook URL is correct and accessible
2. Verify firewall allows Stripe IPs: https://stripe.com/docs/ips
3. Check Stripe Dashboard > Webhooks for delivery attempts

### Signature Verification Fails

1. Ensure `STRIPE_WEBHOOK_SECRET` matches the one in Stripe Dashboard
2. Check that raw request body is being used (not parsed JSON)
3. Verify webhook secret is for the correct Stripe account (test vs live)

### Missing Webhook Secret

Error: `Webhook secret not configured`

Solution: Add `STRIPE_WEBHOOK_SECRET` to your `.env` file

### Duplicate Events

Stripe may send the same event multiple times. Our system handles this with:
- Unique constraints on `stripePaymentIntentId`
- Idempotency checks in `confirmPayment()`

## Monitoring

### Log Output

Successful webhook:
```
Webhook signature verified successfully { eventId: 'evt_xxx', eventType: 'payment_intent.succeeded' }
Processing payment_intent.succeeded { paymentIntentId: 'pi_xxx', amount: 5000 }
Webhook event processed successfully { eventId: 'evt_xxx', eventType: 'payment_intent.succeeded' }
```

Failed webhook:
```
Webhook signature verification failed: { error: 'No signatures found...', signatureProvided: true, bodyType: 'string' }
```

### Database Events

Check the `event` table for webhook processing:
```sql
SELECT * FROM event WHERE kind IN ('payment_captured', 'payment_failed') ORDER BY created_at DESC;
```

## Best Practices

1. **Always verify signatures** - Never process webhooks without verification
2. **Return 200 quickly** - Process long-running tasks asynchronously
3. **Handle retries** - Design endpoints to be idempotent
4. **Log everything** - Webhook debugging requires good logs
5. **Monitor failures** - Set up alerts for webhook failures

## Resources

- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
- [Stripe CLI Documentation](https://stripe.com/docs/stripe-cli)
- [Testing Webhooks](https://stripe.com/docs/webhooks/test)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
