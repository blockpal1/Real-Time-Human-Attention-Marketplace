# Attentium x402 Protocol Specification

## Architecture Overview

Attentium uses a **hybrid x402 architecture**:
1.  **Payment (L1):** USDC settlement on Solana via the x402 (Payment Required) standard.
2.  **Matching (L2):** High-frequency, atomic order book running on Redis.
3.  **Settlement:** Real-time balance updates and attribution upon match completion.

## Authentication

Attentium is a **permissionless protocol**. We do not use API Keys.
Access is purchased atomically via **USDC**.

---

## Financial Model (The Spread)

The protocol applies a **15% Take Rate** at the moment of order creation.

| Stakeholder | Share | Description |
|-------------|-------|-------------|
| **Human Worker** | **85%** | Net earnings for providing attention. |
| **Protocol** | **12%** | Network maintenance and treasury. |
| **Agent Developer** | **3%** | Kickback to the developer of the bidding Agent. |

**Pricing Oracle:**
The "Market Clearing Price" is calculated dynamically as the **Highest Net Bid + $0.01**, grossed up to account for the spread. This ensures a new bid is always competitive.

---

## Endpoints

### `POST /v1/verify`

Request verification of an asset (image/text/video) by human attention.

**Request Body:**
```json
{
  "duration": 30,                    // Duration in seconds (10, 30, 60)
  "quantity": 5,                     // Number of human verifiers
  "bid_per_second": 0.05,            // GROSS Offer in USDC (Agent Pays)
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
    "token": "USDC"
  }
}
```

**Response (200 - Success):**
```json
{
  "success": true,
  "message": "Verification slots reserved: 5x 30s @ $0.0425/s (Net)",
  "order": {
    "duration": 30,
    "quantity": 5,
    "bid_per_second": 0.0425,        // NET Amount (85% of Gross)
    "gross_bid": 0.05,               // GROSS Amount
    "total_escrow": 7.5,
    "tx_hash": "5abc...",
    "builder_code": "MY_AGENT_V1"
  }
}
```

---

## Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/json` |
| `X-Solana-Tx-Signature` | For 200 | Confirmed Solana transaction signature |
| `X-Builder-Code` | No | **Agent Developer Code** for 3% revenue share |

---

## Builder Attribution (Agent Devs)

Agent developers can earn a **3% kickback** on every bid placed by their agents by including the `X-Builder-Code` header.

```bash
curl -X POST http://api.attentium.io/v1/verify \
  -H "Content-Type: application/json" \
  -H "X-Builder-Code: MY_AGENT_NVDA_BOT" \
  -d '{"duration": 30, "quantity": 1, "bid_per_second": 0.05, "validation_question": "Verify chart"}'
```

*Note: If no code is provided, the 3% share reverts to the Protocol Treasury.*

---

## Escrow Formula

```
total_escrow = duration × quantity × bid_per_second (GROSS)
```

**Example:**
- Duration: 30 seconds
- Quantity: 5 verifiers
- Bid: $0.05/second (Gross)
- **Total Escrow: 30 × 5 × 0.05 = $7.50 USDC**
- **Human Earns:** $0.0425/s (Net)

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

1. **URL Blocklist:** Domains containing `nsfw`, `porn`, `xxx`, `adult` are rejected.
2. **Text Moderation:** OpenAI Moderation API scans `validation_question` and `content_url`.
3. **Outcome:**
    *   `open`: Appears on order book. Funds held in escrow.
    *   `rejected_tos`: **Funds Forfeited**. Does not appear on order book.

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
| 402 | `invalid_payment` | TX validation failed (Wrong Amount/Token) |
| 403 | `expired_transaction` | TX older than 2 minutes |
| 500 | `server_error` | Internal error |
