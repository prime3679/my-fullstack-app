# Known Issues and Fixes

This document lists known issues in the codebase and how to fix them.

## TypeScript Build Errors (Backend)

When running `npm run build` in the backend, you may encounter TypeScript errors. Here's how to fix them:

---

### Issue 1: Missing Prisma Client Enums

**Errors:**
```
error TS2305: Module '"@prisma/client"' has no exported member 'PreOrderStatus'.
error TS2305: Module '"@prisma/client"' has no exported member 'ReservationStatus'.
error TS2305: Module '"@prisma/client"' has no exported member 'UserRole'.
```

**Cause**: Prisma Client hasn't been generated.

**Fix:**
```bash
cd backend
npm run db:generate
```

**Files affected:**
- `src/services/preOrderService.ts`
- `src/services/reservationService.ts`
- `src/services/staffAdminService.ts`

---

### Issue 2: Implicit `any` Types

**Errors:**
```
error TS7006: Parameter 'category' implicitly has an 'any' type.
error TS7006: Parameter 'item' implicitly has an 'any' type.
error TS7006: Parameter 'mg' implicitly has an 'any' type.
```

**Cause**: TypeScript strict mode requires explicit types for all parameters.

**Fix**: Add type annotations to function parameters.

**Example Fix for `src/services/menuService.ts`:**

Before:
```typescript
.map(category => ({
```

After:
```typescript
.map((category: any) => ({
```

Better fix with proper types:
```typescript
interface MenuCategory {
  id: string;
  name: string;
  description?: string;
  // ... other fields
}

.map((category: MenuCategory) => ({
```

**Files affected:**
- `src/services/menuService.ts` (lines 95, 100, 118, 126, etc.)
- `src/services/paymentService.ts` (lines 157, 287)
- `src/services/preOrderService.ts` (lines 89, 97, 117)
- `src/services/reservationService.ts` (lines 47-48, 78)

**Quick Fix Script:**

Create `backend/fix-implicit-any.sh`:
```bash
#!/bin/bash
# Quick fix for implicit any types
sed -i 's/(category) =>/(category: any) =>/g' src/services/menuService.ts
sed -i 's/(item) =>/(item: any) =>/g' src/services/menuService.ts
sed -i 's/(mg) =>/(mg: any) =>/g' src/services/menuService.ts
sed -i 's/(modifier) =>/(modifier: any) =>/g' src/services/menuService.ts
sed -i 's/(tx) =>/(tx: any) =>/g' src/services/paymentService.ts
sed -i 's/(m) =>/(m: any) =>/g' src/services/preOrderService.ts
sed -i 's/(total, location) =>/(total: any, location: any) =>/g' src/services/reservationService.ts
sed -i 's/(locationTotal, table) =>/(locationTotal: any, table: any) =>/g' src/services/reservationService.ts
sed -i 's/(res) =>/(res: any) =>/g' src/services/reservationService.ts
echo "✅ Fixed implicit any types"
```

Run:
```bash
chmod +x backend/fix-implicit-any.sh
./backend/fix-implicit-any.sh
```

---

### Issue 3: Error Type Assertions

**Errors:**
```
error TS2322: Type 'unknown' is not assignable to type '{ name: string; message: string; stack?: string | undefined; code?: string | undefined; } | undefined'.
```

**Cause**: TypeScript 4.4+ changed how errors are typed in catch blocks (from `any` to `unknown`).

**Fix**: Add proper type assertion for error objects.

**Example Fix for `src/services/menuAdminService.ts`:**

Before:
```typescript
} catch (error) {
  Logger.error('Failed to create category', { error, restaurantId });
```

After:
```typescript
} catch (error) {
  Logger.error('Failed to create category', {
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack
    } : error,
    restaurantId
  });
```

Or simpler:
```typescript
} catch (error) {
  const err = error as Error;
  Logger.error('Failed to create category', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack
    },
    restaurantId
  });
```

**Files affected:**
- `src/services/menuAdminService.ts` (10 occurrences)
- `src/services/staffAdminService.ts` (7 occurrences)

**Quick Fix Script:**

Create `backend/fix-error-types.sh`:
```bash
#!/bin/bash
# Replace error logging patterns
find src/services -name "*.ts" -exec sed -i 's/{ error,/{ error: error as Error,/g' {} +
echo "✅ Fixed error type assertions"
```

---

### Issue 4: Stripe API Version Mismatch

**Error:**
```
error TS2322: Type '"2024-11-20.acacia"' is not assignable to type '"2025-08-27.basil"'.
```

**Cause**: Stripe TypeScript types expect a specific API version.

**Fix**: Update the Stripe API version in `src/services/paymentService.ts`:

Before:
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia',
});
```

After:
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20' as any, // Type assertion
});
```

Or update to latest:
```typescript
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20',
  typescript: true,
});
```

**File:** `src/services/paymentService.ts` (line 6)

---

### Issue 5: UserRole Index Type

**Error:**
```
error TS7053: Element implicitly has an 'any' type because expression of type 'UserRole' can't be used to index type '{ DINER: { ... }; HOST: { ... }; ... }'.
```

**Cause**: TypeScript can't guarantee that UserRole enum values match object keys.

**Fix**: Add type assertion in `src/services/staffAdminService.ts`:

Before:
```typescript
return ROLE_PERMISSIONS[role];
```

After:
```typescript
return ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
```

**File:** `src/services/staffAdminService.ts` (line 486)

---

## Frontend Issues

### Issue 1: Google Fonts Network Error

**Error:**
```
Failed to fetch `Geist` from Google Fonts
```

**Cause**: Google Fonts can't be reached (offline environment or network restrictions).

**Fix**: ✅ Already fixed - Google Fonts removed from `frontend/src/app/layout.tsx`.

If you want to add them back (for production):
```typescript
// frontend/src/app/layout.tsx
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
```

Or use system fonts (current approach):
```css
/* frontend/src/app/globals.css */
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
}
```

---

### Issue 2: Undefined Object Properties

**Potential Runtime Errors:**
- `restaurant.locations[0]?._count?.tables` (frontend/src/app/page.tsx:74)
- `preOrder.reservation.restaurant.name` (frontend/src/app/restaurant/[slug]/preorder/[id]/payment/page.tsx:123)

**Fix**: Add optional chaining:

```typescript
// Before
{restaurant.locations[0]?._count?.tables} tables available

// After (safer)
{restaurant.locations?.[0]?._count?.tables || 0} tables available
```

```typescript
// Before
Pre-pay for your meal at {preOrder.reservation.restaurant.name}

// After (safer)
Pre-pay for your meal at {preOrder.reservation?.restaurant?.name || 'Restaurant'}
```

---

## Automated Fix Script

Create `fix-all-issues.sh` in project root:

```bash
#!/bin/bash

echo "🔧 Fixing La Carta known issues..."

# Fix backend issues
cd backend

echo "📦 Generating Prisma Client..."
npm run db:generate

echo "🔨 Fixing implicit any types..."
find src/services -name "*.ts" -exec sed -i 's/(category) =>/(category: any) =>/g' {} +
find src/services -name "*.ts" -exec sed -i 's/(item) =>/(item: any) =>/g' {} +
find src/services -name "*.ts" -exec sed -i 's/(mg) =>/(mg: any) =>/g' {} +
find src/services -name "*.ts" -exec sed -i 's/(modifier) =>/(modifier: any) =>/g' {} +
find src/services -name "*.ts" -exec sed -i 's/(tx) =>/(tx: any) =>/g' {} +
find src/services -name "*.ts" -exec sed -i 's/(m) =>/(m: any) =>/g' {} +
find src/services -name "*.ts" -exec sed -i 's/(res) =>/(res: any) =>/g' {} +

echo "🔨 Fixing error type assertions..."
find src/services -name "*.ts" -exec sed -i 's/{ error,/{ error: error as Error,/g' {} +

echo "🔨 Fixing Stripe API version..."
sed -i "s/apiVersion: '2024-11-20.acacia'/apiVersion: '2024-11-20' as any/g" src/services/paymentService.ts

echo "🔨 Fixing UserRole index..."
sed -i 's/ROLE_PERMISSIONS\[role\]/ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS]/g' src/services/staffAdminService.ts

echo "✅ Backend fixes applied!"

cd ..

echo "✨ All fixes applied successfully!"
echo ""
echo "Next steps:"
echo "1. Run 'npm run build:backend' to verify no TypeScript errors"
echo "2. Run 'npm run build:frontend' to verify frontend builds"
echo "3. Test locally with 'npm run dev'"
```

**Run:**
```bash
chmod +x fix-all-issues.sh
./fix-all-issues.sh
```

---

## Workaround: Skip Type Checking (Not Recommended)

If you need to deploy quickly and fix these issues later, you can temporarily disable type checking:

### For Backend (Railway)

Add to environment variables:
```bash
SKIP_TYPE_CHECK=true
```

Update `backend/package.json`:
```json
{
  "scripts": {
    "build": "tsc --noEmit || true && tsc"
  }
}
```

### For Frontend (Vercel)

Update `frontend/next.config.ts`:
```typescript
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true, // Not recommended for production
  },
  eslint: {
    ignoreDuringBuilds: true, // Not recommended for production
  },
};
```

**Warning**: These workarounds should only be used temporarily. Fix the actual TypeScript errors for production code.

---

## Additional Improvements Needed

### Code Quality

1. **Add comprehensive error handling**: Some routes lack try-catch blocks
2. **Add input validation**: Not all routes validate input with Zod schemas
3. **Add rate limiting**: No rate limiting on API endpoints
4. **Add request logging**: Some routes don't log requests properly
5. **Add tests**: Unit tests and integration tests needed

### Security

1. **Add CSRF protection**: Consider adding CSRF tokens
2. **Add request signing**: For webhook verification (beyond Stripe)
3. **Add IP whitelisting**: For admin endpoints
4. **Add 2FA**: Two-factor authentication for staff accounts
5. **Add audit logging**: Comprehensive audit trail for admin actions

### Performance

1. **Add database indexing**: Some queries could use indexes
2. **Add caching layer**: Redis caching for frequently accessed data
3. **Add connection pooling**: Better database connection management
4. **Add CDN**: For static assets (images, etc.)
5. **Add query optimization**: Some Prisma queries could be optimized

### Features

1. **AI recommendations**: Menu item embeddings exist but not used
2. **Loyalty program UI**: Database schema exists but no frontend
3. **OpenTable integration**: Referenced but not implemented
4. **Advanced kitchen pacing**: Basic state machine but no ETA predictions
5. **Real-time notifications**: WebSocket exists but limited to kitchen

---

## Getting Help

If you encounter issues not listed here:

1. Check the browser console for frontend errors
2. Check Railway/server logs for backend errors
3. Enable debug logging: `DEBUG=* npm run dev`
4. Use Prisma Studio to inspect database: `npm run db:studio`
5. Check Stripe dashboard for payment issues
6. Open a GitHub issue with error logs and reproduction steps

---

**Last Updated**: October 2025

For questions or contributions, please open a GitHub issue or pull request.
