# Payment Router Setup Guide

This guide covers one-time setup steps required after deploying the Payment Router program.

---

## Prerequisites

- Solana CLI installed (`solana --version`)
- Node.js 18+ and npm
- Access to Devnet or Mainnet
- Admin keypair (the deployer wallet)

---

## 1. Program Deployment

The Payment Router program should already be deployed. Verify:

```bash
solana program show H4zbWKDAGnrJv9CTptjVvxKCDB59Mv2KpiVDx9d4jDaz --url devnet
```

Expected output includes `Program Id: H4zbWKDAGnrJv9CTptjVvxKCDB59Mv2KpiVDx9d4jDaz`.

---

## 2. Initialize Market Config

The `market_config` PDA must be initialized once per program deployment. This stores the router authority and fee settings.

### Run Initialization Script

```bash
cd backend
npx ts-node src/init_market_config.ts
```

### Expected Output

```
=== Initializing Market Config (Anchor) ===
Program ID: H4zbWKDAGnrJv9CTptjVvxKCDB59Mv2KpiVDx9d4jDaz
Admin Pubkey: 4BTmGg6w7wQiqMqJmrHdacKE8gvhqepDAt5WE8o3DtdE
Market Config PDA: 7jF3keTaq7LNnBZzWSbJEHvuMxSeMVWjkwmvKrdTFGc2
✅ Market Config initialized!
```

If already initialized, you'll see:
```
✅ Market Config already initialized!
```

---

## 3. Environment Variables

Add these to `backend/.env`:

```env
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
PAYMENT_ROUTER_PROGRAM_ID=H4zbWKDAGnrJv9CTptjVvxKCDB59Mv2KpiVDx9d4jDaz

# Router Authority (JSON array of keypair bytes)
# This is the admin who can call close_settlement
ROUTER_ADMIN_KEYPAIR=[1,2,3,...,64]

# Optional: Fee Payer for subsidized gas
FEE_PAYER_KEYPAIR=[1,2,3,...,64]
```

### Finding Your Keypair Bytes

```bash
# If you have a keypair file:
cat ~/.config/solana/id.json
# Copy the array of numbers
```

---

## 4. Verify Setup

### Check Market Config Exists

```bash
npx ts-node src/init_market_config.ts
# Should show "already initialized"
```

### Check Backend Loads Correctly

```bash
npm run dev
# Look for: "[Settlement] Router Admin loaded: 4BTmGg6w7wQiqMqJmrHdacKE8gvhqepDAt5WE8o3DtdE"
```

---

## 5. Test Claim Flow

1. **Add Test Settlement Data**:
   ```bash
   npx ts-node src/fix_redis.ts
   ```

2. **Open Frontend** at `http://localhost:5173`

3. **Click "Claim to Wallet"**

4. **Sign the Transaction** in Phantom

5. **Verify Success** - Transaction appears on Solana Explorer

---

## Troubleshooting

### Error: "AccountNotInitialized" for market_config

Run the initialization script:
```bash
npx ts-node src/init_market_config.ts
```

### Error: "IncorrectProgramId"

Ensure `PAYMENT_ROUTER_PROGRAM_ID` in `.env` matches the deployed program.

### Error: "Insufficient funds in escrow"

The escrow PDA doesn't have enough USDC. Agents must deposit via `deposit_escrow` first.

### Error: "Wallet not connected"

Ensure Phantom is connected to Devnet and the wallet is the same as `userPubkey`.

---

## Network Configuration

| Environment | RPC URL | USDC Mint |
|-------------|---------|-----------|
| **Devnet** | `https://api.devnet.solana.com` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU` |
| **Mainnet** | `https://api.mainnet-beta.solana.com` | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |

The backend automatically detects the network from `SOLANA_RPC_URL` and uses the correct USDC mint.
