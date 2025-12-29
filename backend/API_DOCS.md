# Payment Router API Documentation

## Builder Endpoints

### 1. Get Builder Balance
Retrieves the on-chain claimable balance and total lifetime earnings for a specific builder code.

- **URL:** `/v1/builders/:code/balance`
- **Method:** `GET`
- **Response:**
  ```json
  {
    "code": "GEN-XY12",
    "wallet": "Pubkey...",
    "claimableBalance": 12.50, // USDC
    "lifetimeEarnings": 150.00 // USDC
  }
  ```

### 2. Create Claim Transaction
Generates an unsigned Solana transaction to claim accumulated earnings. The builder's wallet must sign this transaction.

- **URL:** `/v1/builders/:code/claim`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "wallet": "Pubkey..." // The registered builder wallet public key
  }
  ```
- **Response:**
  ```json
  {
    "transaction": "Base64EncodedTxString...",
    "message": "Sign this transaction to claim your earnings."
  }
  ```

### 3. Update Builder Wallet
Generates an unsigned transaction to update the registered payout wallet. Must be signed by the **current** registered wallet.

- **URL:** `/v1/builders/:code/update-wallet`
- **Method:** `POST`
- **Body:**
  ```json
  {
    "oldWallet": "OldPubkey...",
    "newWallet": "NewPubkey..."
  }
  ```
- **Response:**
  ```json
  {
    "transaction": "Base64EncodedTxString...",
    "message": "Sign this transaction with your OLD wallet..."
  }
  ```

## Admin Endpoints

### 1. Register Builder Code
Creates a new builder code and initializes the on-chain `BuilderBalance` PDA.

- **URL:** `/v1/admin/builders/create`
- **Method:** `POST`
- **Headers:** `x-admin-key: <ADMIN_SECRET>`
- **Body:**
  ```json
  {
    "code": "GEN-NEW", // Optional, auto-generated if omitted
    "payout_wallet": "Pubkey...", // Required for on-chain reg
    "owner_email": "builder@example.com",
    "description": "Genesis Builder"
  }
  ```

### 2. Sweep Protocol Fees
Sweeps accumulated protocol fees from the centralized Fee Vault to the admin wallet.

- **URL:** `/v1/admin/fees/sweep`
- **Method:** `POST`
- **Headers:** `x-admin-key: <ADMIN_SECRET>`
- **Response:**
  ```json
  {
    "success": true,
    "tx_hash": "Signature...",
    "message": "Protocol fees swept successfully"
  }
  ```
