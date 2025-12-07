# Matching Engine

> Greedy order book for matching Agent Bids to User Attention.

## Run

```bash
npm install
npx ts-node src/index.ts
```

## Logic

1. Bids are sorted by `maxPrice` descending.
2. When an Ask (User Attention) arrives, the highest-paying compatible Bid is matched.
3. Matched Bid is removed from the book.

## Files

| File           | Purpose                     |
|----------------|-----------------------------|
| `orderbook.ts` | `OrderBook` class with Bid/Ask matching |
| `index.ts`     | Simulation loop (demo)      |
