# Architecture Audit: Legacy vs x402 Protocol

> **Last Updated:** 2025-12-18

## Executive Summary

The codebase has been **unified** around the x402 protocol:

| Aspect | Status | Notes |
|--------|--------|-------|
| **Order Storage** | ✅ Unified | All orders in `orderStore` (Campaign Manager + x402 agents) |
| **Matching** | ✅ Unified | MatchingEngine matches both Prisma sessions and x402 orders |
| **Moderation** | ✅ Unified | Admin can review both legacy and x402 flagged content |
| **Human UI** | ✅ Wired | `MATCH_FOUND` triggers modal with x402 order data |

**Remaining work:** Order completion API, mainnet USDC validation, order expiration.

---

## 🗑️ DEPRECATED: Should Be Cleaned Up

### 1. Agent Registration System
**Files:**
- `controllers/AgentRegistrationController.ts` - API key generation
- `middleware/auth.ts` - `authenticateAgent`, `optionalAuth`

**API Endpoints:**
```
POST /v1/agents/register    → Generates API key (unused in x402)
GET  /v1/agents/me          → Uses API key auth
GET  /v1/agents/balance     → Virtual balance (replaced by tx proof)
PATCH /v1/agents/webhook    → Webhook config (x402 is polling-based)
```

**Why Deprecated:** x402 is permissionless. Agents authenticate via payment, not API keys.

---

### 2. Legacy Bid System
**Files:**
- `controllers/AgentController.ts` - `createBid`, `getActiveBids`
- Prisma schema: `Bid` model

**Status:** ⚠️ **PARTIALLY MIGRATED**
- `createBid` now writes to x402 `orderStore` (not Prisma)
- `getActiveBids` still queries Prisma (legacy)
- Frontend `/v1/orderbook` uses unified `orderStore`

---

### 3. MatchingEngine ✅
**Files:**
- `services/MatchingEngine.ts` - Polls DB for bid/session matches

**Status:** ✅ **ADAPTED** - No longer deprecated!
- Now creates unified bid pool from Prisma + x402 `orderStore`
- Matches human asks (sessions) with x402 orders
- Emits `MATCH_CREATED` → `MATCH_FOUND` to trigger human modal

---

### 4. Webhook Service
**Files:**
- `services/WebhookService.ts` - Sends match notifications to agent URLs

**Why Deprecated:** x402 agents poll `/v1/orders/:tx_hash` for status. Webhooks require registration which x402 doesn't have.

---

### 5. SDK Directory
**Status:** Already deleted ✅

---

## 📋 ROADMAP: Still Needed

### 1. Order Completion Flow
**Current State:** Human can `/fill` an order, but nothing happens after.
**Missing:**
- Show content/question to human after fill
- Collect human response
- Mark order as `completed`
- Store result in `orderStore`

**Route Needed:**
```
POST /v1/orders/:tx_hash/complete
{
  "answer": "blue",
  "actual_duration": 28
}
```

---

### 2. Agent Status Polling Enhancement
**Current State:** Agent can poll `/v1/orders/:tx_hash` for status.
**Missing:**
- `result` field always null
- No way to get human's answer

**Enhancement:**
```json
{
  "status": "completed",
  "result": {
    "answer": "blue",
    "completed_at": 1702900000000,
    "verifier_count": 5
  }
}
```

---

### 3. SplitterProgram for Referrer Revenue Share
**Current State:** Funds go to treasury, referrer tracked but not paid.
**Missing:** On-chain program to split 80/20 automatically.
**Status:** Manual payouts until deployed.

---

### 4. Mainnet USDC Validation
**Current State:** Devnet uses native SOL bypass.
**Missing:** Strict USDC token transfer parsing for mainnet.
**Location:** `x402OrderBook.ts` line 121-127 (TODO comment)

---

### 5. Order Expiration & Cleanup
**Current State:** Orders in `orderStore` persist forever.
**Missing:**
- TTL for unfilled orders (10 min?)
- Cleanup job to mark as `expired`
- Refund logic (or forfeit as TOS says)

---

## ✅ FIXED: Previously Broken (Rewired)

### 1. Frontend OrderBook Dual-Source Confusion ✅
**Problem:** `OrderBook.tsx` fetches from BOTH Prisma DB and in-memory orderStore.

**Status:** ✅ **RESOLVED** - Implemented Option C: Migrated Campaign Manager to x402.
- `AgentController.createBid` now writes to `orderStore` instead of Prisma
- `/v1/orderbook` returns unified list from `orderStore`

---

### 2. Admin Content Moderation Dashboard ✅
**Problem:** `AdminController.ts` only shows legacy Prisma flagged bids, not x402 orders.

**Status:** ✅ **RESOLVED**
- Added `GET /v1/admin/content/x402-flagged` - lists x402 orders with `rejected_tos` status
- Added `POST /v1/admin/content/x402/:tx_hash/review` - approve/reject x402 content

---

### 3. Human Match Completion ✅
**Problem:** After clicking "fill" on an x402 order, no UI to show content or collect answers.

**Status:** ✅ **RESOLVED**
- MatchingEngine now includes x402 orders in unified bid pool
- `executeX402Match` emits `MATCH_CREATED` with `contentUrl` and `validationQuestion`
- `MATCH_FOUND` event triggers `MatchNotificationModal` with x402 order data

---

### 4. MatchingEngine + x402 Conflict ✅
**Problem:** `MatchingEngine` was matching DB sessions to DB bids, ignoring x402 orders.

**Status:** ✅ **RESOLVED** - Implemented Option B: Adapted to work with x402 orderStore.
- `runMatchingCycle` creates unified bid pool from Prisma + x402 `orderStore`
- x402 orders match with human asks (sessions with priceFloor)
- Logs now show: `Matching Cycle: X Prisma + Y x402 Bids, Z Sessions`

---

## 📊 Priority Matrix

| Item | Priority | Effort | Status |
|------|----------|--------|--------|
| Wire human completion UI | 🔴 Critical | Medium | ✅ DONE |
| Add order completion API | 🔴 Critical | Low | ✅ DONE |
| Adapt MatchingEngine for x402 | 🟡 High | Low | ✅ DONE |
| Add x402 flagged content admin | 🟡 High | Low | ✅ DONE |
| Remove legacy agent routes | 🟢 Medium | Low | 🔄 Optional |
| Mainnet USDC validation | 🟡 High | Medium | 🔄 TODO |
| Order expiration TTL | 🟢 Medium | Medium | 🔄 TODO |
| SplitterProgram deploy | 🟢 Medium | High | 🔄 Future |

---

## Recommended Action Plan

### ✅ Phase 1: Critical Path (COMPLETED)
1. ~~Wire human completion UI to show x402 order content~~ ✅
2. ~~Adapt MatchingEngine for unified bid pool~~ ✅
3. ~~Add x402 flagged content admin endpoints~~ ✅

### ✅ Phase 2: Order Flow (COMPLETED)
4. ~~Add `POST /orders/:tx_hash/complete` endpoint~~ ✅
5. ~~Store result in `orderStore` with answer/duration~~ ✅
6. ~~Expose result in `GET /orders/:tx_hash` for agent polling~~ ✅

### Phase 3: Launch Prep (TODO)
7. Implement mainnet USDC validation
8. Add order expiration job
9. Deploy SplitterProgram for referrer revenue

---

## Files to Delete/Archive

```
❌ controllers/AgentRegistrationController.ts (or archive)
⚠️ controllers/AgentController.ts:getActiveBids (deprecated, uses Prisma)
⚠️ services/WebhookService.ts (keep for future, unused by x402)
⚠️ middleware/auth.ts (agent parts only)
```

## Files Updated (This Session)

```
✓ services/MatchingEngine.ts - Unified bid pool + executeX402Match
✓ controllers/AgentController.ts - createBid writes to orderStore
✓ controllers/AdminController.ts - x402 flagged content endpoints
✓ middleware/x402OrderBook.ts - Admin bypass for Campaign Manager
✓ routes/api.ts - Added x402 admin routes
```
