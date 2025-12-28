import { useState } from 'react';
import { api } from '../services/api';
import { useWallets, usePrivy } from '@privy-io/react-auth';
import { Transaction, PublicKey } from '@solana/web3.js';
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

export const useClaim = (userPubkey: string) => {
    const [claiming, setClaiming] = useState(false);
    const { wallets } = useWallets();
    const { user } = usePrivy();

    const claimEarnings = async (onSuccess?: () => void) => {
        setClaiming(true);

        try {
            // 1. Find a signer - Check Privy wallets first, then fall back to native Phantom
            console.log(`[ClaimDebug] UserPubkey: ${userPubkey}`);
            console.log(`[ClaimDebug] Privy Wallets:`, wallets.map(w => w.address));

            let signTransaction: ((tx: Transaction) => Promise<Transaction>) | null = null;

            // Try Privy wallets first
            const privyWallet = wallets.find(w => w.address === userPubkey);
            if (privyWallet) {
                console.log(`[ClaimDebug] Using Privy wallet signer`);
                signTransaction = async (tx: Transaction) => {
                    return await (privyWallet as any).signTransaction(tx);
                };
            }

            // Fallback to Native Phantom Provider
            if (!signTransaction && window.phantom?.solana) {
                console.log(`[ClaimDebug] Using native Phantom provider`);
                const phantom = window.phantom.solana;

                if (!phantom.isPhantom) {
                    throw new Error("Phantom wallet not detected.");
                }

                // Ensure connected
                if (!phantom.publicKey) {
                    console.log(`[ClaimDebug] Connecting to Phantom...`);
                    await phantom.connect();
                }

                // Verify address matches
                const phantomAddress = phantom.publicKey?.toString();
                console.log(`[ClaimDebug] Phantom Address: ${phantomAddress}`);
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
            console.log(`[ClaimDebug] Requesting transaction from backend...`);
            const { transaction, claimId, error } = await api.withdrawEarnings(userPubkey);
            if (error) throw new Error(error);

            // 3. Deserialize
            const txBuffer = Buffer.from(transaction, 'base64');
            const tx = Transaction.from(txBuffer);

            // 4. Sign with Wallet
            console.log(`[ClaimDebug] Signing transaction...`);
            const signedTx = await signTransaction(tx);

            // 5. Serialize Signed TX
            const signedBase64 = signedTx.serialize().toString('base64');

            // 6. Submit to Backend for broadcasting/finalizing
            console.log(`[ClaimDebug] Submitting signed transaction...`);
            await api.submitClaim(userPubkey, claimId, signedBase64);

            alert("Claim Successful! Funds are on the way.");
            if (onSuccess) onSuccess();

        } catch (e: any) {
            console.error("Claim Error:", e);
            alert(`Claim Failed: ${e.message}`);
        } finally {
            setClaiming(false);
        }
    };

    return { claiming, claimEarnings };
};
