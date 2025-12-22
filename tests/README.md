# Signal Quality Testing Suite

Comprehensive tests for the AI-powered Signal Quality gate-before-pay system.

---

## Quick Start

```bash
# 1. Run smoke test (fastest)
cd tests
python smoke_test_quality.py

# 2. Run integration tests
python signal_quality_integration.py

# 3. Run unit tests
cd ../backend
npm test -- TrustService.test.ts
```

---

## Test Files

| File | Type | Purpose |
|------|------|---------|
| `smoke_test_quality.py` | Smoke | Quick end-to-end validation |
| `signal_quality_integration.py` | Integration | Full flow testing |
| `TrustService.test.ts` | Unit | Isolated component tests |
| `MANUAL_TESTING.md` | Manual | Browser testing guide |
| `test_openai_bouncer.sh` | API | OpenAI prompt validation |
| `verify_redis.sh` | State | Redis inspection tools |

---

## 1. Unit Tests (Jest)

**File:** `backend/src/__tests__/TrustService.test.ts`

```bash
cd backend
npm test -- TrustService.test.ts
```

**Coverage:**
- ✅ AI validation (PASS/FAIL/error handling)
- ✅ Quality scoring (+1/-10)
- ✅ Time decay (1 point/day)
- ✅ Ban threshold (< 20)
- ✅ New user initialization

---

## 2. Integration Tests (Python)

**File:** `tests/signal_quality_integration.py`

```bash
cd tests
python signal_quality_integration.py
```

**Scenarios:**
- Good worker → quality +1, payment credited
- Spammer → quality -10, rejected
- Repeat spammer → banned
- Time decay → 7 days = -7 points

---

## 3. Manual Testing (Browser)

**File:** `tests/MANUAL_TESTING.md`

Open the guide and follow step-by-step:
1. Good answer → earnings
2. Spam → rejection
3. Repeat spam → ban
4. Time decay verification

---

## 4. OpenAI Bouncer Test (Bash)

**File:** `tests/test_openai_bouncer.sh`

```bash
cd tests
chmod +x test_openai_bouncer.sh
./test_openai_bouncer.sh
```

Tests the AI prompt with known good/bad Q&A pairs.

---

## 5. Redis Verification (Bash)

**File:** `tests/verify_redis.sh`

```bash
cd tests
chmod +x verify_redis.sh

# Check user quality
./verify_redis.sh check <wallet>

# List all users
./verify_redis.sh list

# Simulate spam attack
./verify_redis.sh simulate <wallet>

# Reset user
./verify_redis.sh reset <wallet>
```

---

## 6. Smoke Test (Python)

**File:** `tests/smoke_test_quality.py`

```bash
cd tests
python smoke_test_quality.py
```

Quick validation:
1. Good answer → payment
2. Bad answer → rejection
3. Redis state verification

---

## Prerequisites

### For Python tests:
```bash
pip install requests redis
```

### For Jest tests:
```bash
cd backend
npm install --save-dev jest @types/jest ts-jest
```

### Environment:
- Backend running on `localhost:3000`
- Redis running on `localhost:6379`
- `OPENAI_Bouncer_Key` in `.env`

---

## Expected Results

### Good Answer
```
✓ AI verdict: PASS
✓ Quality: 50 → 51
✓ Payment credited
```

### Spam Answer
```
✓ AI verdict: FAIL
✓ Quality: 50 → 40
✓ Status: rejected (no payment)
```

### Banned
```
✓ Quality: 25 → 15
✓ Status: banned (403)
```
