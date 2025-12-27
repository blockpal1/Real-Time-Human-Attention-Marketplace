import { useState } from 'react';
import { api } from '../services/api';
import { useWallets } from '@privy-io/react-auth';
import { Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Helper to ensure Buffer is available
if (typeof window !== 'undefined' && !window.Buffer) {
    window.Buffer = Buffer;
}

export const useClaim = (userPubkey: string) => {
    const [claiming, setClaiming] = useState(false);
    const { wallets } = useWallets();

    const claimEarnings = async (onSuccess?: () => void) => {
        setClaiming(true);

        try {
            // 1. Request TX from Backend
            const { transaction, claimId, error } = await api.withdrawEarnings(userPubkey);
            if (error) throw new Error(error);

            // 2. Deserialize
            const txBuffer = Buffer.from(transaction, 'base64');
            const tx = Transaction.from(txBuffer);

            // 3. Sign with Wallet
            const wallet = wallets.find(w => w.address === userPubkey) || wallets[0];
            if (!wallet) throw new Error("Wallet not connected");

            // Privy signTransaction returns the signed transaction object
            const signedTx = await (wallet as any).signTransaction(tx);

            // 4. Serialize Signed TX
            const signedBase64 = signedTx.serialize().toString('base64');

            // 5. Submit to Backend for broadcasting/finalizing
            await api.submitClaim(userPubkey, claimId, signedBase64);

            alert("Claim Successful! Funds will arrive shortly.");
            if (onSuccess) onSuccess();

        } catch (e: any) {
            console.error(e);
            alert(`Claim Failed: ${e.message}`);
        } finally {
            setClaiming(false);
        }
    };

    return {
        claiming,
        claimEarnings
    };
};
