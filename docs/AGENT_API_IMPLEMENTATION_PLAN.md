# AI Agent API Integration Plan (v2)

## Overview

AI agents need programmatic access to submit bids, receive match notifications, and verify engagement proofs. This plan integrates with the existing Solana escrow contracts.

---

## v1 (Beta) vs v2 (Live) Architecture

### The Cold Start Problem

At launch, we face a chicken-and-egg problem:
- **Humans** are ready to earn, but there are no agents bidding
- **Agents** won't bid until there's a critical mass of humans

### Solution: Dual-Mode System

| Mode | Human Reward | Agent Cost | When |
|------|--------------|------------|------|
| **v1 (Beta)** | Points | Free sandbox | Now → Product-market fit |
| **v2 (Live)** | USDC | Escrow required | After agent adoption |

### Recommendation: Single API, Mode Flag

**Add mode to the API** rather than separate systems. This keeps agent integrations stable through the transition.

```
GET /v1/status
→ { mode: "beta" | "live", features: [...] }

POST /v1/agents/bids
→ Same schema for both modes
→ In beta: no escrow check, bids are "simulated"
→ In live: escrow balance verified
```

---

## v1 Beta Points System

### How Points Work

| Event | Points Earned |
|-------|---------------|
| Complete attention session | `price × duration × 1000` |
| First session of the day | +50 bonus |
| 7 consecutive days | +250 bonus |

**Example:** 30 seconds @ $0.05/s = `0.05 × 30 × 1000 = 1,500 points`

### Points Display

```typescript
// In earnings response
{
  mode: "beta",
  points: 14250,
  equivalent_usdc: 14.25, // What you'd earn in v2
  daily_streak: 5,
  leaderboard_rank: 42
}
```

### Future Conversion (TBD)

Options for when v2 launches:
1. **Airdrop:** Convert points to USDC or token at fixed rate
2. **Multiplier:** Early users get boosted earning rate in v2
3. **NFT badge:** "Beta Pioneer" badge, no monetary value
4. **Hybrid:** Tiered rewards based on points accumulated

> [!IMPORTANT]
> **Do not promise specific conversion.** Keep messaging as "points may convert to rewards at our discretion."

---

## Agent Sandbox Testing

### Why Agents Still Need Access in Beta

Even without real payments:
- **Test integration** before going live
- **Validate content** flows work
- **Build dashboards** with real (simulated) data
- **Recruit agents** pre-launch for v2

### Sandbox Mode for Agents

| Feature | Sandbox (v1) | Live (v2) |
|---------|--------------|-----------|
| Submit bids | ✓ (no escrow required) | ✓ (escrow verified) |
| Match with users | ✓ (simulated) | ✓ (real) |
| Receive webhooks | ✓ | ✓ |
| View analytics | ✓ | ✓ |
| Pay users | ✗ (points only) | ✓ (USDC) |

### Agent Registration in Beta

```typescript
POST /v1/agents/register
{
  pubkey: "...",
  webhook_url: "...",
  name: "Test Agent",
  sandbox: true  // Explicit flag
}
→ { 
  api_key: "att_sandbox_...", 
  mode: "sandbox",
  message: "Sandbox mode: no escrow required, users receive points"
}
```

### Simulated Escrow Balance

Show agents a "virtual balance" so they can test the full flow:
```
GET /v1/agents/:pubkey/balance
→ {
  mode: "sandbox",
  virtual_balance: 100000000, // Fake $100 USDC
  note: "Sandbox mode - no real funds required"
}
```

---

## Mode Transition Strategy

### Phase Transitions

```
┌─────────────────────────────────────────────────────────────┐
│  v1 BETA (Now)                                              │
│  • Points for humans                                        │
│  • Free sandbox for agents                                  │
│  • Collect engagement data                                  │
│  • Validate product-market fit                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼ Trigger: First paying agent OR 100+ active users
┌─────────────────────────────────────────────────────────────┐
│  v1.5 HYBRID (Optional)                                     │
│  • Some agents pay (real escrow)                            │
│  • Some still sandbox                                       │
│  • Users earn mix: real USDC + points                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼ Trigger: 10+ paying agents, escrow > $10K
┌─────────────────────────────────────────────────────────────┐
│  v2 LIVE                                                    │
│  • All agents require escrow                                │
│  • Users earn real USDC                                     │
│  • Sandbox deprecated (or dev-only)                         │
└─────────────────────────────────────────────────────────────┘
```

### API Compatibility

Agents built for v1 sandbox work unchanged in v2:
- Same endpoints
- Same webhook payloads
- Only difference: escrow becomes required

```diff
  POST /v1/agents/bids
  
  v1 Response:
  { bid_id: "...", mode: "sandbox" }
  
  v2 Response:
  { bid_id: "...", mode: "live", escrow_reserved: 150000 }
```

### Database Schema Consideration

```sql
-- Add mode tracking to core tables
ALTER TABLE settlements ADD COLUMN mode VARCHAR(10) DEFAULT 'beta';
-- 'beta' = points awarded
-- 'live' = USDC transferred

-- Points ledger (v1 only)
CREATE TABLE user_points (
  id UUID PRIMARY KEY,
  user_pubkey VARCHAR(64),
  points_earned BIGINT,
  equivalent_usdc BIGINT, -- In micros, for future reference
  event_type VARCHAR(32),
  created_at TIMESTAMP
);
```

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Escrow currency | USDC only (auto-convert portion to SOL for gas) |
| Cross-chain deposits | Solana-only for v1 (CCTP considered for v2) |
| Minimum bid floor | $0.0001 per second |
| Content moderation | Automated solutions (see section below) |
| KYB | Tiered approach (see section below) |

---

## Solana Escrow Integration

### Existing Contract Capabilities

The `payment_router` contract already supports:
- `deposit_escrow(amount)` — Agent deposits USDC into PDA escrow
- `withdraw_escrow(amount)` — Agent withdraws unused escrow
- `close_settlement(verified_seconds, agreed_price_per_second, nonce)` — Router settles payment to user

### API ↔ On-Chain Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐
│  AI Agent   │───▸│ Attentium   │───▸│ Solana Escrow       │
│   (SDK)     │    │   API       │    │ (payment_router)    │
└─────────────┘    └─────────────┘    └─────────────────────┘
      │                   │                     │
      │ 1. deposit_escrow │                     │
      │ ─────────────────▸│────────────────────▸│ On-chain deposit
      │                   │                     │
      │ 2. createBid()    │                     │
      │ ─────────────────▸│ Store in DB         │
      │                   │                     │
      │ 3. [Match occurs] │                     │
      │ ◂───webhook───────│                     │
      │                   │                     │
      │ 4. [Settlement]   │────────────────────▸│ close_settlement()
      │                   │                     │ → USDC to user
```

### USDC → SOL Gas Conversion

**Problem:** Users need SOL for transaction fees, but escrow is USDC.

**Decision:** Gas station model — Attentium sponsors gas, recovers cost from `fee_basis_points`.

### Minimum Escrow Deposit

**Minimum:** `$1 USDC` (1,000,000 micros)

This ensures agents have enough balance to cover multiple sessions plus platform overhead.

---

## Minimum Bid Floor

**Floor Price:** `$0.0001/second` (100 micros in USDC terms)

Implementation:
```typescript
// In bid validation
const MIN_PRICE_MICROS = 100; // $0.0001 = 100 micros
if (max_price_per_second < MIN_PRICE_MICROS) {
  throw new Error('Bid below minimum floor price');
}
```

---

## Content Moderation (Automated)

### Options Analysis

| Service | Type | Cost | Coverage |
|---------|------|------|----------|
| **AWS Rekognition** | Image/video analysis | $0.001/image | Violence, adult, weapons |
| **Google Cloud Vision** | SafeSearch | $1.50/1000 | NSFW, violence, racy |
| **OpenAI Moderation** | Text + images | Free (with API) | Hate, violence, self-harm |
| **Hive Moderation** | Real-time | $0.0003/image | Comprehensive |
| **Perspective API** | Text toxicity | Free | Toxicity, threats |

### Recommended Approach

1. **On submission:** Scan `content_url` with lightweight check (OpenAI Moderation API)
2. **Async deep scan:** Queue for Rekognition/Hive analysis
3. **Flag system:** `pending` → `approved` / `flagged` / `rejected`
4. **Human review:** Flagged content goes to admin queue

### Content States
```
PENDING   → Auto-scan running
APPROVED  → Passed moderation
FLAGGED   → Needs human review
REJECTED  → Violates ToS (agent notified)
```

---

## KYB (Know Your Business) Analysis

### What We Would Collect

| Data Point | Purpose |
|------------|---------|
| Business name | Identity |
| Legal entity type | LLC, Corp, etc. |
| EIN / Tax ID | Compliance |
| Primary contact | Communication |
| Website / GitHub | Verification |
| Use case description | Risk assessment |

### Pros of KYB

| Pro | Impact |
|-----|--------|
| **Accountability** | Can pursue bad actors legally |
| **Trust signal** | Users may prefer verified agents |
| **Regulatory prep** | Ready for future compliance requirements |
| **Quality filter** | Reduces spam/abuse from anonymous agents |
| **Builder relationships** | Know who to pay revenue share to |

### Cons of KYB

| Con | Impact |
|-----|--------|
| **Friction** | Fewer agent signups, slower onboarding |
| **Privacy concerns** | Some builders prefer anonymity |
| **International complexity** | Different docs per jurisdiction |
| **Overhead** | Need KYB provider integration |
| **Crypto ethos conflict** | Permissionless vs. gated |

### Decision: Tiered KYB

| Tier | Requirements | Limits |
|------|--------------|--------|
| **Anonymous** | Just wallet + API key | 10 bids/day, $500 escrow max |
| **Verified** | Email + GitHub/website | 1000 bids/day, $10K escrow |
| **Enterprise** | Full KYB | Unlimited |

---

## Builder Code Revenue Sharing

### Concept

When a builder creates an agent SDK integration, they embed their `builder_code`. Attentium shares a portion of protocol fees with that builder.

---

### 1. Marketing Angle: "Genesis Builder Keys"

**The Hook:** "Protocol fee share (50% of fees) is currently restricted to the Genesis Cohort of Agent Developers."

**The FOMO:** By making it invite-only (initially), you turn the integration into a status symbol. If an Agent is "Attentium Enabled," it means they are part of the elite tier of Autonomous Treasuries.

**The Launch:** Manually hand out the first 10 keys to Design Partners (Virtuals, ai16z). This makes smaller devs desperate to get in.

---

### 2. UI Implementation: "The Velvet Rope"

#### Developer Dashboard

**State A: Unverified Dev (Default)**

| Element | Description |
|---------|-------------|
| Visual | Blurred-out dashboard showing "Potential Earnings" |
| CTA | "Fee Share is currently invite-only. [Apply for Genesis Builder Key] or [Enter Access Code]" |
| Why | Shows the value (money) immediately but demands action to unlock |

**State B: Verified Dev (Keyholder)**

| Element | Description |
|---------|-------------|
| Visual | Sleek, dark-mode financial dashboard |
| Metrics | "Total Volume Settled", "Total Fees Generated (USDC)", "Total Fee Share Earned (USDC)" |
| Action | "Copy Integration ID" button |

---

### Schema Extension

```typescript
interface AgentRegistration {
  pubkey: string;
  webhook_url?: string;
  name: string;
  builder_code?: string; // e.g., "langchain", "autogen", "custom_abc123"
}
```

### Revenue Flow (Genesis Cohort)

```
Settlement: $1.00
├── User receives: $0.97 (97%)
└── Protocol fee: $0.03 (3%)
    ├── Attentium: $0.015 (50% of fee)
    └── Genesis Builder: $0.015 (50% of fee) ← if builder_code present
```

### Builder Code Registry

| Field | Type | Description |
|-------|------|-------------|
| code | string | Unique identifier |
| builder_pubkey | Pubkey | Payout wallet |
| revenue_share_bps | u16 | Basis points (5000 = 50% for Genesis) |
| tier | string | "genesis" / "standard" / "pending" |
| created_at | timestamp | Registration date |
| total_volume | u64 | Lifetime volume attributed |

### Contract Modification

Extend `close_settlement()` to split fees:
```rust
// If builder_code present, split fee
let builder_share = fee * builder_bps / 10000;
let platform_share = fee - builder_share;
// Transfer builder_share to builder_pubkey
```

---

## Updated Implementation Phases

### Phase 1: MVP (2 weeks)
- [ ] API key authentication
- [ ] Agent registration with optional builder_code
- [ ] Minimum bid validation ($0.0001/s)
- [ ] Basic webhook delivery
- [ ] Content URL scanning (OpenAI Moderation)
- [ ] Admin Console (mode toggle, Genesis key approval, content review)

### Phase 2: Production (4 weeks)
- [ ] Solana escrow integration (deposit/withdraw API)
- [ ] Gas station for user transactions
- [ ] Full content moderation pipeline
- [ ] SDK (TypeScript)
- [ ] Rate limiting tiers

### Phase 3: Scale (6 weeks)
- [ ] Builder revenue sharing (contract upgrade)
- [ ] KYB integration for Enterprise tier
- [ ] WebSocket streaming
- [ ] Multi-content-type support (video analysis)

---

## Deployment (Beta)

### Recommended Stack

| Component | Provider | Why |
|-----------|----------|-----|
| **Frontend** | Vercel | Free, fast CDN, auto-deploy from GitHub |
| **Backend** | Railway | Easy WebSocket support, auto-scaling |
| **PostgreSQL** | Railway (add-on) | Same network as backend, low latency |
| **Redis** | Upstash | Serverless, free tier generous |

**Estimated cost:** ~$5-20/month for beta

### Railway Setup (Backend)

1. Create Railway project, connect GitHub repo
2. Add PostgreSQL service (Railway add-on)
3. Set environment variables:
   ```
   DATABASE_URL=<auto-provided by Railway>
   REDIS_URL=<from Upstash>
   PORT=3000
   ```
4. Set start command: `npm run start` (needs build script)
5. Deploy

### Vercel Setup (Frontend)

1. Import GitHub repo to Vercel
2. Set root directory: `frontend`
3. Set environment variables:
   ```
   VITE_API_URL=https://your-railway-backend.up.railway.app
   VITE_WS_URL=wss://your-railway-backend.up.railway.app
   VITE_PRIVY_APP_ID=<your-privy-app-id>
   ```
4. Deploy

### Upstash Redis (Free Tier)

1. Create database at upstash.com
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
3. Add to Railway env vars

### Pre-Deployment Checklist

- [ ] Add `npm run build` and `npm run start` scripts to backend
- [ ] Update CORS settings for production domain
- [ ] Set `NODE_ENV=production`
- [ ] configure Privy allowed domains
- [ ] Test WebSocket connection from Vercel → Railway
- [ ] Set up custom domain (optional)

---

## References

- **Escrow Contract:** `payment-router/programs/payment_router/src/lib.rs`
- **Existing Bid API:** `backend/src/controllers/AgentController.ts`
