import { useState, useCallback } from 'react';
import { Connection, Transaction } from '@solana/web3.js';

// If api service doesn't have a generic fetcher, I might need to implement one or use fetch directly.
// Checking App.tsx, it imports `api` from './services/api'. 
// I'll assume I can use fetch for new endpoints if not modifying api.ts extensively.

const API_BASE = 'http://localhost:3000/v1'; // Should use env or what api.ts uses

export interface BuilderData {
    code: string;
    wallet: string;
    claimableBalance: number;
    lifetimeEarnings: number;
}

import { useSignTransaction } from '@privy-io/react-auth/solana';

export const useBuilderBalance = () => {
    const [builderData, setBuilderData] = useState<BuilderData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // CRITICAL: Initialize hook at top level
    const { signTransaction: privySignTransaction } = useSignTransaction();

    const fetchBalance = useCallback(async (code: string) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/builders/${code}/balance`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setBuilderData(data);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Failed to fetch builder data');
            setBuilderData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    const claimEarnings = useCallback(async (code: string, wallet: any) => { // wallet object from adapter
        console.log('[useBuilderBalance] claimEarnings called', { code, wallet });
        if (!builderData || !wallet) {
            console.warn('[useBuilderBalance] Missing builderData or wallet', { builderData, wallet });
            return;
        }
        setLoading(true);
        try {
            // 1. Get unsigned transaction
            console.log('[useBuilderBalance] Fetching claim tx...');
            const walletPubkey = wallet.publicKey?.toBase58 ? wallet.publicKey.toBase58() : wallet.publicKey?.toString();
            console.log('[useBuilderBalance] Wallet Pubkey:', walletPubkey);

            const res = await fetch(`${API_BASE}/builders/${code}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: walletPubkey })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            const { transaction } = await res.json();
            console.log('[useBuilderBalance] Tx fetched, deserializing...');

            // 2. Sign and Send
            const txBuffer = Buffer.from(transaction, 'base64');
            const tx = Transaction.from(txBuffer);

            console.log('[useBuilderBalance] Requesting signature...');

            let signedTx: Transaction;
            if (wallet.walletClientType === 'privy') {
                const { signedTransaction } = await privySignTransaction({
                    transaction: tx.serialize(),
                    wallet: wallet
                });
                signedTx = Transaction.from(signedTransaction);
            } else {
                signedTx = await wallet.signTransaction(tx);
            }

            console.log('[useBuilderBalance] Signed. Sending to network...');

            // 3. Send via connection
            const connection = new Connection(import.meta.env.VITE_SOLANA_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
            const sig = await connection.sendRawTransaction(signedTx.serialize());
            console.log('[useBuilderBalance] Tx Sent:', sig);

            await connection.confirmTransaction(sig, 'confirmed');
            console.log('[useBuilderBalance] Confirmed!');

            // Refresh
            await fetchBalance(code);
            return sig;

        } catch (err: any) {
            console.error('[useBuilderBalance] Error:', err);
            setError(err.message || 'Claim failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [builderData, fetchBalance, privySignTransaction]);

    const updateWallet = useCallback(async (code: string, oldWalletAdapter: any, newWalletPubkey: string) => {
        setLoading(true);
        try {
            // 1. Get transaction
            const res = await fetch(`${API_BASE}/builders/${code}/update-wallet`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    oldWallet: oldWalletAdapter.publicKey.toBase58(),
                    newWallet: newWalletPubkey
                })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            const { transaction } = await res.json();

            // 2. Sign
            const txBuffer = Buffer.from(transaction, 'base64');
            const tx = Transaction.from(txBuffer);

            let signedTx: Transaction;
            if (oldWalletAdapter.walletClientType === 'privy') {
                const { signedTransaction } = await privySignTransaction({
                    transaction: tx.serialize(),
                    wallet: oldWalletAdapter
                });
                signedTx = Transaction.from(signedTransaction);
            } else {
                signedTx = await oldWalletAdapter.signTransaction(tx);
            }

            // 3. Send
            const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
            const sig = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(sig, 'confirmed');

            await fetchBalance(code);
            return sig;

        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchBalance]);

    return {
        builderData,
        loading,
        error,
        fetchBalance,
        claimEarnings,
        updateWallet
    };
};
