"""
Signal Quality Smoke Test
Quick end-to-end test of the quality gate system
"""
import requests
import redis
import time
import uuid

API_URL = "http://localhost:3000/v1"
REDIS_HOST = "localhost"
REDIS_PORT = 6379

def main():
    print("=== Signal Quality Smoke Test ===\n")
    
    # Setup
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    test_wallet = f"SmokeTest_{uuid.uuid4().hex[:8]}"
    
    print(f"Test wallet: {test_wallet}")
    print(f"API: {API_URL}\n")
    
    # Test 1: Good answer → payment
    print("Test 1: Good Answer")
    print("-" * 40)
    
    response = requests.post(f"{API_URL}/matches/smoke_test_1/complete", json={
        "answer": "The cat is orange and fluffy",
        "actualDuration": 30,
        "exitedEarly": False,
        "bidId": "smoke_bid_1",
        "wallet": test_wallet
    })
    
    quality_1 = r.hget(f"user:{test_wallet}", "quality")
    print(f"Response: {response.status_code}")
    print(f"Success: {response.json().get('success')}")
    print(f"Quality: {quality_1}")
    
    assert response.status_code == 200, "Should return 200"
    assert response.json().get("success") == True, "Should succeed"
    assert quality_1 == "51", f"Quality should be 51, got {quality_1}"
    print("✓ Test 1 passed\n")
    
    # Test 2: Bad answer → rejection
    print("Test 2: Bad Answer (Spam)")
    print("-" * 40)
    
    response = requests.post(f"{API_URL}/matches/smoke_test_2/complete", json={
        "answer": "asdfhjkl",
        "actualDuration": 30,
        "exitedEarly": False,
        "bidId": "smoke_bid_2",
        "wallet": test_wallet
    })
    
    quality_2 = r.hget(f"user:{test_wallet}", "quality")
    print(f"Response: {response.status_code}")
    print(f"Status: {response.json().get('status')}")
    print(f"Success: {response.json().get('success')}")
    print(f"Quality: {quality_2}")
    
    assert response.status_code == 200, "Should return 200 (game state)"
    assert response.json().get("status") == "rejected", "Should be rejected"
    assert response.json().get("success") == False, "Should not succeed"
    assert quality_2 == "41", f"Quality should be 41, got {quality_2}"
    print("✓ Test 2 passed\n")
    
    # Test 3: Redis quality check
    print("Test 3: Redis Verification")
    print("-" * 40)
    
    user_data = r.hgetall(f"user:{test_wallet}")
    print(f"User data: {user_data}")
    
    assert "quality" in user_data, "Should have quality field"
    assert "lastActive" in user_data, "Should have lastActive field"
    print("✓ Test 3 passed\n")
    
    # Cleanup
    r.delete(f"user:{test_wallet}")
    print(f"✓ Cleaned up test data")
    
    print("\n✅ All smoke tests passed!")

if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
        exit(1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        exit(1)
