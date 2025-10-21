# POS Integration Setup Guide

This guide explains how to integrate La Carta with Toast and Square POS systems for automated menu synchronization and order injection.

## Table of Contents

- [Overview](#overview)
- [Supported POS Systems](#supported-pos-systems)
- [Architecture](#architecture)
- [Setup Instructions](#setup-instructions)
  - [Toast POS](#toast-pos-setup)
  - [Square POS](#square-pos-setup)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Background Jobs](#background-jobs)
- [Webhooks](#webhooks)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

The POS integration system enables La Carta to:

1. **Sync Menus**: Automatically pull menu items, modifiers, and pricing from your POS system
2. **Inject Orders**: Send pre-orders to your POS when kitchen tickets are fired
3. **Real-time Updates**: Receive webhook notifications when orders are updated in the POS
4. **Bidirectional Sync**: Keep menu availability and order status in sync

### Key Features

- **Dual POS Support**: Works with both Toast and Square
- **Automatic Retry Logic**: Exponential backoff for failed API calls
- **Menu Synchronization**: Periodic background job to keep menus up-to-date
- **Order Injection**: Seamless order flow from La Carta to POS
- **Error Handling**: Robust error handling with detailed logging
- **Idempotency**: Prevents duplicate order submissions

---

## Supported POS Systems

### Toast POS
- **API Version**: v2
- **Authentication**: OAuth 2.0 with token refresh
- **Base URL**: `https://ws-api.toasttab.com`
- **Documentation**: https://doc.toasttab.com

### Square POS
- **API Version**: 2024-11-20
- **Authentication**: OAuth 2.0 Bearer token
- **Base URL**: `https://connect.squareup.com`
- **Documentation**: https://developer.squareup.com

---

## Architecture

```
┌─────────────────┐
│   La Carta API  │
└────────┬────────┘
         │
         ├─────────────────────────┐
         │                         │
    ┌────▼─────┐            ┌─────▼──────┐
    │POS Service│            │Menu Sync Job│
    └────┬─────┘            └──────┬──────┘
         │                         │
    ┌────┴─────────────┐          │
    │                  │          │
┌───▼────┐      ┌──────▼──┐      │
│Toast   │      │Square   │      │
│Client  │      │Client   │      │
└───┬────┘      └──────┬──┘      │
    │                  │          │
    │    ┌─────────────┴──────────┘
    │    │
┌───▼────▼───┐
│ Restaurant │
│  Database  │
└────────────┘
```

### Components

1. **POS Service** (`backend/src/services/posService.ts`)
   - Facade for POS operations
   - Handles configuration management
   - Orchestrates menu sync and order injection

2. **POS Clients**
   - **Toast Client** (`backend/src/integrations/toast.ts`)
   - **Square Client** (`backend/src/integrations/square.ts`)
   - Handle API authentication and requests

3. **Menu Sync Job** (`backend/src/jobs/menuSyncJob.ts`)
   - Background job for periodic menu synchronization
   - Configurable interval and concurrency

4. **Retry Utility** (`backend/src/utils/retry.ts`)
   - Exponential backoff for failed requests
   - Configurable retry attempts and delays

---

## Setup Instructions

### Toast POS Setup

#### 1. Create Toast Developer Account

1. Go to https://pos.toasttab.com/login
2. Sign up for a developer account
3. Navigate to Developer Portal

#### 2. Create Application

1. Click "Create Application"
2. Fill in application details:
   - **Name**: La Carta Integration
   - **Type**: Partner Integration
   - **Redirect URI**: `https://yourdomain.com/api/v1/pos/oauth/toast/callback`

#### 3. Get Credentials

After creating the application, you'll receive:
- **Client ID**: `toast_client_id_here`
- **Client Secret**: `toast_client_secret_here`
- **Location GUID**: Found in restaurant settings

#### 4. Configure Environment Variables

Add to `backend/.env`:

```env
# Toast POS Configuration
TOAST_API_BASE_URL=https://ws-api.toasttab.com
TOAST_AUTH_BASE_URL=https://ws-auth.toasttab.com
```

#### 5. Configure Restaurant

Use the API to configure Toast for a restaurant:

```bash
curl -X PUT http://localhost:3001/api/v1/pos/config/{restaurantId} \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "toast",
    "toastLocationGuid": "YOUR_LOCATION_GUID",
    "toastClientId": "YOUR_CLIENT_ID",
    "toastClientSecret": "YOUR_CLIENT_SECRET",
    "toastAccessToken": "YOUR_ACCESS_TOKEN",
    "toastRefreshToken": "YOUR_REFRESH_TOKEN",
    "autoSyncMenu": true,
    "syncFrequencyMinutes": 60
  }'
```

#### 6. Test Menu Sync

```bash
curl -X POST http://localhost:3001/api/v1/pos/sync-menu/{restaurantId}
```

---

### Square POS Setup

#### 1. Create Square Developer Account

1. Go to https://developer.squareup.com
2. Sign up or sign in
3. Navigate to Applications

#### 2. Create Application

1. Click "+" to create new application
2. Fill in application details:
   - **Name**: La Carta Integration
   - **Environment**: Sandbox (for testing) or Production

#### 3. Get Credentials

From the application dashboard:
- **Application ID**: `sq0idp-xxx`
- **Access Token**: `EAAAyyy` (generate in credentials tab)
- **Location ID**: Found in Locations tab

#### 4. Configure Environment Variables

Add to `backend/.env`:

```env
# Square POS Configuration
SQUARE_API_BASE_URL=https://connect.squareup.com
SQUARE_API_VERSION=2024-11-20
```

#### 5. Configure Restaurant

Use the API to configure Square for a restaurant:

```bash
curl -X PUT http://localhost:3001/api/v1/pos/config/{restaurantId} \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "square",
    "squareLocationId": "YOUR_LOCATION_ID",
    "squareAccessToken": "YOUR_ACCESS_TOKEN",
    "autoSyncMenu": true,
    "syncFrequencyMinutes": 60
  }'
```

#### 6. Test Menu Sync

```bash
curl -X POST http://localhost:3001/api/v1/pos/sync-menu/{restaurantId}
```

---

## Configuration

### Restaurant-Level Configuration

POS settings are stored in the `Restaurant.settingsJson` field:

```json
{
  "posConfig": {
    "provider": "toast",
    "toastLocationGuid": "abc123",
    "toastClientId": "client_id",
    "toastClientSecret": "secret",
    "toastAccessToken": "token",
    "toastRefreshToken": "refresh",
    "toastTokenExpiresAt": "2025-10-22T00:00:00Z",
    "autoSyncMenu": true,
    "syncFrequencyMinutes": 60,
    "lastMenuSyncAt": "2025-10-21T12:00:00Z"
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TOAST_API_BASE_URL` | Toast API base URL | `https://ws-api.toasttab.com` |
| `TOAST_AUTH_BASE_URL` | Toast auth base URL | `https://ws-auth.toasttab.com` |
| `SQUARE_API_BASE_URL` | Square API base URL | `https://connect.squareup.com` |
| `SQUARE_API_VERSION` | Square API version | `2024-11-20` |
| `MENU_SYNC_ENABLED` | Enable menu sync job | `true` |
| `MENU_SYNC_INTERVAL_MINUTES` | Sync interval | `60` |
| `MENU_SYNC_MAX_CONCURRENT` | Max concurrent syncs | `3` |

---

## API Reference

### Get POS Configuration

```http
GET /api/v1/pos/config/:restaurantId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "provider": "toast",
    "restaurantId": "rest123",
    "toastLocationGuid": "loc456",
    "autoSyncMenu": true,
    "syncFrequencyMinutes": 60,
    "lastMenuSyncAt": "2025-10-21T12:00:00Z"
  }
}
```

### Update POS Configuration

```http
PUT /api/v1/pos/config/:restaurantId
Content-Type: application/json

{
  "provider": "toast",
  "toastLocationGuid": "loc456",
  "toastClientId": "client123",
  "toastClientSecret": "secret456",
  "autoSyncMenu": true
}
```

### Sync Menu

```http
POST /api/v1/pos/sync-menu/:restaurantId
```

**Response:**
```json
{
  "success": true,
  "data": {
    "provider": "toast",
    "itemsCreated": 25,
    "itemsUpdated": 10,
    "itemsDeleted": 0,
    "categoriesCreated": 5,
    "categoriesUpdated": 2,
    "errors": [],
    "syncedAt": "2025-10-21T12:00:00Z"
  }
}
```

### Inject Order to POS

```http
POST /api/v1/pos/inject-order
Content-Type: application/json

{
  "preOrderId": "order123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "posOrderId": "toast_order_456",
    "posOrderNumber": "456",
    "status": "CREATED"
  }
}
```

---

## Background Jobs

### Menu Sync Job

The menu sync job runs automatically in the background to keep menus synchronized.

**Configuration:**
- Runs every 60 minutes by default
- Only syncs restaurants with `autoSyncMenu: true`
- Processes up to 3 restaurants concurrently
- 2-second delay between batches

**Monitoring:**

Check job status in logs:
```
INFO: Starting menu sync run
INFO: Found eligible restaurants for menu sync { total: 10, eligible: 8 }
INFO: Menu sync run completed { success: 7, failed: 1, durationMs: 45000 }
```

**Manual Control:**

Disable in `.env`:
```env
MENU_SYNC_ENABLED=false
```

Adjust interval:
```env
MENU_SYNC_INTERVAL_MINUTES=30
```

---

## Webhooks

### Toast Webhooks

Configure webhook URL in Toast Developer Portal:
```
https://yourdomain.com/api/v1/pos/webhook/toast
```

**Supported Events:**
- `ORDER_UPDATED`: Order status changed
- `ORDER_COMPLETED`: Order completed
- `MENU_UPDATED`: Menu items changed

### Square Webhooks

Configure webhook URL in Square Developer Dashboard:
```
https://yourdomain.com/api/v1/pos/webhook/square
```

**Supported Events:**
- `order.updated`: Order status changed
- `order.fulfilled`: Order fulfilled
- `catalog.version.updated`: Menu changed

---

## Testing

### Test Menu Sync

```bash
# Get POS config
curl http://localhost:3001/api/v1/pos/config/rest123

# Trigger manual sync
curl -X POST http://localhost:3001/api/v1/pos/sync-menu/rest123

# Verify menu items were created
curl http://localhost:3001/api/v1/menu/rest123
```

### Test Order Injection

```bash
# 1. Create a reservation
curl -X POST http://localhost:3001/api/v1/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "restaurantId": "rest123",
    "partySize": 4,
    "startAt": "2025-10-22T19:00:00Z"
  }'

# 2. Create pre-order
curl -X POST http://localhost:3001/api/v1/preorders \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": "res123",
    "items": [...]
  }'

# 3. Fire kitchen ticket (triggers POS injection)
curl -X PATCH http://localhost:3001/api/v1/kitchen/tickets/ticket123 \
  -H "Content-Type: application/json" \
  -d '{"status": "FIRED"}'

# 4. Verify order in POS
# Check POS dashboard or logs for confirmation
```

---

## Troubleshooting

### Authentication Errors

**Problem**: `Toast authentication failed`

**Solution**:
1. Verify `toastClientId` and `toastClientSecret` are correct
2. Check if access token has expired
3. Ensure refresh token is valid
4. Review Toast API credentials in developer portal

### Menu Sync Failures

**Problem**: `Menu sync failed` with errors

**Solutions**:
- Check restaurant has valid POS configuration
- Verify POS API credentials
- Review error details in sync result
- Check POS API rate limits
- Ensure network connectivity to POS API

### Order Injection Failures

**Problem**: Orders not appearing in POS

**Solutions**:
1. Verify POS configuration is active
2. Check pre-order has `AUTHORIZED` status before firing
3. Review kitchen ticket status transitions
4. Check POS API logs for errors
5. Verify menu item SKUs match POS items

### Common Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Invalid credentials | Refresh access token |
| `429 Too Many Requests` | Rate limit exceeded | Wait and retry |
| `500 Server Error` | POS API error | Check POS system status |
| `ECONNREFUSED` | Network error | Check firewall/network |

### Debug Logging

Enable detailed logging:

```typescript
import { Logger } from './lib/logger';

Logger.setLevel('debug'); // In development
```

View POS-specific logs:
```bash
# Filter logs for POS operations
tail -f logs/app.log | grep -i "pos"
```

---

## Best Practices

1. **Token Management**: Implement token refresh before expiration
2. **Error Handling**: Always handle POS API failures gracefully
3. **Idempotency**: Use unique order IDs to prevent duplicates
4. **Rate Limiting**: Respect POS API rate limits
5. **Monitoring**: Set up alerts for sync failures
6. **Testing**: Test with sandbox/development POS accounts first
7. **Backup**: Keep manual POS entry as fallback

---

## Support

For issues or questions:
- Check logs in `backend/logs/`
- Review POS API documentation
- Contact La Carta support team
- File bug reports on GitHub

---

**Last Updated**: October 21, 2025
**Version**: 1.0.0
