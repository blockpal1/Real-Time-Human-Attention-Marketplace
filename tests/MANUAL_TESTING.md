# Signal Quality Manual Testing Guide

## Prerequisites
- Backend running on `localhost:3000`
- Frontend running on `localhost:5173`
- Redis running on `localhost:6379`
- `OPENAI_Bouncer_Key` set in `.env`

---

## Test 1: Happy Path (Good Worker)

### Steps:
1. Open browser to `http://localhost:5173`
2. Connect wallet
3. Accept a match
4. Complete liveness check
5. View content for full duration
6. **Answer validation question with relevant text:**
   - Example: "The cat is orange and sitting on a chair"
7. Click "SUBMIT & FINISH"

### Expected Result:
```
✓ "Success! Verifying..." (green checkmark + spinner)
  ↓ (~500ms)
✓ "THANK YOU!" + earnings display
```

### Verify in Redis:
```bash
redis-cli HGETALL user:<your-wallet>
# Expected: quality: "51" (started at 50, +1 for good answer)
```

---

## Test 2: Rejection (Spam Answer)

### Steps:
1. Accept another match
2. Complete normally
3. **Answer validation question with gibberish:**
   - Example: "asdfhjkl" or "good"
4. Click "SUBMIT & FINISH"

### Expected Result:
```
✓ "Success! Verifying..."
  ↓
⚠️ "SUBMISSION REJECTED" (orange warning)
   "Submission rejected by Quality Control"
   "No payment for this task. Try again with a relevant answer."
   [CONTINUE button]
```

### Verify in Redis:
```bash
redis-cli HGETALL user:<your-wallet>
# Expected: quality: "41" (51 - 10 penalty)
```

---

## Test 3: Ban (Repeat Spammer)

### Steps:
1. Manually set quality to 25:
   ```bash
   redis-cli HSET user:<your-wallet> quality 25
   ```
2. Accept match
3. Submit gibberish answer
4. Click "SUBMIT & FINISH"

### Expected Result:
```
✓ "Success! Verifying..."
  ↓
🚫 "ACCOUNT SUSPENDED" (red)
   "Account suspended for low signal quality"
   "Your Signal Quality score is too low."
   [LOG OUT button (red)]
```

### Verify in Redis:
```bash
redis-cli HGETALL user:<your-wallet>
# Expected: quality: "15" (below 20 threshold)
```

---

## Test 4: Time Decay

### Steps:
1. Set quality and old timestamp:
   ```bash
   redis-cli HSET user:<your-wallet> quality 50
   redis-cli HSET user:<your-wallet> lastActive $(($(date +%s) - 604800))000
   # 604800 = 7 days in seconds
   ```
2. Submit any answer
3. Check quality after

### Expected Result:
```bash
redis-cli HGET user:<your-wallet> quality
# Expected: "44" (50 - 7 days decay + 1 reward)
```

---

## Browser Console Logs

Watch for these logs:
```
[TrustService] AI verdict for "asdf...": FAIL
[TrustService] User TestWallet... quality: 40 (LOW_SIGNAL)
```

Or for good answers:
```
[TrustService] AI verdict for "The cat is orange...": PASS
[TrustService] User TestWallet... quality: 51 (HIGH_SIGNAL)
```
