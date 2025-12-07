import { Keypair, PublicKey } from '@solana/web3.js';
import Decimal from 'decimal.js';

// USDC has 6 decimals
const USDC_DECIMALS = 6;

export class MockLedger {
    // Map Public Key (String) -> Balance (Decimal)
    private balances: Map<string, Decimal> = new Map();

    constructor() {
        console.log('[Ledger] Initialized Mock Solana Ledger');
    }

    // Debug: Print all balances
    dump() {
        console.log('--- Current Ledger State ---');
        for (const [key, bal] of this.balances.entries()) {
            console.log(`${key.slice(0, 8)}... : ${bal.toFixed(2)} USDC`);
        }
        console.log('----------------------------');
    }

    // Simulate Airdrop
    airdrop(pubkey: PublicKey, amount: number) {
        const current = this.balances.get(pubkey.toBase58()) || new Decimal(0);
        this.balances.set(pubkey.toBase58(), current.plus(amount));
        console.log(`[Ledger] Airdropped ${amount} USDC to ${pubkey.toBase58().slice(0, 8)}...`);
    }

    // Get Balance
    getBalance(pubkey: PublicKey): number {
        const bal = this.balances.get(pubkey.toBase58());
        return bal ? bal.toNumber() : 0;
    }

    // Simulate Transfer (Instructions)
    transfer(from: PublicKey, to: PublicKey, amount: number): boolean {
        const fromBal = this.balances.get(from.toBase58()) || new Decimal(0);
        const amtDecimal = new Decimal(amount);

        if (fromBal.lessThan(amtDecimal)) {
            console.error(`[Ledger] Transfer Failed: Insufficient funds for ${from.toBase58().slice(0, 8)}...`);
            return false;
        }

        this.balances.set(from.toBase58(), fromBal.minus(amtDecimal));

        const toBal = this.balances.get(to.toBase58()) || new Decimal(0);
        this.balances.set(to.toBase58(), toBal.plus(amtDecimal));

        console.log(`[Ledger] Transferred ${amount} USDC from ${from.toBase58().slice(0, 8)}... to ${to.toBase58().slice(0, 8)}...`);
        return true;
    }
}
