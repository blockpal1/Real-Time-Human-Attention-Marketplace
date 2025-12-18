/**
 * @attentium/sdk
 * 
 * TypeScript SDK for the Attentium x402 Payment Protocol.
 * Enables AI agents to interact with the Human Attention Marketplace.
 * 
 * @example
 * ```typescript
 * import { AttentiumClient, Duration } from '@attentium/sdk';
 * 
 * const client = new AttentiumClient({
 *   apiUrl: 'https://api.attentium.io/v1',
 *   wallet: yourSolanaKeypair
 * });
 * 
 * // Request a verification slot
 * const result = await client.requestVerification({
 *   duration: Duration.THIRTY_SECONDS,
 *   bidPerSecond: 0.05,
 *   referrer: 'optional-referrer-wallet'
 * });
 * ```
 */

import {
    Connection,
    Keypair,
    PublicKey,
    Transaction,
    sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
    getAssociatedTokenAddress,
    createTransferCheckedInstruction,
    TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

// ============================================
// CONSTANTS
// ============================================

/** USDC Mint on Solana Mainnet */
export const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

/** USDC Mint on Solana Devnet */
export const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

/** USDC has 6 decimal places */
export const USDC_DECIMALS = 6;

/** Minimum bid per second: $0.0001 */
export const MIN_BID_PER_SECOND = 0.0001;

/** Allowed durations in seconds */
export enum Duration {
    TEN_SECONDS = 10,
    THIRTY_SECONDS = 30,
    SIXTY_SECONDS = 60,
}

// ============================================
// TYPES
// ============================================

export interface AttentiumConfig {
    /** API base URL */
    apiUrl: string;

    /** Solana keypair for signing transactions */
    wallet: Keypair;

    /** Solana RPC URL (defaults to mainnet) */
    rpcUrl?: string;

    /** Use devnet USDC mint */
    useDevnet?: boolean;
}

export interface VerificationRequest {
    /** Duration in seconds (10, 30, or 60) */
    duration: Duration;

    /** Number of slots to reserve (default: 1) */
    quantity?: number;

    /** Bid amount per second in USDC */
    bidPerSecond: number;

    /** Optional referrer wallet for revenue share */
    referrer?: string;
}

export interface PaymentInvoice {
    chain: string;
    token: string;
    amount: number;
    recipient: string;
    duration: number;
    quantity: number;
    bidPerSecond: number;
    instructionData?: {
        treasury: string;
        referrer: string;
        referrerBps: number;
    };
}

export interface VerificationResult {
    success: boolean;
    message: string;
    order: {
        duration: number;
        quantity: number;
        bidPerSecond: number;
        totalEscrow: number;
        txHash: string;
        payer: string;
        referrer: string | null;
    };
}

export interface X402Error {
    error: string;
    message: string;
    payment?: PaymentInvoice;
}

// ============================================
// CLIENT
// ============================================

export class AttentiumClient {
    private apiUrl: string;
    private wallet: Keypair;
    private connection: Connection;
    private usdcMint: PublicKey;

    constructor(config: AttentiumConfig) {
        this.apiUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
        this.wallet = config.wallet;
        this.connection = new Connection(
            config.rpcUrl || 'https://api.mainnet-beta.solana.com',
            'confirmed'
        );
        this.usdcMint = config.useDevnet ? USDC_MINT_DEVNET : USDC_MINT_MAINNET;
    }

    /**
     * Calculate the total escrow required for a verification request
     */
    calculateTotal(duration: Duration, bidPerSecond: number, quantity: number = 1): number {
        return duration * bidPerSecond * quantity;
    }

    /**
     * Request a payment invoice without submitting payment
     */
    async getInvoice(request: VerificationRequest): Promise<PaymentInvoice> {
        this.validateRequest(request);

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };

        if (request.referrer) {
            headers['X-Referrer-Agent'] = request.referrer;
        }

        const response = await fetch(`${this.apiUrl}/verify`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                duration: request.duration,
                quantity: request.quantity || 1,
                bid_per_second: request.bidPerSecond,
            }),
        });

        if (response.status === 402) {
            const data = await response.json() as X402Error;
            if (data.payment) {
                return data.payment;
            }
        }

        if (response.status === 400) {
            const data = await response.json() as X402Error;
            throw new Error(`Validation error: ${data.message}`);
        }

        throw new Error(`Unexpected response: ${response.status}`);
    }

    /**
     * Request verification with automatic payment
     */
    async requestVerification(request: VerificationRequest): Promise<VerificationResult> {
        // Step 1: Get the invoice
        const invoice = await this.getInvoice(request);

        console.log(`[Attentium] Invoice received: ${invoice.amount} USDC to ${invoice.recipient.slice(0, 8)}...`);

        // Step 2: Create and send USDC transfer
        const txSignature = await this.sendUsdcPayment(
            new PublicKey(invoice.recipient),
            invoice.amount
        );

        console.log(`[Attentium] Payment sent: ${txSignature.slice(0, 16)}...`);

        // Step 3: Submit verification with payment proof
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Solana-Tx-Signature': txSignature,
        };

        if (request.referrer) {
            headers['X-Referrer-Agent'] = request.referrer;
        }

        const response = await fetch(`${this.apiUrl}/verify`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                duration: request.duration,
                quantity: request.quantity || 1,
                bid_per_second: request.bidPerSecond,
            }),
        });

        const result = await response.json() as VerificationResult | X402Error;

        if ('success' in result && result.success) {
            return result as VerificationResult;
        }

        const errorResult = result as X402Error;
        throw new Error(`Verification failed: ${errorResult.message || JSON.stringify(result)}`);
    }

    /**
     * Send USDC payment to recipient
     */
    private async sendUsdcPayment(recipient: PublicKey, amountUsdc: number): Promise<string> {
        const amount = Math.floor(amountUsdc * Math.pow(10, USDC_DECIMALS));

        // Get token accounts
        const senderAta = await getAssociatedTokenAddress(
            this.usdcMint,
            this.wallet.publicKey
        );

        const recipientAta = await getAssociatedTokenAddress(
            this.usdcMint,
            recipient
        );

        // Create transfer instruction
        const transferIx = createTransferCheckedInstruction(
            senderAta,
            this.usdcMint,
            recipientAta,
            this.wallet.publicKey,
            amount,
            USDC_DECIMALS
        );

        // Build and send transaction
        const transaction = new Transaction().add(transferIx);

        const signature = await sendAndConfirmTransaction(
            this.connection,
            transaction,
            [this.wallet],
            { commitment: 'confirmed' }
        );

        return signature;
    }

    /**
     * Validate a verification request
     */
    private validateRequest(request: VerificationRequest): void {
        const allowedDurations = [Duration.TEN_SECONDS, Duration.THIRTY_SECONDS, Duration.SIXTY_SECONDS];

        if (!allowedDurations.includes(request.duration)) {
            throw new Error(`Duration must be one of: ${allowedDurations.join(', ')}`);
        }

        if (request.bidPerSecond < MIN_BID_PER_SECOND) {
            throw new Error(`Bid must be >= $${MIN_BID_PER_SECOND}/second`);
        }

        if (request.referrer) {
            try {
                new PublicKey(request.referrer);
            } catch {
                throw new Error('Invalid referrer wallet address');
            }
        }
    }

    /**
     * Get the wallet public key
     */
    getPublicKey(): PublicKey {
        return this.wallet.publicKey;
    }

    /**
     * Check USDC balance
     */
    async getUsdcBalance(): Promise<number> {
        const ata = await getAssociatedTokenAddress(
            this.usdcMint,
            this.wallet.publicKey
        );

        try {
            const balance = await this.connection.getTokenAccountBalance(ata);
            return parseFloat(balance.value.uiAmountString || '0');
        } catch {
            return 0;
        }
    }
}

// ============================================
// EXPORTS
// ============================================

export default AttentiumClient;
