import { useState, useCallback } from 'react';
import { api } from '../services/api'; // Assumption: api service exists and has generic fetchers or I need to extend it
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

export const useBuilderBalance = () => {
    const [builderData, setBuilderData] = useState<BuilderData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
        if (!builderData || !wallet) return;
        setLoading(true);
        try {
            // 1. Get unsigned transaction
            const res = await fetch(`${API_BASE}/builders/${code}/claim`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ wallet: wallet.publicKey.toBase58() })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            const { transaction } = await res.json();

            // 2. Sign and Send
            const txBuffer = Buffer.from(transaction, 'base64');
            const tx = Transaction.from(txBuffer);

            const signedTx = await wallet.signTransaction(tx);

            // 3. Send via connection (Frontend usually has connection)
            // Or backend could send if we send back signed tx? 
            // The backend endpoint `executeClaimIntent` was for users. 
            // For builders, `claim_builder_balance` is a direct on-chain instruction. 
            // We can send it directly from frontend if we have RPC connection.
            // Let's assume we have connection.
            const connection = new Connection('https://api.devnet.solana.com', 'confirmed'); // Todo: use env
            const sig = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(sig, 'confirmed');

            // Refresh
            await fetchBalance(code);
            return sig;

        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Claim failed');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [builderData, fetchBalance]);

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
            const signedTx = await oldWalletAdapter.signTransaction(tx);

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
