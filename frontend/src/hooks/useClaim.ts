import { useState } from 'react';
import { api } from '../services/api';
// Use Solana-specific useWallets hook
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Use Privy's Solana signing hooks
import { useSignMessage, useSignTransaction } from '@privy-io/react-auth/solana';

// Ensure Buffer exists globally for Solana web3.js
if (typeof window !== 'undefined' && !window.Buffer) {
    window.Buffer = Buffer;
}

export type ClaimState =
    | 'idle'
    | 'building'
    | 'signing'
    | 'submitting'
    | 'confirmed'
    | 'failed';

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

    // 1. Get user and wallets
    const { user } = usePrivy();
    const { wallets } = useWallets();

    // 2. Setup signing hooks  
    const { signMessage: privySignMessage } = useSignMessage();
    const { signTransaction: privySignTransaction } = useSignTransaction();

    const getExplorerUrl = (txHash: string) => {
        const isDevnet = import.meta.env.VITE_SOLANA_RPC_URL?.includes('devnet');
        const cluster = isDevnet ? '?cluster=devnet' : '';
        return `https://explorer.solana.com/tx/${txHash}${cluster}`;
    };

    const resetClaimState = () => {
        setClaimState('idle');
        setClaimResult(null);
    };

    const claimEarnings = async (onSuccess?: () => void) => {
        setClaimState('building');
        setClaimResult(null);

        try {
            console.log(`[Claim] Starting claim process...`);
            console.log(`[Claim] All session wallets:`, wallets.map(w => ({
                address: w.address,
                clientType: (w as any).walletClientType
            })));

            // 1. Identify Target Address - Respect the passed userPubkey (don't override external users)
            const targetAddress = userPubkey;

            // Check if this target address corresponds to an embedded wallet
            const isEmbeddedTarget = user?.linkedAccounts.some(
                (a) => a.type === 'wallet' &&
                    (a as any).walletClientType === 'privy' &&
                    (a as any).address === targetAddress
            );

            console.log(`[Claim] Target signing address: ${targetAddress} (isEmbedded: ${isEmbeddedTarget})`);

            // 2. Find in Session Wallets (Strict Requirement)
            const activeWallet = wallets.find(w => w.address === targetAddress);

            if (!activeWallet) {
                console.error('[Claim] Target wallet not found in active session.');
                console.error('[Claim] Looking for:', targetAddress);
                console.error('[Claim] Available:', wallets.map(w => w.address));
                throw new Error("Wallet not connected. Please click 'Connect' to enable signing.");
            }

            console.log(`[Claim] ✓ Found active session wallet:`, {
                address: activeWallet.address,
                clientType: (activeWallet as any).walletClientType,
                hasSignMessage: typeof (activeWallet as any).signMessage === 'function',
                hasSignTransaction: typeof (activeWallet as any).signTransaction === 'function'
            });

            // 3. Request transaction from backend (unsigned)
            const messageSigner = async (msg: Uint8Array) => {
                console.log('[Claim] Signing message with wallet:', activeWallet.address);
                const { signature } = await privySignMessage({
                    message: msg,
                    wallet: activeWallet as any
                });
                console.log('[Claim] Message signed successfully');
                return signature;
            };

            const { transaction, claimId, amount, error } = await api.withdrawEarnings(userPubkey, messageSigner);

            if (error) throw new Error(error);

            setClaimState('signing');
            // 4. Sign the Transaction
            const txBuffer = Buffer.from(transaction, 'base64');
            const tx = Transaction.from(txBuffer);

            console.log("[Claim] Signing transaction with wallet:", activeWallet.address);

            setClaimState('signing');

            // 5. Sign based on wallet type
            let signResult;

            if (isEmbeddedTarget) {
                // Use Privy hook with explicit chain for Embedded Wallets
                console.log("[Claim] Using Privy signTransaction hook (Embedded Flow)...");
                signResult = await privySignTransaction({
                    transaction: tx.serialize({ verifySignatures: false, requireAllSignatures: false }),
                    wallet: activeWallet as any,
                    chain: 'solana:devnet' as any
                });
            } else {
                // Use standard wallet signing for External Wallets (Phantom, Solflare, etc.)
                console.log("[Claim] Using standard wallet signing (External Flow)...");
                // For external wallets, we can use the hook OR direct method, but hook is safer if they are in session
                // However, Privy hook often forces its own UI or logic. 
                // Let's try the hook without the chain param (default) or rely on standard adapter

                // If the wallet object has standard adapter methods, usage might vary.
                // But since we are using useWallets() from Privy, these are Privy implementations of Wallet Adapters.
                // Safest bet: Use the same hook but WITHOUT the chain param override if it causes issues,
                // OR use the hook exactly as is.

                // User reported: "clicking the button also opens up the privy transaction, not my phantom wallet"
                // This implies the hook `privySignTransaction` INTERCEPTS the flow.

                // Let's try relying on the wallet object's native signTransaction if available (standard adapter)
                // BUT Privy wraps them. 

                // Correct approach for external wallets via Privy: 
                // Just call `activeWallet.signTransaction(tx)` if it exists?
                // Privy docs say `useWallets` returns objects that look like adapters.

                if (typeof (activeWallet as any).signTransaction === 'function') {
                    const signedTx = await (activeWallet as any).signTransaction(tx);
                    signResult = { signedTransaction: signedTx.serialize() };
                } else {
                    // Fallback to hook
                    signResult = await privySignTransaction({
                        transaction: tx.serialize({ verifySignatures: false, requireAllSignatures: false }),
                        wallet: activeWallet as any
                    });
                }
            }

            // Check if result has signedTransaction or signature property
            const signedBuffer = (signResult as any).signedTransaction || (signResult as any).signature;
            const signedTx = Transaction.from(signedBuffer);

            console.log("[Claim] Transaction signed successfully!");
            console.log("[Claim] Signed transaction signatures:", signedTx.signatures.map(sig => ({
                pubkey: sig.publicKey?.toBase58(),
                hasSignature: sig.signature !== null
            })));

            setClaimState('submitting');

            const signedBase64 = signedTx.serialize().toString('base64');
            console.log("[Claim] Submitting to backend...");

            const submitResult = await api.submitClaim(userPubkey, claimId, signedBase64);

            if (submitResult.error) {
                throw new Error(submitResult.error);
            }

            const txHash = submitResult.txHash!;
            const confirmedAmount = submitResult.amount || amount || 0;

            console.log(`[Claim] Confirmed! Hash: ${txHash}`);

            setClaimState('confirmed');
            setClaimResult({
                success: true,
                txHash,
                amount: confirmedAmount,
                explorerUrl: getExplorerUrl(txHash)
            });

            if (onSuccess) onSuccess();

        } catch (err: any) {
            console.error("[Claim] Error:", err);
            setClaimState('failed');
            setClaimResult({
                success: false,
                error: err.message || 'Unknown error. Check console.'
            });
        }
    };

    const claiming = claimState !== 'idle' && claimState !== 'confirmed' && claimState !== 'failed';

    const getStatusText = () => {
        switch (claimState) {
            case 'idle': return 'Claim to Wallet';
            case 'building': return 'Preparing...';
            case 'signing': return 'Sign in Wallet...';
            case 'submitting': return 'Confirming...';
            case 'confirmed': return 'Claimed!';
            case 'failed': return 'Retry Claim';
            default: return 'Claim to Wallet';
        }
    };

    return {
        claimState,
        claimResult,
        claiming,
        claimEarnings,
        resetClaimState,
        getStatusText
    };
};
