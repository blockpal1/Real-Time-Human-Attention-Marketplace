# Attentium x402 Protocol Specification

## Authentication

Attentium is a **permissionless protocol**. We do not use API Keys.
Access is purchased atomically via the **x402 (Payment Required)** standard.

---

## Endpoints

### `POST /v1/verify`

Request verification of an asset (image/text/video) by human attention.

**Request Body:**
```json
{
  "duration": 30,                    // Duration in seconds (10, 30, 60)
  "quantity": 5,                     // Number of human verifiers
  "bid_per_second": 0.05,            // Offer in USDC
  "validation_question": "What color is shown?",  // REQUIRED
  "content_url": "https://example.com/image.png"  // Optional
}
```

**Response (402 - Payment Required):**
```json
{
  "error": "payment_required",
  "message": "Escrow required: 7.50 USDC",
  "invoice": {
    "amount": 7.5,
    "destination": "2kDpvEhgoLkUbqFJqxMpUXMtr2gVYbfqNF8kGrfoZMAV",
    "token": "USDC",
    "referrer": null
  }
}
```

**Response (200 - Success):**
```json
{
  "success": true,
  "message": "Verification slots reserved: 5x 30s @ $0.05/s",
  "order": {
    "duration": 30,
    "quantity": 5,
    "bid_per_second": 0.05,
    "total_escrow": 7.5,
    "tx_hash": "5abc...",
    "referrer": null
  }
}
```

---

## Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-Solana-Tx-Signature` | For 200 | Confirmed Solana transaction signature |
| `X-Referrer-Agent` | No | Builder wallet for 20% revenue share |

---

## Escrow Formula

```
total_escrow = duration × quantity × bid_per_second
```

**Example:**
- Duration: 30 seconds
- Quantity: 5 verifiers
- Bid: $0.05/second
- **Total: 30 × 5 × 0.05 = $7.50 USDC**

---

## Payment Flow

```
1. Agent → POST /v1/verify (no signature)
   ← 402 + Invoice

2. Agent → Send USDC to destination
   ← Tx confirmed on Solana

3. Agent → POST /v1/verify + X-Solana-Tx-Signature
   ← 200 + Order details
```

---

## Yield Header (Builder Revenue Share)

Agents can attribute payments to a builder/referrer using the `X-Referrer-Agent` header.

```bash
curl -X POST http://api.attentium.io/v1/verify \
  -H "Content-Type: application/json" \
  -H "X-Referrer-Agent: BUILDER_WALLET_ADDRESS" \
  -d '{"duration": 30, "quantity": 1, "bid_per_second": 0.05}'
```

The referrer is echoed in both the 402 invoice and the 200 response for tracking.

---

## Validation Rules

| Field | Rule |
|-------|------|
| `duration` | Must be 10, 30, or 60 seconds |
| `quantity` | Integer 1-1000 (default: 1) |
| `bid_per_second` | Minimum $0.0001 |
| `validation_question` | **Required** - Question for human verifier |
| `content_url` | Optional - URL of content to verify |
| Transaction | Must be < 2 minutes old (replay protection) |

---

## Content Moderation

All content is moderated **after payment verification** and **before appearing on the order book**.

### Moderation Flow

```
Payment Verified → Moderation Check → Approved (order book) or Rejected (silent)
```

### Moderation Checks

1. **URL Blocklist:** Domains containing `nsfw`, `porn`, `xxx`, `adult` are rejected
2. **Text Moderation:** OpenAI Moderation API scans `validation_question` and `content_url` content
3. **Fallback:** If no API key is configured, content is auto-approved (dev mode only)

### Order Status Outcomes

| Status | Appears on Order Book | WebSocket Event | Funds |
|--------|----------------------|-----------------|-------|
| `open` | ✅ Yes | `BID_CREATED` | Held in escrow |
| `rejected_tos` | ❌ No | None | **Forfeited to treasury** |

### Fund Treatment

> [!CAUTION]
> **TOS Violation = No Refund.** If content fails moderation, funds remain in the treasury as a deterrent against abuse. Agents should ensure content complies with Terms of Service before submitting.

---

## Networks

| Network | RPC | Token | Status |
|---------|-----|-------|--------|
| **Devnet** | `api.devnet.solana.com` | SOL or USDC | Testing |
| **Mainnet** | `api.mainnet-beta.solana.com` | USDC only | Production |

---

## Error Codes

| Code | Error | Description |
|------|-------|-------------|
| 400 | `missing_fields` | Missing duration or bid_per_second |
| 400 | `transaction_not_found` | TX not confirmed yet |
| 402 | `payment_required` | No payment header, returns invoice |
| 402 | `invalid_payment` | TX validation failed |
| 403 | `expired_transaction` | TX older than 2 minutes |
| 500 | `server_error` | Internal error |

---

## Example: Full Flow (curl)

```bash
# 1. Get Invoice
curl -X POST http://localhost:3000/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"duration": 30, "quantity": 1, "bid_per_second": 0.05}'

# 2. Pay (via Solana wallet/CLI)
# Send 1.5 USDC to destination from invoice

# 3. Submit Proof
curl -X POST http://localhost:3000/v1/verify \
  -H "Content-Type: application/json" \
  -H "X-Solana-Tx-Signature: YOUR_TX_SIGNATURE" \
  -d '{"duration": 30, "quantity": 1, "bid_per_second": 0.05}'
```

---

## Treasury

**Mainnet (Production):** `[PENDING_GENESIS_VAULT_ADDRESS]`
**Devnet (Testing):** `2kDpvEhgoLkUbqFJqxMpUXMtr2gVYbfqNF8kGrfoZMAV`

*Referrer revenue share will be distributed manually until the SplitterProgram is deployed.*

