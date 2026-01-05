# Payment Router Setup Guide

This guide covers the **zero-to-one** setup process for deploying and initializing the Payment Router program using **Solana Playground** (no CLI required).

---

## Prerequisites

1.  **Solana Playground**: Open [beta.solpg.io](https://beta.solpg.io) in your browser.
2.  **Wallet**: A Phantom or Solflare wallet with Devnet SOL.
3.  **Source Code**: The `payment-router` directory from this repository.

---

## 1. Deploy Program (Solana Playground)

We avoid using the Solana CLI. Instead, we use the browser-based IDE.

### Step 1.1: Import Project
1.  Go to [beta.solpg.io](https://beta.solpg.io).
2.  Click the **"Import"** icon (folder with arrow) in the sidebar.
3.  Select **"Import from local"**.
4.  Choose the `payment-router` folder from your local project.
5.  *Tip: If it asks for a project name, use `payment-router`.*

### Step 1.2: Connect Wallet
1.  Click **"Not connected"** in the bottom-left corner.
2.  Select your Phantom/Solflare wallet.
3.  Ensure your wallet is on **Devnet** (Settings > Developer Settings > Change Network > Devnet).
4.  If you need funds, type `solana airdrop 2` in the Playground terminal.

### Step 1.3: Build & Deploy
1.  Click the **"Build and Deploy"** icon (hammer and wrench) in the sidebar.
2.  Click **"Build"**. Wait for "Build successful".
3.  Click **"Deploy"**. Approve the transaction in your wallet.
4.  **Copy the Program ID**: once deployed, the Program ID will be shown in the terminal.
    *   *Example Output*: `Deployment successful. Program ID: EofaQa9...`

---

## 2. Environment Configuration

You must update your local environment variables with the new Program ID.

### Frontend (`frontend/.env`)

```env
# The ID you just copied from Solana Playground
VITE_PAYMENT_ROUTER_PROGRAM_ID=EofaQa9USK8GtzfnCbqdfnhjeUrRTJoWL2jjSCD6c4Y2

# RPC URL (Use Helius/Alchemy or public Devnet)
VITE_SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Backend (`backend/.env`)

```env
# Must match the frontend ID
PAYMENT_ROUTER_PROGRAM_ID=EofaQa9USK8GtzfnCbqdfnhjeUrRTJoWL2jjSCD6c4Y2

# Solana Devnet RPC
SOLANA_RPC_URL=https://api.devnet.solana.com

# Admin Keypair (Array of numbers)
# This is the wallet that deployed the program.
# Export private key from Phantom -> Settings -> Export Private Key
# Convert Base58 to JSON Array format (use a tool or script)
ROUTER_ADMIN_KEYPAIR=[142, 25, 201, ...]
```

---

## 3. Initialize Market Config

The `market_config` and `fee_vault` PDAs must be initialized once. We run a script from your local machine to do this.

### Option A: Run Local Script (Recommended)

1.  Open a terminal in your project root.
2.  Navigate to the router folder:
    ```bash
    cd payment-router
    ```
3.  Install dependencies (if not done):
    ```bash
    npm install
    ```
4.  Run the initialization script:
    ```bash
    npx ts-node scripts/init_market.ts
    ```

### Option B: Initialize via Solana Playground (Browser Only)

If you cannot run local scripts, you can run this client script directly in Playground.

1.  In Solana Playground, verify you are connected with the **Deployer Wallet**.
2.  In the sidebar, click the **"Client"** icon (paper with "JS").
3.  Create a new file named `init.ts`.
4.  Paste the following code:

    ```typescript
    // Client script to run in Solana Playground
    console.log("Initializing via Playground...");

    // 1. Derive PDAs
    const [marketConfigPDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("market_config")],
      pg.program.programId
    );

    const [feeVaultStatePDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("fee_vault_state")],
      pg.program.programId
    );

    const [feeVaultPDA] = web3.PublicKey.findProgramAddressSync(
      [Buffer.from("fee_vault"), feeVaultStatePDA.toBuffer()],
      pg.program.programId
    );

    // 2. Initialize Market Config
    try {
      const tx = await pg.program.methods.initializeMarketConfig(1500) // 15% fee
        .accounts({
          admin: pg.wallet.publicKey,
          config: marketConfigPDA,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();
      console.log("✅ Market Config initialized! Tx:", tx);
    } catch (e) {
      console.log("Market Config status:", e.message);
    }

    // 3. Initialize Fee Vault
    const USDC_MINT = new web3.PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Devnet
    try {
      const tx2 = await pg.program.methods.initializeFeeVault()
        .accounts({
          admin: pg.wallet.publicKey,
          feeVaultState: feeVaultStatePDA,
          feeVault: feeVaultPDA,
          mint: USDC_MINT,
          systemProgram: web3.SystemProgram.programId,
          tokenProgram: new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), // Token Program
          rent: web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
      console.log("✅ Fee Vault initialized! Tx:", tx2);
    } catch (e) {
        console.log("Fee Vault status:", e.message);
    }
    ```

5.  Click the **"Run"** button (Wait for "Running client..." output).

### Expected Output
```text
✅ Market Config initialized! Tx: ...
✅ Fee Vault initialized! Tx: ...
```
*(If run again, you may see error messages about "already in use". This is safe.)*

---

## 4. Verify IDL

The frontend needs the **IDL (Interface Description Language)** to talk to the program.

### Build & Export IDL
1.  In **Solana Playground**, go to the "Build" tab.
2.  Click the small "IDL" button (usually near Build/Deploy).
3.  Or verify `target/idl/payment_router.json` was created in your local `payment-router` folder if you built locally.
4.  **Crucial**: Ensure `frontend/src/idl/payment_router.json` matches the latest build. Copy it over if needed.

---

## 5. End-to-End Test

1.  **Start Backend**:
    ```bash
    cd backend
    npm run dev
    ```
    *Look for: `[Settlement] Router Admin loaded`*

2.  **Start Frontend**:
    ```bash
    cd frontend
    npm run dev
    ```

3.  **Test Claim**:
    *   Go to `http://localhost:5173`.
    *   Connect the wallet you used to deploy (or any wallet).
    *   Click the "Earnings" dropdown -> "Claim to Wallet".
    *   Sign the transaction.
    *   **Success**: You should see a "Claim Submitted" toast and a transaction link.

---

## Troubleshooting

### "Program Not Found"
*   Did you update `frontend/.env` with the new Program ID?
*   Did you restart the frontend server after changing `.env`?

### "AccountNotInitialized"
*   You forgot **Step 3**. The program exists, but the market config settings haven't been saved yet. Run `npx ts-node scripts/init_market.ts`.

### "Signature verification failed"
*   The `ROUTER_ADMIN_KEYPAIR` in `backend/.env` does not match the authority set in `market_config`.
*   *Fix*: Ensure you put the **Deployer Wallet's** private key in `backend/.env`.

### "RPC Error 403 / 429"
*   Public Devnet nodes are flaky. Use a free Helius or Alchemy RPC URL in `.env`.
