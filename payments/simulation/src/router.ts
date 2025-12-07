import { Keypair, PublicKey } from '@solana/web3.js';
import { MockLedger } from './ledger';

export class PaymentRouter {
    private ledger: MockLedger;

    // SessionID -> { AgentKey, VaultKeypair, Amount }
    private escrows: Map<string, { agent: PublicKey, vault: Keypair, amount: number }> = new Map();

    constructor(ledger: MockLedger) {
        this.ledger = ledger;
    }

    // 1. Agent Deposits to Escrow (Start of Task)
    async createEscrow(sessionId: string, agent: Keypair, amount: number) {
        // In real Solana, this is a PDA. Here we generate a fresh Keypair for the Vault.
        const vault = Keypair.generate();

        // Transfer from Agent -> Escrow Vault
        const success = this.ledger.transfer(agent.publicKey, vault.publicKey, amount);
        if (!success) {
            throw new Error("Escrow deposit failed");
        }

        this.escrows.set(sessionId, { agent: agent.publicKey, vault, amount });
        console.log(`[Router] Created Escrow Vault ${vault.publicKey.toBase58().slice(0, 8)}... for Session ${sessionId}`);
        return vault.publicKey;
    }

    // 2. Settle (End of Session / Periodic)
    async settle(sessionId: string, userWallet: PublicKey, verifiedSeconds: number, pricePerSecond: number) {
        const escrow = this.escrows.get(sessionId);
        if (!escrow) {
            console.error(`[Router] No escrow found for session ${sessionId}`);
            return;
        }

        // Calc Payout (Micro-USDC -> USDC)
        const totalPayout = (verifiedSeconds * pricePerSecond) / 1_000_000;

        console.log(`[Router] Settling Session ${sessionId}: ${verifiedSeconds}s @ ${pricePerSecond}µs = ${totalPayout} USDC`);

        // Transfer Vault -> User
        const success = this.ledger.transfer(escrow.vault.publicKey, userWallet, totalPayout);

        if (success) {
            console.log(`[Router] Settlement Successful for Session ${sessionId}`);
        } else {
            console.error(`[Router] Settlement Failed: Insufficient Vault Funds`);
        }
    }
}
