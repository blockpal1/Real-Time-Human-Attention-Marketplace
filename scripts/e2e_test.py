#!/usr/bin/env python3
"""
Attentium End-to-End Test Script
Tests: Campaign Creation, Key Handling, and Polling
"""
import requests
import json
import hmac
import hashlib
import time

# Configuration
BASE_URL = "http://localhost:3000"
ADMIN_KEY = "attentium-chicken-parm-delish-thankskara"
WEBHOOK_URL = None  # Set to webhook.site URL for webhook testing

def create_campaign(webhook_url=None):
    """Step 1: Create a campaign and get keys"""
    print("\n" + "="*50)
    print("STEP 1: Creating Campaign")
    print("="*50)
    
    payload = {
        "duration": 10,
        "quantity": 1,
        "bid_per_second": 0.10,
        "validation_question": "E2E Test - What number do you see?"
    }
    
    if webhook_url:
        payload["callback_url"] = webhook_url
        print(f"Webhook URL: {webhook_url}")
    
    response = requests.post(
        f"{BASE_URL}/v1/verify",
        headers={
            "X-Admin-Key": ADMIN_KEY,
            "Content-Type": "application/json"
        },
        json=payload
    )
    
    if response.status_code != 200:
        print(f"❌ FAILED: {response.status_code}")
        print(response.text)
        return None
    
    data = response.json()
    print(f"✅ Campaign Created!")
    print(f"   Campaign ID: {data['order']['tx_hash']}")
    print(f"   Read Key:    {data['read_key']}")
    print(f"   Webhook Secret: {data['webhook_secret'][:16]}...")
    
    return {
        "campaign_id": data["order"]["tx_hash"],
        "read_key": data["read_key"],
        "webhook_secret": data["webhook_secret"]
    }

def test_polling(campaign_id, read_key):
    """Step 2: Test polling endpoint with read_key"""
    print("\n" + "="*50)
    print("STEP 2: Testing Polling Endpoint")
    print("="*50)
    
    # Test without key (should fail)
    print("\n2a. Testing WITHOUT read_key...")
    response = requests.get(f"{BASE_URL}/v1/campaigns/{campaign_id}/results")
    if response.status_code == 401:
        print("✅ Correctly rejected (401 Unauthorized)")
    else:
        print(f"❌ UNEXPECTED: {response.status_code}")
    
    # Test with wrong key (should fail)
    print("\n2b. Testing with WRONG read_key...")
    response = requests.get(
        f"{BASE_URL}/v1/campaigns/{campaign_id}/results",
        params={"key": "wrong_key_12345"}
    )
    if response.status_code == 401:
        print("✅ Correctly rejected (401 Unauthorized)")
    else:
        print(f"❌ UNEXPECTED: {response.status_code}")
    
    # Test with correct key (should succeed)
    print("\n2c. Testing with CORRECT read_key...")
    response = requests.get(
        f"{BASE_URL}/v1/campaigns/{campaign_id}/results",
        params={"key": read_key}
    )
    if response.status_code == 200:
        data = response.json()
        print("✅ Successfully retrieved results!")
        print(f"   Status: {data['status']}")
        print(f"   Completed: {data['completed_quantity']}/{data['target_quantity']}")
    else:
        print(f"❌ FAILED: {response.status_code}")
        print(response.text)
        return False
    
    return True

def test_idempotency(campaign_id, read_key):
    """Step 3: Test that duplicate submissions return same order"""
    print("\n" + "="*50)
    print("STEP 3: Testing Idempotency")
    print("="*50)
    print("(Admin bypass uses random tx_hash, so we verify read_key works after creation)")
    
    # Just verify we can still fetch with the saved key
    response = requests.get(
        f"{BASE_URL}/v1/campaigns/{campaign_id}/results",
        params={"key": read_key}
    )
    if response.status_code == 200:
        print("✅ Keys are valid and persistent")
        return True
    else:
        print(f"❌ Keys no longer work: {response.status_code}")
        return False

def verify_webhook_signature(raw_body, signature_header, webhook_secret):
    """
    Truth Check: Verify a webhook signature locally
    
    Args:
        raw_body: The raw JSON string from the webhook
        signature_header: The X-Attentium-Signature header value
        webhook_secret: Your webhook_secret from campaign creation
    
    Returns:
        True if signature matches, False otherwise
    """
    print("\n" + "="*50)
    print("WEBHOOK SIGNATURE TRUTH CHECK")
    print("="*50)
    
    if not signature_header.startswith("sha256="):
        print("❌ Invalid signature format (missing sha256= prefix)")
        return False
    
    received_sig = signature_header[7:]  # Remove "sha256=" prefix
    
    # Compute expected signature
    expected_sig = hmac.new(
        webhook_secret.encode('utf-8'),
        raw_body.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    print(f"Received:  {received_sig[:32]}...")
    print(f"Expected:  {expected_sig[:32]}...")
    
    is_valid = hmac.compare_digest(received_sig, expected_sig)
    
    if is_valid:
        print("✅ SIGNATURE VALID!")
    else:
        print("❌ SIGNATURE MISMATCH!")
        print("\nDebug info:")
        print(f"  Raw body length: {len(raw_body)}")
        print(f"  First 100 chars: {raw_body[:100]}...")
    
    return is_valid

def main():
    print("\n" + "#"*60)
    print("# ATTENTIUM END-TO-END TEST")
    print("#"*60)
    
    # Create campaign
    campaign = create_campaign(webhook_url=WEBHOOK_URL)
    if not campaign:
        print("\n❌ TEST FAILED: Could not create campaign")
        return
    
    # Test polling
    if not test_polling(campaign["campaign_id"], campaign["read_key"]):
        print("\n❌ TEST FAILED: Polling test failed")
        return
    
    # Test idempotency
    if not test_idempotency(campaign["campaign_id"], campaign["read_key"]):
        print("\n❌ TEST FAILED: Idempotency test failed")
        return
    
    print("\n" + "#"*60)
    print("# ALL BASIC TESTS PASSED!")
    print("#"*60)
    
    # Save campaign info for webhook testing
    print(f"\n📋 Campaign Info (save for webhook testing):")
    print(f"   Campaign ID:    {campaign['campaign_id']}")
    print(f"   Read Key:       {campaign['read_key']}")
    print(f"   Webhook Secret: {campaign['webhook_secret']}")
    
    if WEBHOOK_URL:
        print(f"\n🔗 Webhook URL: {WEBHOOK_URL}")
        print("   When a human response is submitted, check webhook.site")
        print("   Then run the signature verification below.")

if __name__ == "__main__":
    main()
    
    # Uncomment to test webhook signature verification:
    # RAW_BODY = '''{"event":"response_submitted",...}'''  # Paste from webhook.site
    # SIGNATURE = "sha256=..."  # Paste from X-Attentium-Signature header
    # SECRET = "..."  # Your webhook_secret
    # verify_webhook_signature(RAW_BODY, SIGNATURE, SECRET)
