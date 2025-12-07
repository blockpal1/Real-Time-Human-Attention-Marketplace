# Attention Marketplace Smart Contract

This Anchor program implements the micro-escrow logic for the Real-Time Human Attention Marketplace.

## Instructions

### 1. Initialize Config
Sets up the global market configuration.
- **Accounts**: Admin, Config (PDA), SystemProgram.
- **Args**: `fee_basis_points` (u16).

### 2. Create Task
Initializes an escrow state for a specific task.
- **Accounts**: Agent, EscrowState (PDA), EscrowVault (PDA), Mint, TokenProgram.
- **Args**: `task_id` (String).

### 3. Fund Escrow
Transfers USDC from the Agent to the Escrow Vault.
- **Accounts**: Agent, EscrowState, AgentTokenAccount, EscrowVault, TokenProgram.
- **Args**: `amount` (u64).

### 4. Stream Pay Human
The Router (Authority) verifies attention and triggers payment.
- **Logic**: 
    - Verify verified seconds * price.
    - Calculate Fee (e.g., 5%).
    - Transfer `(Total - Fee)` to User.
    - Transfer `Fee` to Treasury.
    - Decrement Escrow Balance.
- **Accounts**: Router, Config, EscrowState, EscrowVault, UserTokenAccount, FeeTreasury, TokenProgram.
- **Args**: `verified_seconds` (u64), `price_per_second` (u64).

### 5. Refund Remainder
Agent withdraws any remaining funds in the escrow.
- **Accounts**: Agent, EscrowState, EscrowVault, AgentTokenAccount, TokenProgram.

## Build and Test

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the program:
   ```bash
   anchor build
   ```

3. Run tests:
   ```bash
   anchor test
   ```
