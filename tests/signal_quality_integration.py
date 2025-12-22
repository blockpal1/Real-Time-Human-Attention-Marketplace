"""
Signal Quality Integration Test
Tests the full flow: submit answer → AI check → quality update → payment
"""
import requests
import time
import redis

API_URL = "http://localhost:3000/v1"
REDIS_HOST = "localhost"
REDIS_PORT = 6379

# Test wallet
TEST_WALLET = "TestWallet123"

def setup_redis():
    """Clear test user data"""
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    r.delete(f"user:{TEST_WALLET}")
    print(f"✓ Cleared Redis data for {TEST_WALLET}")
    return r

def get_quality(r):
    """Get current quality score"""
    quality = r.hget(f"user:{TEST_WALLET}", "quality")
    return int(quality) if quality else 50

def test_good_worker():
    """Scenario A: Good worker submits relevant answer"""
    print("\n=== Test A: Good Worker ===")
    r = setup_redis()
    
    # Initial quality should be 50
    initial_quality = get_quality(r)
    print(f"Initial quality: {initial_quality}")
    
    # Submit good answer (mock match completion)
    response = requests.post(f"{API_URL}/matches/test_match_123/complete", json={
        "answer": "The cat is orange and fluffy",
        "actualDuration": 30,
        "exitedEarly": False,
        "bidId": "test_bid",
        "wallet": TEST_WALLET
    })
    
    print(f"Response: {response.status_code}")
    print(f"Body: {response.json()}")
    
    # Check quality increased
    new_quality = get_quality(r)
    print(f"New quality: {new_quality}")
    
    assert response.status_code == 200, "Should return 200 OK"
    assert response.json().get("success") == True, "Should succeed"
    assert new_quality == initial_quality + 1, f"Quality should increase by 1 (was {initial_quality}, now {new_quality})"
    print("✓ Test A passed")

def test_spammer():
    """Scenario B: Spammer submits gibberish"""
    print("\n=== Test B: Spammer ===")
    r = setup_redis()
    
    initial_quality = get_quality(r)
    print(f"Initial quality: {initial_quality}")
    
    # Submit gibberish
    response = requests.post(f"{API_URL}/matches/test_match_456/complete", json={
        "answer": "asdfhjkl",
        "actualDuration": 30,
        "exitedEarly": False,
        "bidId": "test_bid_2",
        "wallet": TEST_WALLET
    })
    
    print(f"Response: {response.status_code}")
    print(f"Body: {response.json()}")
    
    new_quality = get_quality(r)
    print(f"New quality: {new_quality}")
    
    assert response.status_code == 200, "Should return 200 OK (game state)"
    assert response.json().get("status") == "rejected", "Should be rejected"
    assert response.json().get("success") == False, "Should not succeed"
    assert new_quality == initial_quality - 10, f"Quality should decrease by 10"
    print("✓ Test B passed")

def test_ban():
    """Scenario C: Repeat spammer gets banned"""
    print("\n=== Test C: Ban Threshold ===")
    r = setup_redis()
    
    # Set quality to 25 (close to ban threshold)
    r.hset(f"user:{TEST_WALLET}", "quality", "25")
    r.hset(f"user:{TEST_WALLET}", "lastActive", str(int(time.time() * 1000)))
    
    initial_quality = get_quality(r)
    print(f"Initial quality: {initial_quality}")
    
    # Submit spam (should drop to 15 and trigger ban)
    response = requests.post(f"{API_URL}/matches/test_match_789/complete", json={
        "answer": "spam spam spam",
        "actualDuration": 30,
        "exitedEarly": False,
        "bidId": "test_bid_3",
        "wallet": TEST_WALLET
    })
    
    print(f"Response: {response.status_code}")
    print(f"Body: {response.json()}")
    
    new_quality = get_quality(r)
    print(f"New quality: {new_quality}")
    
    assert response.status_code == 403, "Should return 403 Forbidden"
    assert response.json().get("status") == "banned", "Should be banned"
    assert new_quality < 20, "Quality should be below ban threshold"
    print("✓ Test C passed")

def test_time_decay():
    """Test time decay (1 point per day)"""
    print("\n=== Test D: Time Decay ===")
    r = setup_redis()
    
    # Set quality to 50, last active 7 days ago
    seven_days_ago = int((time.time() - 7 * 24 * 60 * 60) * 1000)
    r.hset(f"user:{TEST_WALLET}", "quality", "50")
    r.hset(f"user:{TEST_WALLET}", "lastActive", str(seven_days_ago))
    
    print(f"Set quality: 50, last active: 7 days ago")
    
    # Submit good answer
    response = requests.post(f"{API_URL}/matches/test_match_decay/complete", json={
        "answer": "Good answer",
        "actualDuration": 30,
        "exitedEarly": False,
        "bidId": "test_bid_decay",
        "wallet": TEST_WALLET
    })
    
    new_quality = get_quality(r)
    print(f"New quality: {new_quality}")
    
    # 50 - 7 (decay) + 1 (reward) = 44
    assert new_quality == 44, f"Quality should be 44 (50 - 7 + 1), got {new_quality}"
    print("✓ Test D passed")

if __name__ == "__main__":
    print("Starting Signal Quality Integration Tests...")
    print(f"API: {API_URL}")
    print(f"Redis: {REDIS_HOST}:{REDIS_PORT}")
    
    try:
        test_good_worker()
        test_spammer()
        test_ban()
        test_time_decay()
        print("\n✅ All integration tests passed!")
    except AssertionError as e:
        print(f"\n❌ Test failed: {e}")
    except Exception as e:
        print(f"\n❌ Error: {e}")
