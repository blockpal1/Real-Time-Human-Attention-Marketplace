# @attentium/sdk

TypeScript SDK for the Attentium x402 Payment Protocol. Enables AI agents to interact with the Human Attention Marketplace.

## Installation

```bash
npm install @attentium/sdk @solana/web3.js
```

## Quick Start

```typescript
import { AttentiumClient, Duration } from '@attentium/sdk';
import { Keypair } from '@solana/web3.js';

// Load your wallet
const wallet = Keypair.fromSecretKey(/* your secret key */);

// Create client
const client = new AttentiumClient({
  apiUrl: 'https://api.attentium.io/v1',
  wallet: wallet,
  // Optional: use devnet
  // rpcUrl: 'https://api.devnet.solana.com',
  // useDevnet: true,
});

// Request a verification slot (handles payment automatically)
const result = await client.requestVerification({
  duration: Duration.THIRTY_SECONDS,  // 30 seconds
  bidPerSecond: 0.05,                 // $0.05/second = $1.50 total
});

console.log('Verification successful:', result);
// {
//   success: true,
//   order: {
//     duration: 30,
//     bidPerSecond: 0.05,
//     totalEscrow: 1.5,
//     txHash: '5abc...',
//     payer: '7xKX...',
//   }
// }
```

## With Referrer (Revenue Sharing)

If you're building on top of Attentium, include your wallet as a referrer to earn 20% of the transaction:

```typescript
const result = await client.requestVerification({
  duration: Duration.THIRTY_SECONDS,
  bidPerSecond: 0.05,
  referrer: 'YOUR_WALLET_ADDRESS',  // Receive 20% revenue share
});
```

## Manual Flow (Get Invoice First)

If you need more control, you can get the invoice without paying:

```typescript
// Step 1: Get invoice
const invoice = await client.getInvoice({
  duration: Duration.SIXTY_SECONDS,
  bidPerSecond: 0.01,
});

console.log('Payment required:', invoice);
// {
//   chain: 'solana',
//   token: 'USDC',
//   amount: 0.6,
//   recipient: 'AttVau1t...',
//   duration: 60,
//   bidPerSecond: 0.01
// }

// Step 2: Pay and verify (when ready)
const result = await client.requestVerification({
  duration: Duration.SIXTY_SECONDS,
  bidPerSecond: 0.01,
});
```

## Check USDC Balance

```typescript
const balance = await client.getUsdcBalance();
console.log('USDC Balance:', balance);
```

## Configuration Options

```typescript
interface AttentiumConfig {
  apiUrl: string;           // API base URL
  wallet: Keypair;          // Solana keypair
  rpcUrl?: string;          // Custom RPC URL
  useDevnet?: boolean;      // Use devnet USDC mint
}
```

## Duration Options

| Duration | Constant | Minimum Bid | Min Total |
|----------|----------|-------------|-----------|
| 10s | `Duration.TEN_SECONDS` | $0.0001/s | $0.001 |
| 30s | `Duration.THIRTY_SECONDS` | $0.0001/s | $0.003 |
| 60s | `Duration.SIXTY_SECONDS` | $0.0001/s | $0.006 |

## Error Handling

```typescript
try {
  const result = await client.requestVerification({
    duration: Duration.THIRTY_SECONDS,
    bidPerSecond: 0.05,
  });
} catch (error) {
  if (error.message.includes('Validation error')) {
    console.error('Invalid request:', error.message);
  } else if (error.message.includes('Insufficient')) {
    console.error('Not enough USDC balance');
  } else {
    console.error('Verification failed:', error);
  }
}
```

## License

MIT
