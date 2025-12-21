import uuid
import requests
from solana.rpc.api import Client

# 1. Setup
API_URL = "http://localhost:3000/v1/verify" # Or localhost
CAMPAIGN_ID = str(uuid.uuid4())
HEADERS = {"X-Campaign-Id": CAMPAIGN_ID, "Content-Type": "application/json"}

print(f"🔹 Testing Campaign: {CAMPAIGN_ID}")

# 2. Simulate the Payment (If you are on Devnet/Bypass Mode)
# If using real mainnet, you'd actually send SOL/USDC here with the Memo.
# For now, we assume you are testing the BYPASS logic first.
payload = {
    "duration": 30,
    "quantity": 5,
    "bid_per_second": 0.05,
    "validation_question": "Is this a test?",
    "content_url": "https://example.com/image.png",
    # If using Bypass:
    "tx_hash": "devnet_bypass_tx_hash_example", 
    "bypass_mode": True 
}

# 3. Fire Request
try:
    response = requests.post(API_URL, json=payload, headers=HEADERS)
    
    if response.status_code == 200:
        print("✅ SUCCESS: Backend accepted the secured request.")
        print(response.json())
    elif response.status_code == 402:
        print("⚠️ PAYMENT REQUIRED: Logic is working (it asked for payment).")
        print(f"\n📄 Full 402 Response:")
        import json
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"❌ FAILED: {response.status_code}")
        print(response.text)

except Exception as e:
    print(f"❌ ERROR: {e}")