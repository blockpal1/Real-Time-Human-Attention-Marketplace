# Attentium Developer Guide

> **Get verified human attention for your AI agent in minutes.**

This guide shows you how to integrate Attentium into your AI agent using the **x402 Payment Required** protocol.

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Using the Price Oracle](#using-the-price-oracle-optional)
3. [Step 1: Get a Price Quote](#step-1-get-a-price-quote)
4. [Step 2: Make the Solana Payment](#step-2-make-the-solana-payment)
5. [Step 3: Create Your Campaign](#step-3-create-your-campaign)
6. [Step 4: Store Your Keys](#step-4-store-your-keys)
7. [Retrieving Results](#retrieving-results-polling)
8. [Webhooks](#webhooks-real-time)
9. [Verifying Signatures](#verifying-webhook-signatures)

---

## Base URL

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://api.attentium.ai` |
| **Local Development** | `http://localhost:3000` |

All endpoints in this guide are relative to the base URL. For example:
```
GET /v1/oracle/quote  →  https://api.attentium.ai/v1/oracle/quote
POST /v1/verify       →  https://api.attentium.ai/v1/verify
```

**Python setup:**
```python
import requests

BASE_URL = "https://api.attentium.ai"  # or "http://localhost:3000" for local dev

# All requests use this base
response = requests.get(f"{BASE_URL}/v1/oracle/quote")
```

---

## How It Works

Attentium uses the **x402 (Payment Required)** standard:

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Your Agent    │         │    Attentium     │         │     Solana      │
└────────┬────────┘         └────────┬─────────┘         └────────┬────────┘
         │                           │                            │
         │  1. POST /verify (no tx)  │                            │
         │──────────────────────────>│                            │
         │                           │                            │
         │  402 Payment Required     │                            │
         │  (invoice: 7.50 USDC)     │                            │
         │<──────────────────────────│                            │
         │                           │                            │
         │  2. Transfer USDC         │                            │
         │───────────────────────────────────────────────────────>│
         │                           │                            │
         │  3. POST /verify + tx_sig │                            │
         │──────────────────────────>│                            │
         │                           │  Verify Payment            │
         │                           │<───────────────────────────│
         │  200 OK + keys            │                            │
         │<──────────────────────────│                            │
         │                           │                            │
         │  4. Humans verify         │                            │
         │       ...wait...          │                            │
         │                           │                            │
         │  5. Webhook/Poll results  │                            │
         │<──────────────────────────│                            │
```

**No API keys. No registration. Just pay and use.**

---

## Using the Price Oracle (Optional)

Don't know what to bid? Use our **Oracle endpoint** to get a competitive price automatically:

```python
import requests

# Get the market clearing price
response = requests.get(
    "https://api.attentium.ai/v1/oracle/quote",
    params={"duration": 30}  # 10, 30, or 60 seconds
)

quote = response.json()
print(quote)
```

**Response:**
```json
{
  "duration": 30,
  "gross_bid_cents": 6,
  "market_depth": 3,
  "timestamp": "2024-12-20T10:00:00Z"
}
```

| Field | Description |
|-------|-------------|
| `gross_bid_cents` | Recommended bid in cents/second to beat current market |
| `market_depth` | Number of active orders at this duration |

**Using the Oracle price:**
```python
# Get competitive price from oracle
quote = requests.get("https://api.attentium.ai/v1/oracle/quote", params={"duration": 30}).json()

# Convert cents to USDC
bid_per_second = quote["gross_bid_cents"] / 100  # e.g., 6 cents = $0.06

# Use in your campaign
requests.post("/v1/verify", json={
    "duration": 30,
    "bid_per_second": bid_per_second,  # $0.06
    ...
})
```

> **Tip:** The Oracle always returns a price that beats the highest current bid by $0.01. If the market is empty, it returns the floor price (1 cent/second).

---

## Step 1: Get a Price Quote

First, call `/verify` without a payment signature to get an invoice:

```python
import requests

# Request without payment - get invoice
response = requests.post(
    "https://api.attentium.ai/v1/verify",
    headers={"Content-Type": "application/json"},
    json={
        "duration": 30,           # 10, 30, or 60 seconds
        "quantity": 5,            # Number of human verifiers
        "bid_per_second": 0.05,   # Your bid in USDC per second
        "validation_question": "Does this image show a cat?",
        "content_url": "https://example.com/image.png"
    }
)

# Returns 402 Payment Required
invoice = response.json()
print(invoice)
```

**Response (402 Payment Required):**
```json
{
  "error": "payment_required",
  "message": "Escrow required: 7.50 USDC",
  "invoice": {
    "amount": 7.50,
    "destination": "2kDpvEhgoLkUbqFJqxMpUXMtr2gVYbfqNF8kGrfoZMAV",
    "token": "USDC"
  }
}
```

**Escrow Calculation:**
```
total = duration × quantity × bid_per_second
      = 30 × 5 × $0.05
      = $7.50 USDC
```

---

## Step 2: Make the Solana Payment

Transfer USDC to our treasury wallet on Solana:

```python
from solana.rpc.api import Client
from solders.keypair import Keypair
from solders.pubkey import Pubkey
from spl.token.instructions import transfer_checked, TransferCheckedParams

# Configuration
TREASURY = Pubkey.from_string("2kDpvEhgoLkUbqFJqxMpUXMtr2gVYbfqNF8kGrfoZMAV")
USDC_MINT = Pubkey.from_string("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
USDC_DECIMALS = 6

# Your agent's wallet
agent_keypair = Keypair.from_bytes(YOUR_PRIVATE_KEY_BYTES)
client = Client("https://api.mainnet-beta.solana.com")

# Amount from invoice (in USDC atomic units)
amount = int(7.50 * 10**USDC_DECIMALS)  # 7,500,000

# Create and send transfer
tx = transfer_checked(TransferCheckedParams(
    program_id=TOKEN_PROGRAM_ID,
    source=your_usdc_ata,
    mint=USDC_MINT,
    dest=treasury_usdc_ata,
    owner=agent_keypair.pubkey(),
    amount=amount,
    decimals=USDC_DECIMALS
))

result = client.send_transaction(tx, agent_keypair)
tx_signature = str(result.value)
print(f"Payment sent: {tx_signature}")
```

**Networks:**
| Network | RPC | Token |
|---------|-----|-------|
| Mainnet | `api.mainnet-beta.solana.com` | USDC only |
| Devnet | `api.devnet.solana.com` | SOL or USDC (testing) |

---

## Step 3: Create Your Campaign

Now call `/verify` again with the transaction signature:

```python
response = requests.post(
    "https://api.attentium.ai/v1/verify",
    headers={
        "Content-Type": "application/json",
        "X-Solana-Tx-Signature": tx_signature,           # Your payment proof
        "X-Builder-Code": "MY_AGENT_V1"                  # Optional: Earn 3% revenue share
    },
    json={
        "duration": 30,
        "quantity": 5,
        "bid_per_second": 0.05,
        "validation_question": "Does this image show a cat?",
        "content_url": "https://example.com/image.png",
        "callback_url": "https://your-agent.com/webhook"  # Optional: Real-time webhooks
    }
)

data = response.json()
print(data)
```

**Response (200 Success):**
```json
{
  "success": true,
  "message": "Verification slots reserved: 5x 30s @ $0.0425/s",
  "order": {
    "duration": 30,
    "quantity": 5,
    "bid_per_second": 0.0425,
    "tx_hash": "5abc123...",
    "referrer": null
  },
  "read_key": "a1b2c3d4e5f6...",
  "webhook_secret": "x9y8z7w6v5u4..."
}
```

> **Note:** The `bid_per_second` in the response is the **NET** amount (85% of what you paid). The 15% spread covers protocol fees and gas costs.

> **Idempotency:** If you accidentally submit the same `tx_hash` twice, the endpoint returns the **existing order** with its original keys. This is safe to retry.

---

## Step 4: Store Your Keys

⚠️ **CRITICAL: Save these immediately - they are only returned ONCE!**

```python
# Extract from response
campaign_id = data["order"]["tx_hash"]
read_key = data["read_key"]           # Needed to fetch results
webhook_secret = data["webhook_secret"]  # Needed to verify webhooks

# Store in your database
db.campaigns.insert({
    "campaign_id": campaign_id,
    "read_key": read_key,
    "webhook_secret": webhook_secret,
    "created_at": datetime.now()
})
```

> **Warning:** If you lose these keys, you cannot retrieve your campaign results or verify webhooks. There is no recovery mechanism.

---

## Retrieving Results (Polling)

Use the `read_key` to fetch human responses:

```python
import requests

def get_campaign_results(campaign_id: str, read_key: str) -> dict:
    """Fetch all human responses for a campaign."""
    response = requests.get(
        f"https://api.attentium.ai/v1/campaigns/{campaign_id}/results",
        params={"key": read_key}
    )
    
    if response.status_code == 401:
        raise ValueError("Invalid read_key")
    
    return response.json()

# Usage
results = get_campaign_results(
    campaign_id="admin_123abc...",
    read_key="a1b2c3d4..."
)

print(f"Question: {results['validation_question']}")
print(f"Completed: {results['completed_quantity']}/{results['target_quantity']}")

for r in results["results"]:
    print(f"  - Answer: {r['answer']}")
```

**Response Structure:**
```json
{
  "campaign_id": "admin_123abc...",
  "validation_question": "Does this image show a cat?",
  "status": "in_progress",
  "target_quantity": 5,
  "completed_quantity": 3,
  "results": [
    {
      "response_id": "resp_1",
      "answer": "Yes, it's definitely a cat",
      "duration_seconds": 28,
      "completed_at": "2024-12-20T09:30:00Z"
    }
  ],
  "aggregates": {
    "avg_duration_seconds": 26.4,
    "completion_rate": 0.6
  }
}
```

---

## Webhooks (Real-Time)

Get notified instantly when a human completes your verification task.

### Setup

Include `callback_url` when creating your campaign:

```python
response = requests.post(
    "https://api.attentium.ai/v1/verify",
    json={
        "callback_url": "https://your-agent.com/attentium-webhook",
        # ... other fields
    }
)
```

### Webhook Payload

When a human submits their answer, we POST to your callback URL:

```json
{
  "event": "response_submitted",
  "campaign_id": "admin_123abc...",
  "validation_question": "Does this image show a cat?",
  "timestamp": "2024-12-20T09:30:00Z",
  "data": {
    "answer": "Yes, it's definitely a cat",
    "duration": 28,
    "exited_early": false,
    "completed_at": "2024-12-20T09:30:00Z"
  }
}
```

> ⚠️ **Reliability Warning:** Webhooks are currently "Fire and Forget." We attempt delivery once with a 5-second timeout. If your server does not respond with 200 OK immediately, the event is **not retried**. Always implement the [Polling endpoint](#retrieving-results-polling) as a backup to sweep for missed results.

---

## Verifying Webhook Signatures

Every webhook includes an `X-Attentium-Signature` header. **You must verify this signature** to ensure the webhook is authentic.

### Python (Copy-Paste Ready)

```python
import hmac
import hashlib
import json
from flask import Flask, request, jsonify

app = Flask(__name__)

def verify_attentium_signature(
    payload: dict,
    signature_header: str,
    webhook_secret: str
) -> bool:
    """
    Verify that a webhook payload was signed by Attentium.
    
    Args:
        payload: The JSON body of the webhook request
        signature_header: Value of X-Attentium-Signature header
        webhook_secret: Your campaign's webhook_secret
    
    Returns:
        True if signature is valid, False otherwise
    """
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    
    received_signature = signature_header[7:]  # Remove "sha256=" prefix
    
    # Compute expected signature
    payload_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
    expected_signature = hmac.new(
        webhook_secret.encode('utf-8'),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(received_signature, expected_signature)


@app.route("/attentium-webhook", methods=["POST"])
def handle_webhook():
    # Get your webhook_secret from your database
    campaign_id = request.json.get("campaign_id")
    campaign = db.campaigns.find_one({"campaign_id": campaign_id})
    
    if not campaign:
        return jsonify({"error": "Unknown campaign"}), 404
    
    # Verify signature
    signature = request.headers.get("X-Attentium-Signature")
    if not verify_attentium_signature(request.json, signature, campaign["webhook_secret"]):
        return jsonify({"error": "Invalid signature"}), 401
    
    # Process the verified webhook
    answer = request.json["data"]["answer"]
    print(f"Human answered: {answer}")
    
    # Your business logic here...
    
    return jsonify({"status": "ok"}), 200
```

### Node.js

```javascript
const crypto = require('crypto');
const express = require('express');
const app = express();

app.use(express.json());

function verifyAttentiumSignature(payload, signatureHeader, webhookSecret) {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  
  const receivedSignature = signatureHeader.slice(7);
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(payload))
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
  );
}

app.post('/attentium-webhook', (req, res) => {
  const signature = req.headers['x-attentium-signature'];
  const webhookSecret = getSecretForCampaign(req.body.campaign_id);
  
  if (!verifyAttentiumSignature(req.body, signature, webhookSecret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process verified webhook
  console.log('Human answered:', req.body.data.answer);
  res.json({ status: 'ok' });
});
```

---

## Common Mistakes

### ❌ Don't: Forget to save your keys

```python
# BAD - keys are lost forever
response = requests.post("/v1/verify", json={...})
campaign_id = response.json()["order"]["tx_hash"]
# read_key and webhook_secret are gone!
```

### ✅ Do: Save keys immediately

```python
# GOOD - keys are persisted
data = response.json()
save_to_database(
    campaign_id=data["order"]["tx_hash"],
    read_key=data["read_key"],
    webhook_secret=data["webhook_secret"]
)
```

---

### ❌ Don't: Skip signature verification

```python
# BAD - accepts any request, including attackers
@app.route("/webhook", methods=["POST"])
def webhook():
    answer = request.json["data"]["answer"]  # Could be fake!
    return "ok"
```

### ✅ Do: Always verify signatures

```python
# GOOD - rejects forged requests
@app.route("/webhook", methods=["POST"])
def webhook():
    if not verify_attentium_signature(request.json, ...):
        return "Unauthorized", 401
    answer = request.json["data"]["answer"]  # Verified!
    return "ok"
```

---

### ❌ Don't: Use string comparison for signatures

```python
# BAD - vulnerable to timing attacks
if received_signature == expected_signature:
    ...
```

### ✅ Do: Use constant-time comparison

```python
# GOOD - secure against timing attacks
import hmac
if hmac.compare_digest(received_signature, expected_signature):
    ...
```

---

## Troubleshooting

### "Invalid signature" errors

1. **JSON serialization mismatch**: We use `JSON.stringify()` on our Node.js backend (compact format, no spaces). Your verification must use the **exact same format**.

   ```python
   # ✅ CORRECT - matches our backend
   payload_bytes = json.dumps(payload, separators=(',', ':')).encode('utf-8')
   
   # ❌ WRONG - default Python adds spaces after colons
   payload_bytes = json.dumps(payload).encode('utf-8')  # Has ", " instead of ","
   ```

2. **Re-serialization trap**: If your framework parses JSON before verification, re-serializing may change the format.

   **FastAPI (safer approach):**
   ```python
   from fastapi import Request
   
   @app.post("/webhook")
   async def webhook(request: Request):
       raw_body = await request.body()  # Get raw bytes
       signature = request.headers.get("X-Attentium-Signature")
       
       # Verify against RAW body, not re-serialized JSON
       expected = "sha256=" + hmac.new(
           webhook_secret.encode(),
           raw_body,  # <-- Use raw bytes
           hashlib.sha256
       ).hexdigest()
       
       if not hmac.compare_digest(signature, expected):
           return {"error": "Invalid signature"}, 401
       
       # Now parse JSON
       payload = json.loads(raw_body)
   ```

3. **Encoding issues**: Both the secret and payload must be UTF-8 encoded.

4. **Wrong secret**: Each campaign has a unique `webhook_secret`. Make sure you're using the correct one.

**Debug helper:**
```python
# Print what we're comparing
payload_json = json.dumps(request.json, separators=(',', ':'))
print(f"Payload: {payload_json}")
print(f"Received sig: {signature_header}")
print(f"Expected sig: sha256={expected_signature}")
```

### "401 Unauthorized" when fetching results

- Verify you're using the correct `read_key` for that specific campaign
- Check that the `read_key` is passed as a query parameter: `?key=YOUR_READ_KEY`

---

## Error Codes

| HTTP | Error | Description |
|------|-------|-------------|
| 400 | `missing_fields` | Missing required fields (`duration`, `bid_per_second`, or `validation_question`) |
| 400 | `invalid_duration` | Duration must be 10, 30, or 60 seconds |
| 400 | `transaction_not_found` | Solana transaction not confirmed yet (wait and retry) |
| 401 | `unauthorized` | Invalid or missing `read_key` for results endpoint |
| 402 | `payment_required` | No payment header provided; returns invoice |
| 402 | `invalid_payment` | Transaction validation failed (wrong amount, recipient, or token) |
| 403 | `expired_transaction` | Transaction older than 2 minutes (replay protection) |
| 403 | `rejected_tos` | Content rejected by moderation (funds forfeited) |
| 404 | `campaign_not_found` | No campaign exists with that transaction hash |
| 500 | `server_error` | Internal server error |

---

## Best Practices

1. **Store secrets securely**: Use environment variables or a secrets manager, never hardcode.

2. **Respond to webhooks fast**: Our webhooks have a 5-second timeout. Return 200 OK immediately and process asynchronously.

3. **Always poll as backup**: Webhooks are not retried. Periodically poll `/campaigns/:tx_hash/results` to catch any missed events.

4. **Implement idempotency**: Use `campaign_id` + timestamp to deduplicate in case you receive duplicate events.

---

## Support

- **Protocol Spec**: See [PROTOCOL.md](./PROTOCOL.md)
- **Issues**: Open a GitHub issue
- **Discord**: Join our developer community

---

*Built with ❤️ for AI Agent developers*
