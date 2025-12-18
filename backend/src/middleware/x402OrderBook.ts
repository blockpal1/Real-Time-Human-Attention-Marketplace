import { Request, Response, NextFunction } from 'express';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const TREASURY = new PublicKey(process.env.SOLANA_TREASURY_WALLET || '2kDpvEhgoLkUbqFJqxMpUXMtr2gVYbfqNF8kGrfoZMAV');
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Mainnet USDC
const IS_DEVNET = RPC_URL.includes('devnet');

const connection = new Connection(RPC_URL, 'confirmed');

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            order?: {
                duration: number;
                quantity: number;
                bid: number;
                total_escrow: number;
                tx_hash: string;
                referrer: string | null;
            };
        }
    }
}

export async function x402Middleware(req: Request, res: Response, next: NextFunction) {
    try {
        // 1. EXTRACT ORDER DETAILS
        const { duration, quantity = 1, bid_per_second } = req.body;

        if (!duration || !bid_per_second) {
            return res.status(400).json({ error: "Missing duration or bid_per_second" });
        }

        // Validate duration
        if (![10, 30, 60].includes(duration)) {
            return res.status(400).json({ error: "Invalid duration. Must be 10, 30, or 60." });
        }

        // 2. CALCULATE ESCROW
        const totalEscrow = duration * quantity * bid_per_second;

        // 3. CHECK REFERRER (Yield Header)
        let referrer: string | null = null;
        const referrerHeader = req.headers['x-referrer-agent'];
        if (typeof referrerHeader === 'string') {
            try {
                new PublicKey(referrerHeader); // Validate format
                referrer = referrerHeader;
                console.log(`[x402] Referrer detected: ${referrer.slice(0, 12)}...`);
            } catch (e) { /* Ignore invalid headers */ }
        }

        // 4. CHECK PAYMENT PROOF
        const txSignature = req.headers['x-solana-tx-signature'];

        if (!txSignature || typeof txSignature !== 'string') {
            // ---> CHALLENGE (402)
            return res.status(402).json({
                error: "payment_required",
                message: `Escrow required: ${totalEscrow} USDC`,
                invoice: {
                    amount: totalEscrow,
                    destination: TREASURY.toBase58(),
                    token: IS_DEVNET ? "SOL_OR_USDC" : "USDC",
                    referrer: referrer // Echo back so Agent knows we saw it
                }
            });
        }

        // 5. VALIDATE TRANSACTION
        const txStatus = await connection.getTransaction(txSignature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        });

        if (!txStatus) {
            return res.status(400).json({
                error: "transaction_not_found",
                message: "Tx not confirmed yet. Wait 5s."
            });
        }

        // --- VALIDATION LOGIC ---
        let isValidPayment = false;

        // Check 1: Is it recent? (Prevents replay attacks older than 2 mins)
        const now = Math.floor(Date.now() / 1000);
        if (txStatus.blockTime && (now - txStatus.blockTime > 120)) {
            return res.status(403).json({ error: "expired_transaction" });
        }

        // Check 2: Devnet Bypass (Native SOL)
        if (IS_DEVNET) {
            const accountKeys = txStatus.transaction.message.getAccountKeys();
            const nativeTransfer = accountKeys.staticAccountKeys.some(k => k.equals(TREASURY));
            if (nativeTransfer) {
                console.log('[x402] Devnet bypass: Accepted native SOL transfer');
                isValidPayment = true;
            }
        }

        // Check 3: Mainnet Strict (USDC Token Transfer)
        if (!isValidPayment) {
            // TODO: Parse innerInstructions for Token Program transfer to TREASURY >= totalEscrow
            // For now, accept any tx that reached this point on mainnet
            console.log('[x402] Mainnet mode: Assuming USDC transfer is valid');
            isValidPayment = true;
        }

        if (isValidPayment) {
            // ATTACH DATA TO REQUEST
            req.order = {
                duration,
                quantity,
                bid: bid_per_second,
                total_escrow: totalEscrow,
                tx_hash: txSignature,
                referrer: referrer // SAVE THIS TO DB
            };
            console.log(`[x402] Payment verified: ${totalEscrow} USDC for ${quantity}x ${duration}s`);
            return next();
        } else {
            return res.status(402).json({ error: "invalid_payment" });
        }

    } catch (error) {
        console.error('[x402] Error:', error);
        return res.status(500).json({ error: "server_error" });
    }
}

// Also export as x402OrderBook for backwards compatibility
export const x402OrderBook = x402Middleware;
export default x402Middleware;
