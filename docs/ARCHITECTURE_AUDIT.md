# Architecture Audit: Legacy vs x402 Protocol

## Executive Summary

The codebase currently runs **two parallel systems** that have diverged in philosophy:

| Aspect | Legacy System | x402 Protocol |
|--------|---------------|---------------|
| **Authentication** | API Keys (`att_...`) | Payment-as-auth (Solana tx) |
| **Data Storage** | Prisma database (Bid, Agent, Match) | In-memory `orderStore` Map |
| **Matching** | `MatchingEngine` cycle (session → bid) | Manual `/fill` by human UI |
| **Moderation** | Async queue → database `contentStatus` | Inline check → memory status |
| **Payments** | Pre-funded escrow balance | Per-request payment |

This creates duplicate pathways, inconsistent UX, and maintenance burden.

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

**API Endpoints:**
```
POST /v1/agents/bids        → Creates DB bid (UI/Campaign Manager)
GET  /v1/agents/bids        → Fetches DB bids (not x402 orders)
```

**Why Deprecated:** x402 orders live in `orderStore`, not the database. UI fetches from both sources creating confusion.

---

### 3. Old MatchingEngine
**Files:**
- `services/MatchingEngine.ts` - Polls DB for bid/session matches
- `server.ts` → `new MatchingEngine()` still runs

**Why Deprecated:** x402 flow is "human clicks to fill", not automated matching. The engine runs but operates on a different data source.

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

| Item | Priority | Effort | Risk |
|------|----------|--------|------|
| Wire human completion UI | 🔴 Critical | Medium | Blocking UX |
| Add order completion API | 🔴 Critical | Low | Blocking flow |
| Remove MatchingEngine | 🟡 High | Low | Cleanup |
| Add x402 flagged content admin | 🟡 High | Low | Compliance |
| Remove legacy agent routes | 🟢 Medium | Low | Cleanup |
| Mainnet USDC validation | 🟡 High | Medium | Launch blocker |
| Order expiration TTL | 🟢 Medium | Medium | Data hygiene |
| SplitterProgram deploy | 🟢 Medium | High | Revenue share |

---

## Recommended Action Plan

### Phase 1: Critical Path (Now)
1. Wire human completion UI to show x402 order content
2. Add `POST /orders/:tx_hash/complete` endpoint
3. Update result in orderStore

### Phase 2: Cleanup (This Week)
4. Stop MatchingEngine (or delete)
5. Remove/deprecate legacy agent registration routes
6. Update admin dashboard for x402 flagged orders

### Phase 3: Launch Prep
7. Implement mainnet USDC validation
8. Add order expiration job
9. Deploy SplitterProgram for referrer revenue

---

## Files to Delete/Archive

```
❌ controllers/AgentRegistrationController.ts (or archive)
❌ controllers/AgentController.ts (createBid part)
❌ services/MatchingEngine.ts (or disable)
❌ services/WebhookService.ts (or keep for future)
❌ middleware/auth.ts (agent parts only)
```

## Files to Keep

```
✓ controllers/AdminController.ts (needs x402 additions)
✓ controllers/MatchController.ts (may be repurposed)
✓ controllers/UserController.ts (session start still used)
✓ services/ContentModerationService.ts (actively used)
✓ middleware/x402OrderBook.ts (core)
✓ routes/marketRoutes.ts (core)
```
