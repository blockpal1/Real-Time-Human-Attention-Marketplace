import { Request, Response, NextFunction } from 'express';
import { Connection, PublicKey } from '@solana/web3.js';

// Configuration
const VAULT_ADDRESS = process.env.ATTENTIUM_VAULT_ADDRESS || '2kDpvEhgoLkUbqFJqxMpUXMtr2gVYbfqNF8kGrfoZMAV';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // Mainnet USDC
const IS_DEVNET = SOLANA_RPC_URL.includes('devnet');

// Allowed durations (in seconds)
const ALLOWED_DURATIONS = [10, 30, 60] as const;
type AllowedDuration = typeof ALLOWED_DURATIONS[number];

// Minimum bid: $0.0001 per second
const MIN_BID_PER_SECOND = 0.0001;

// USDC has 6 decimals
const USDC_DECIMALS = 6;

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            order?: {
                duration: AllowedDuration;
                quantity: number;
                bid_per_second: number;
                total_escrow: number;
                txHash: string;
                payer: string;
                referrer: string | null;
            };
        }
    }
}

interface VerifyRequestBody {
    duration: number;
    quantity: number;
    bid_per_second: number;
}

interface PaymentInvoice {
    chain: string;
    token: string;
    amount: number;
    recipient: string;
    duration: number;
    quantity: number;
    bid_per_second: number;
    instruction_data?: {
        treasury: string;
        referrer: string;
        referrer_bps: number;
    };
}

/**
 * x402 Order Book Middleware
 * 
 * Implements HTTP 402 Payment Required protocol for agent verification.
 * Pricing is dynamic based on agent's bid × duration.
 */
export const x402OrderBook = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // ========================================
    // STEP 1: Parse and Validate Request Body
    // ========================================

    const { duration, quantity, bid_per_second } = req.body as VerifyRequestBody;

    // Validate duration is one of allowed values
    if (!ALLOWED_DURATIONS.includes(duration as AllowedDuration)) {
        return res.status(400).json({
            error: 'invalid_duration',
            message: `Duration must be one of: ${ALLOWED_DURATIONS.join(', ')} seconds`,
            allowed_durations: ALLOWED_DURATIONS
        });
    }

    // Validate minimum bid
    if (typeof bid_per_second !== 'number' || bid_per_second < MIN_BID_PER_SECOND) {
        return res.status(400).json({
            error: 'invalid_bid',
            message: `Bid must be >= $${MIN_BID_PER_SECOND}/second`,
            minimum_bid: MIN_BID_PER_SECOND
        });
    }

    // Validate quantity
    const qty = quantity || 1; // Default to 1 if not provided
    if (!Number.isInteger(qty) || qty < 1 || qty > 1000) {
        return res.status(400).json({
            error: 'invalid_quantity',
            message: 'Quantity must be an integer between 1 and 1000',
            provided: quantity
        });
    }

    // ========================================
    // STEP 2: Calculate Total Escrow
    // ========================================

    const total_escrow = duration * bid_per_second * qty;

    // ========================================
    // STEP 3: Check for Payment Header
    // ========================================

    const txSignature = req.headers['x-solana-tx-signature'] as string | undefined;
    const referrerAgent = req.headers['x-referrer-agent'] as string | undefined;

    // Validate referrer if provided (must be valid Solana pubkey)
    // Invalid referrers are silently ignored (not rejected)
    let validatedReferrer: string | null = null;
    if (referrerAgent) {
        try {
            new PublicKey(referrerAgent); // Throws if invalid
            validatedReferrer = referrerAgent;
            console.log(`[x402] Valid referrer detected: ${referrerAgent.slice(0, 12)}...`);
        } catch {
            console.log(`[x402] Invalid referrer header ignored: ${referrerAgent}`);
            // Don't reject, just ignore
        }
    }

    // Always use main vault - splitter not deployed yet
    // Referrer is tracked for future manual payouts
    const paymentRecipient = VAULT_ADDRESS;

    // ========================================
    // STEP 3a: No Payment Header → Return 402
    // ========================================

    if (!txSignature) {
        const invoice: PaymentInvoice = {
            chain: 'solana',
            token: 'USDC',
            amount: total_escrow,
            recipient: paymentRecipient,
            duration: duration as AllowedDuration,
            quantity: qty,
            bid_per_second
        };

        // Add referrer to invoice if present
        if (validatedReferrer) {
            (invoice as any).referrer = validatedReferrer;
            invoice.instruction_data = {
                treasury: VAULT_ADDRESS,
                referrer: validatedReferrer,
                referrer_bps: 2000 // 20%
            };
        }

        res.setHeader(
            'WWW-Authenticate',
            `x402 chain=solana token=USDC amount=${total_escrow}`
        );

        return res.status(402).json({
            error: 'payment_required',
            message: `Escrow required: ${total_escrow.toFixed(6)} USDC for ${qty}x ${duration}s slots`,
            payment: invoice
        });
    }

    // ========================================
    // STEP 3b: Payment Header Present → Verify
    // ========================================

    try {
        const connection = new Connection(SOLANA_RPC_URL, 'confirmed');

        // Fetch the transaction
        const tx = await connection.getParsedTransaction(txSignature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        });

        if (!tx) {
            return res.status(402).json({
                error: 'transaction_not_found',
                message: 'Transaction not found or not yet confirmed. Please wait and retry.',
                signature: txSignature
            });
        }

        // Extract USDC transfer details from transaction
        const transferInfo = extractUsdcTransfer(tx);

        if (!transferInfo) {
            return res.status(402).json({
                error: 'invalid_transaction',
                message: 'Transaction does not contain a valid USDC transfer'
            });
        }

        // Validate amount covers the escrow (SKIP for devnet native SOL)
        const isDevnetSolTransfer = IS_DEVNET && transferInfo.recipient === VAULT_ADDRESS;
        if (!isDevnetSolTransfer) {
            const totalEscrowLamports = total_escrow * Math.pow(10, USDC_DECIMALS);
            if (transferInfo.amount < totalEscrowLamports) {
                return res.status(402).json({
                    error: 'insufficient_payment',
                    message: `Payment insufficient. Required: ${total_escrow} USDC, Received: ${transferInfo.amount / Math.pow(10, USDC_DECIMALS)} USDC`,
                    required: total_escrow,
                    received: transferInfo.amount / Math.pow(10, USDC_DECIMALS)
                });
            }
        } else {
            console.log('[x402] Devnet bypass: Skipping amount validation for native SOL transfer');
        }

        // Validate recipient matches expected vault/splitter
        if (transferInfo.recipient !== paymentRecipient) {
            return res.status(402).json({
                error: 'invalid_recipient',
                message: `Payment sent to wrong address. Expected: ${paymentRecipient}`,
                expected: paymentRecipient,
                received: transferInfo.recipient
            });
        }

        // ========================================
        // STEP 4: Payment Valid → Attach Order
        // ========================================

        req.order = {
            duration: duration as AllowedDuration,
            quantity: qty,
            bid_per_second,
            total_escrow,
            txHash: txSignature,
            payer: transferInfo.sender,
            referrer: validatedReferrer
        };

        console.log(`[x402] Payment verified: ${total_escrow} USDC for ${qty}x ${duration}s from ${transferInfo.sender.slice(0, 8)}...`);

        next();

    } catch (error) {
        console.error('[x402] Transaction verification error:', error);
        return res.status(500).json({
            error: 'verification_failed',
            message: 'Failed to verify transaction. Please try again.'
        });
    }
};

/**
 * Extract USDC transfer details from a parsed transaction
 * Includes devnet bypass for native SOL transfers
 */
function extractUsdcTransfer(tx: any): { amount: number; recipient: string; sender: string } | null {
    try {
        const instructions = tx.transaction?.message?.instructions || [];

        // ==========================================
        // DEVNET BYPASS: Check for native SOL transfer
        // ==========================================
        for (const ix of instructions) {
            if (ix.program === 'system' && ix.parsed?.type === 'transfer') {
                const info = ix.parsed.info;
                // Check if recipient is our vault
                if (info.destination === VAULT_ADDRESS) {
                    console.log('⚠️  Devnet Mode: Accepted Native SOL transfer as valid payment.');
                    console.log(`   From: ${info.source}`);
                    console.log(`   To: ${info.destination}`);
                    console.log(`   Amount: ${info.lamports} lamports`);
                    return {
                        amount: info.lamports, // Return lamports, we'll skip amount check for devnet
                        recipient: info.destination,
                        sender: info.source
                    };
                }
            }
        }
        // ==========================================

        // PRODUCTION: Look for SPL Token transfer instructions
        for (const ix of instructions) {
            // Check for parsed SPL Token transfer
            if (ix.program === 'spl-token' && ix.parsed?.type === 'transfer') {
                const info = ix.parsed.info;
                return {
                    amount: parseInt(info.amount, 10),
                    recipient: info.destination,
                    sender: info.source
                };
            }

            // Check for transferChecked (preferred for USDC)
            if (ix.program === 'spl-token' && ix.parsed?.type === 'transferChecked') {
                const info = ix.parsed.info;
                if (info.mint === USDC_MINT) {
                    return {
                        amount: parseInt(info.tokenAmount.amount, 10),
                        recipient: info.destination,
                        sender: info.source
                    };
                }
            }
        }

        // Check inner instructions (for program invocations)
        const innerInstructions = tx.meta?.innerInstructions || [];
        for (const inner of innerInstructions) {
            for (const ix of inner.instructions) {
                if (ix.program === 'spl-token' && ix.parsed?.type === 'transferChecked') {
                    const info = ix.parsed.info;
                    if (info.mint === USDC_MINT) {
                        return {
                            amount: parseInt(info.tokenAmount.amount, 10),
                            recipient: info.destination,
                            sender: info.source
                        };
                    }
                }
            }
        }

        return null;
    } catch (error) {
        console.error('[x402] Error parsing transaction:', error);
        return null;
    }
}

export default x402OrderBook;
