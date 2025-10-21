# Code Efficiency Report

This report documents inefficiencies found in the codebase during code review.

## 1. 🔴 CRITICAL: Massive Code Duplication in MenuService (FIXED)

**Location:** `backend/src/services/menuService.ts`

**Issue:** The same menu item transformation logic is duplicated across 5-6 different methods, resulting in approximately 300+ lines of duplicate code.

**Affected Methods:**
- `getRestaurantMenu()` (lines 100-135)
- `getMenuItem()` (lines 182-213)
- `searchMenuItems()` (lines 282-314)
- `toggleItemAvailability()` (lines 361-393)
- `toggleItem86Status()` (lines 450-482)
- `updateMenuItemAvailability()` (lines 530-562)
- `toggle86Status()` (lines 608-640)

**Impact:** 
- High maintenance burden - any change to transformation logic must be copied to 5+ places
- Increased risk of bugs from inconsistent updates
- Bloated file size (643 lines, ~47% is duplication)

**Recommended Fix:** Extract the transformation logic into a reusable private helper method. ✅ **FIXED IN THIS PR**

## 2. 🟡 MEDIUM: N+1 Query Pattern in PreOrderService

**Location:** `backend/src/services/preOrderService.ts` (lines 43-63)

**Issue:** The `calculatePreOrder` method fetches menu items one by one in a loop instead of batch fetching.

```typescript
for (const orderItem of items) {
  const menuItem = await db.menuItem.findUnique({
    where: {
      restaurantId_sku: {
        restaurantId,
        sku: orderItem.sku
      }
    },
    // ... includes
  });
}
```

**Impact:**
- For an order with 10 items, this makes 10 separate database queries
- Scales linearly with cart size (O(n) queries instead of O(1))
- Can cause performance issues under load

**Recommended Fix:** 
- Extract all SKUs first
- Perform a single `findMany` query with `where: { sku: { in: skus } }`
- Build a map of SKU -> MenuItem for O(1) lookup
- Process items using the map

## 3. 🟡 MEDIUM: Missing Database Indexes

**Location:** `backend/prisma/schema.prisma` (MenuItem model, lines 367-393)

**Issue:** The MenuItem table is frequently filtered by `isAvailable`, `is86`, and `categoryId`, but only has an index on `[restaurantId, sku]`.

**Impact:**
- Menu queries that filter by availability perform full table scans
- Gets worse as menu size grows
- Category-based queries are inefficient

**Recommended Fix:** Add composite indexes:
```prisma
@@index([restaurantId, categoryId, isAvailable, is86])
@@index([restaurantId, isAvailable, is86])
```

## 4. 🟢 LOW: Redundant API Calls in Frontend

**Location:** `frontend/src/app/restaurant/[slug]/menu/page.tsx` (lines 67-71)

**Issue:** The component calls `api.getRestaurant(slug)` twice:
```typescript
const [restaurantRes, menuRes] = await Promise.all([
  api.getRestaurant(slug),
  api.getRestaurant(slug).then(res => 
    api.getRestaurantMenu(res.data.id)
  )
]);
```

**Impact:**
- Wastes one API call per page load
- Slightly slower page load time
- Unnecessary server load

**Recommended Fix:** Fetch restaurant once, then use its ID:
```typescript
const restaurantRes = await api.getRestaurant(slug);
const menuRes = await api.getRestaurantMenu(restaurantRes.data.id);
```

## 5. 🟢 LOW: Inefficient Nested Array Operations

**Location:** `backend/src/services/reservationService.ts` (lines 47-51)

**Issue:** Nested reduce operations calculate capacity:
```typescript
const totalCapacity = restaurant.locations.reduce((total, location) => {
  return total + location.tables.reduce((locationTotal, table) => {
    return locationTotal + (table.seats >= partySize ? 1 : 0);
  }, 0);
}, 0);
```

**Impact:** Minor - only runs once per availability check

**Recommended Fix:** Use flat map or calculate this once and cache it.

## 6. 🟢 LOW: No Frontend Caching for Cart Calculations

**Location:** `frontend/src/components/PreOrderCart.tsx` (lines 69-73)

**Issue:** The cart recalculates pricing on every modal open or cart change:
```typescript
useEffect(() => {
  if (cart.length > 0 && isOpen) {
    calculatePreOrder();
  }
}, [cart, isOpen]);
```

**Impact:**
- Multiple API calls for the same cart contents
- Especially wasteful when just opening/closing the modal

**Recommended Fix:** 
- Memoize calculation results based on cart contents
- Only recalculate when cart items actually change
- Consider using React Query or SWR for caching

## Summary

**Priority Order:**
1. ✅ Code Duplication (FIXED)
2. N+1 Query Pattern (high performance impact)
3. Missing Database Indexes (medium performance impact)
4. Redundant API calls (low impact, easy fix)
5. Nested loops (low impact)
6. Frontend caching (low impact)
