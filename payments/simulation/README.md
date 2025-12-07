# Payment Simulation

> Mock Solana Ledger and Payment Router for verifying settlement logic.

## Run

```bash
npm install
npx ts-node src/main.ts
```

## Expected Output

```
=== Starting Attention Marketplace Payment Simulation ===
-> Agent creates Escrow...
-> Simulating 5 seconds of attention...
-> Triggering Settlement...
SUCCESS: User received exactly 0.5 USDC
```

## Files

| File        | Purpose                                      |
|-------------|----------------------------------------------|
| `ledger.ts` | In-memory Solana-like balance tracking       |
| `router.ts` | Escrow creation & settlement logic           |
| `main.ts`   | Demo script                                  |
