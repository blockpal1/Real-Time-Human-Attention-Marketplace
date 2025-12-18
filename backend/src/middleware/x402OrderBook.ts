import { Request, Response, NextFunction } from 'express';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { redis } from '../utils/redis';
import { moderationService } from '../services/ContentModerationService';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const TREASURY = new PublicKey(process.env.SOLANA_TREASURY_WALLET || '2kDpvEhgoLkUbqFJqxMpUXMtr2gVYbfqNF8kGrfoZMAV');
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Mainnet USDC
const IS_DEVNET = RPC_URL.includes('devnet');

const connection = new Connection(RPC_URL, 'confirmed');

// Admin Bypass Configuration
const ADMIN_KEY = process.env.ADMIN_SECRET;

// In-memory order storage (for status polling)
export const orderStore = new Map<string, OrderRecord>();

export interface OrderRecord {
    duration: number;
    quantity: number;
    bid: number;
    total_escrow: number;
    tx_hash: string;
    referrer: string | null;
    content_url: string | null;
    validation_question: string;
    status: 'open' | 'in_progress' | 'completed' | 'rejected_tos' | 'expired';
    created_at: number;
    expires_at: number;
    result: any | null;
}

// Cleanup Job: Runs every 60s to expire old open orders
export function startExpirationJob() {
    setInterval(() => {
        const now = Date.now();
        let expiredCount = 0;

        orderStore.forEach((order, txHash) => {
            if (order.status === 'open' && now > order.expires_at) {
                order.status = 'expired';
                orderStore.set(txHash, order);
                expiredCount++;

                // Broadcast expiration
                if (redis.isOpen) {
                    redis.publish('marketplace_events', JSON.stringify({
                        type: 'ORDER_EXPIRED',
                        payload: { tx_hash: txHash }
                    }));
                }
            }
        });

        if (expiredCount > 0) {
            console.log(`[x402] Cleanup: Expired ${expiredCount} stale orders`);
        }
    }, 60000); // Check every minute
}

// Extend Express Request type
declare global {
    namespace Express {
        interface Request {
            order?: OrderRecord;
        }
    }
}

export async function x402Middleware(req: Request, res: Response, next: NextFunction) {
    try {
        // ========================================
        // ADMIN BYPASS: Skip payment for privileged requests
        // ========================================
        const adminKeyHeader = req.headers['x-admin-key'];
        if (ADMIN_KEY && adminKeyHeader === ADMIN_KEY) {
            const { duration, quantity = 1, bid_per_second, content_url, validation_question } = req.body;

            if (!duration || !bid_per_second) {
                return res.status(400).json({ error: "Missing required fields: duration, bid_per_second" });
            }

            if (!validation_question) {
                return res.status(400).json({ error: "Missing validation_question" });
            }

            // Validate duration
            if (![10, 30, 60].includes(duration)) {
                return res.status(400).json({ error: "Invalid duration. Must be 10, 30, or 60." });
            }

            // Generate random tx_hash for admin orders
            const tx_hash = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
            const totalEscrow = duration * quantity * bid_per_second;

            const orderRecord: OrderRecord = {
                duration,
                quantity,
                bid: bid_per_second,
                total_escrow: totalEscrow,
                tx_hash,
                referrer: null,
                content_url: content_url || null,
                validation_question: validation_question,
                status: 'open',
                created_at: Date.now(),
                expires_at: Date.now() + (10 * 60 * 1000), // 10 minutes TTL
                result: null
            };

            req.order = orderRecord;
            orderStore.set(tx_hash, orderRecord);

            req.order = orderRecord;
            orderStore.set(tx_hash, orderRecord);

            // Emit socket event via Redis
            if (redis.isOpen) {
                await redis.publish('marketplace_events', JSON.stringify({
                    type: 'BID_CREATED',
                    payload: {
                        bidId: tx_hash,
                        price: bid_per_second,
                        max_price_per_second: bid_per_second * 1_000_000,
                        duration,
                        quantity,
                        contentUrl: content_url || null,
                        validationQuestion: validation_question
                    }
                }));
                console.log('[x402] Admin bypass: Broadcasted BID_CREATED via WebSocket');
            }

            console.log(`[x402] Admin bypass: Created order ${tx_hash} for ${quantity}x ${duration}s @ $${bid_per_second}/s`);
            return next();
        }

        // 1. EXTRACT ORDER DETAILS
        const { duration, quantity = 1, bid_per_second, content_url, validation_question } = req.body;

        if (!duration || !bid_per_second) {
            return res.status(400).json({ error: "Missing duration or bid_per_second" });
        }

        // Validation question is REQUIRED
        if (!validation_question) {
            return res.status(400).json({ error: "Missing validation_question" });
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
            // Parse for SPL Token transfers to treasury USDC account
            const meta = txStatus.meta;
            if (meta && meta.preTokenBalances && meta.postTokenBalances) {
                // Find treasury's USDC token account changes
                const treasuryBase58 = TREASURY.toBase58();

                for (const postBalance of meta.postTokenBalances) {
                    // Check if this is USDC (mainnet mint)
                    if (postBalance.mint !== USDC_MINT.toBase58()) continue;

                    // Check if owner is treasury
                    if (postBalance.owner !== treasuryBase58) continue;

                    // Find matching preBalance to calculate delta
                    const preBalance = meta.preTokenBalances.find(
                        pre => pre.accountIndex === postBalance.accountIndex
                    );

                    const preBal = preBalance?.uiTokenAmount?.uiAmount || 0;
                    const postBal = postBalance.uiTokenAmount?.uiAmount || 0;
                    const transferAmount = postBal - preBal;

                    console.log(`[x402] USDC transfer detected: ${transferAmount} USDC to treasury`);

                    // Validate amount (allow small rounding tolerance)
                    if (transferAmount >= totalEscrow * 0.999) {
                        console.log(`[x402] Mainnet: Valid USDC payment of ${transferAmount} (required: ${totalEscrow})`);
                        isValidPayment = true;
                        break;
                    } else {
                        console.log(`[x402] Mainnet: USDC amount too low: ${transferAmount} < ${totalEscrow}`);
                    }
                }

                if (!isValidPayment) {
                    return res.status(402).json({
                        error: "insufficient_payment",
                        message: `No valid USDC transfer to treasury found. Required: ${totalEscrow} USDC`,
                        invoice: {
                            amount: totalEscrow,
                            destination: treasuryBase58,
                            token: "USDC",
                            mint: USDC_MINT.toBase58()
                        }
                    });
                }
            } else {
                return res.status(400).json({
                    error: "invalid_transaction",
                    message: "Transaction does not contain token balance metadata"
                });
            }
        }

        if (isValidPayment) {
            // ========================================
            // CONTENT MODERATION CHECK
            // ========================================
            const moderationResult = await moderationService.moderateContentInline(content_url, validation_question);
            const orderStatus = moderationResult.approved ? 'open' : 'rejected_tos';

            // ATTACH DATA TO REQUEST
            const orderRecord: OrderRecord = {
                duration,
                quantity,
                bid: bid_per_second,
                total_escrow: totalEscrow,
                tx_hash: txSignature,
                referrer: referrer,
                content_url: content_url || null,
                validation_question: validation_question,
                status: orderStatus,
                created_at: Date.now(),
                expires_at: Date.now() + (10 * 60 * 1000), // 10 minutes TTL
                result: null
            };

            req.order = orderRecord;

            // Save to order store for status polling (regardless of moderation result)
            orderStore.set(txSignature, orderRecord);

            // ONLY broadcast to WebSocket if moderation passed
            if (orderStatus === 'open') {
                if (redis.isOpen) {
                    await redis.publish('marketplace_events', JSON.stringify({
                        type: 'BID_CREATED',
                        payload: {
                            bidId: txSignature,
                            price: bid_per_second,
                            max_price_per_second: bid_per_second * 1_000_000,
                            duration: duration,
                            quantity: quantity,
                            contentUrl: content_url || null,
                            validationQuestion: validation_question
                        }
                    }));
                    console.log('[x402] Broadcasted BID_CREATED via WebSocket');
                }
                console.log(`[x402] Payment verified + Moderation PASSED: ${totalEscrow} USDC for ${quantity}x ${duration}s`);
            } else {
                console.log(`[x402] Payment verified + Moderation FAILED: ${totalEscrow} USDC held. Reason: ${moderationResult.reason}`);
            }

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
