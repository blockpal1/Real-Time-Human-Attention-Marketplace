import { useState } from 'react';
import { api } from '../services/api';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Helper to ensure Buffer is available
if (typeof window !== 'undefined' && !window.Buffer) {
    window.Buffer = Buffer;
}

// Extend Window interface for Phantom
declare global {
    interface Window {
        phantom?: {
            solana?: {
                isPhantom: boolean;
                publicKey: { toString: () => string };
                signTransaction: (tx: Transaction) => Promise<Transaction>;
                connect: () => Promise<{ publicKey: { toString: () => string } }>;
            };
        };
    }
}

// Claim state machine states
export type ClaimState =
    | 'idle'           // Ready to claim
    | 'building'       // Requesting transaction from backend
    | 'signing'        // Waiting for wallet signature
    | 'submitting'     // Submitting signed tx to backend
    | 'confirmed'      // Transaction confirmed on-chain
    | 'failed';        // Transaction failed

export interface ClaimResult {
    success: boolean;
    txHash?: string;
    amount?: number;
    error?: string;
    explorerUrl?: string;
}

export const useClaim = (userPubkey: string) => {
    const [claimState, setClaimState] = useState<ClaimState>('idle');
    const [claimResult, setClaimResult] = useState<ClaimResult | null>(null);
    const { wallets } = useWallets();
    const { user } = usePrivy();

    // Helper to get explorer URL
    const getExplorerUrl = (txHash: string) => {
        const isDevnet = import.meta.env.VITE_SOLANA_RPC_URL?.includes('devnet');
        const cluster = isDevnet ? '?cluster=devnet' : '';
        return `https://explorer.solana.com/tx/${txHash}${cluster}`;
    };

    // Reset state
    const resetClaimState = () => {
        setClaimState('idle');
        setClaimResult(null);
    };

    const claimEarnings = async (onSuccess?: () => void) => {
        setClaimState('building');
        setClaimResult(null);

        try {
            // 1. Find a signer - Check Privy wallets first, then fall back to native Phantom
            console.log(`[Claim] State: building - Finding wallet signer...`);

            let signTransaction: ((tx: Transaction) => Promise<Transaction>) | null = null;

            // Try Privy wallets first
            const privyWallet = wallets.find(w => w.address === userPubkey);
            if (privyWallet) {
                console.log(`[Claim] Using Privy wallet signer`);
                signTransaction = async (tx: Transaction) => {
                    return await (privyWallet as any).signTransaction(tx);
                };
            }

            // Fallback to Native Phantom Provider
            if (!signTransaction && window.phantom?.solana) {
                console.log(`[Claim] Using native Phantom provider`);
                const phantom = window.phantom.solana;

                if (!phantom.isPhantom) {
                    throw new Error("Phantom wallet not detected.");
                }

                // Ensure connected
                if (!phantom.publicKey) {
                    console.log(`[Claim] Connecting to Phantom...`);
                    await phantom.connect();
                }

                // Verify address matches
                const phantomAddress = phantom.publicKey?.toString();
                if (phantomAddress !== userPubkey) {
                    throw new Error(`Wallet mismatch. Expected ${userPubkey}, got ${phantomAddress}. Please switch wallets in Phantom.`);
                }

                signTransaction = async (tx: Transaction) => {
                    return await phantom.signTransaction(tx);
                };
            }

            if (!signTransaction) {
                throw new Error("No wallet signer available. Please ensure Phantom is installed and connected.");
            }

            // 2. Request TX from Backend
            console.log(`[Claim] State: building - Requesting transaction from backend...`);
            const { transaction, claimId, amount, error } = await api.withdrawEarnings(userPubkey);
            if (error) throw new Error(error);

            // 3. Transition to signing state
            setClaimState('signing');
            console.log(`[Claim] State: signing - Waiting for wallet signature...`);

            // 4. Deserialize and Sign
            const txBuffer = Buffer.from(transaction, 'base64');
            const tx = Transaction.from(txBuffer);
            const signedTx = await signTransaction(tx);

            // 5. Transition to submitting state
            setClaimState('submitting');
            console.log(`[Claim] State: submitting - Broadcasting to Solana...`);

            // 6. Serialize and Submit
            const signedBase64 = signedTx.serialize().toString('base64');
            const submitResult = await api.submitClaim(userPubkey, claimId, signedBase64);

            if (submitResult.error) {
                throw new Error(submitResult.error);
            }

            // 7. Success!
            const txHash = submitResult.txHash;
            const confirmedAmount = submitResult.amount || amount || 0;

            setClaimState('confirmed');
            setClaimResult({
                success: true,
                txHash,
                amount: confirmedAmount,
                explorerUrl: getExplorerUrl(txHash)
            });

            console.log(`[Claim] State: confirmed - Transaction: ${txHash}`);

            if (onSuccess) onSuccess();

        } catch (e: any) {
            console.error("[Claim] Error:", e);
            setClaimState('failed');
            setClaimResult({
                success: false,
                error: e.message || 'Unknown error occurred'
            });
        }
    };

    // Derived states for UI convenience
    const claiming = claimState !== 'idle' && claimState !== 'confirmed' && claimState !== 'failed';

    // Status text for button/UI
    const getStatusText = (): string => {
        switch (claimState) {
            case 'idle': return 'Claim to Wallet';
            case 'building': return 'Building Transaction...';
            case 'signing': return 'Sign in Wallet...';
            case 'submitting': return 'Confirming on Solana...';
            case 'confirmed': return 'Claimed!';
            case 'failed': return 'Retry Claim';
            default: return 'Claim to Wallet';
        }
    };

    return {
        claimState,
        claimResult,
        claiming,  // Backwards compatible
        claimEarnings,
        resetClaimState,
        getStatusText
    };
};
