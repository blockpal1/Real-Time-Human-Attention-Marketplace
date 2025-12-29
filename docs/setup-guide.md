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

## 2. Initialize Market Config & Fee Vault
 
The `market_config` and `fee_vault` PDAs must be initialized once per program deployment. This stores the router authority, fee settings, and fee collection vault.
 
### Run Initialization Script
 
We use a unified script that loads configuration from `frontend/.env`.
 
```bash
cd payment-router
npx ts-node scripts/init_market.ts
```
 
### Expected Output
 
```
Loading config from: .../frontend/.env
Initializing Payment Router...
Program ID: ...
✅ Market Config initialized successfully.
✅ Fee Vault initialized successfully.
```
 
If already initialized, you'll see:
```
✅ Market Config already initialized.
✅ Fee Vault already initialized.
```
 
---
 
## 3. Environment Variables
 
### Public Configuration (`frontend/.env`)
 
The initialization script reads these values directly from your frontend configuration:
 
```env
# Program ID for the Payment Router
VITE_PAYMENT_ROUTER_PROGRAM_ID=EofaQa9USK8GtzfnCbqdfnhjeUrRTJoWL2jjSCD6c4Y2
 
# (Optional) Devnet/Mainnet RPC URL - defaults to Devnet if unset
ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
```
 
### Backend Secrets (`backend/.env`)
 
Add these secrets to `backend/.env` for the Settlement Service:
 
```env
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
# Must match the frontend VITE_ var above
PAYMENT_ROUTER_PROGRAM_ID=EofaQa9USK8GtzfnCbqdfnhjeUrRTJoWL2jjSCD6c4Y2

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
cd payment-router
npx ts-node scripts/init_market.ts
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
