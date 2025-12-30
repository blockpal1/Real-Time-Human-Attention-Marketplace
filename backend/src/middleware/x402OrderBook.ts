import { Request, Response, NextFunction } from 'express';
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    Keypair,
    SYSVAR_RENT_PUBKEY
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token';
import crypto from 'crypto';
import { redisClient } from '../utils/redis';
import { moderationService } from '../services/ContentModerationService';
import { configService } from '../services/ConfigService';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const TREASURY = new PublicKey(process.env.ATTENTIUM_VAULT_ADDRESS || '2kDpvEhgoLkUbqFJqxMpUXMtr2gVYbfqNF8kGrfoZMAV');
const PAYMENT_ROUTER_PROGRAM_ID = new PublicKey(process.env.PAYMENT_ROUTER_PROGRAM_ID || 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
const IS_DEVNET = RPC_URL.includes('devnet');

// USDC Mint - Uses Devnet faucet mint when on Devnet
const MAINNET_USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const DEVNET_USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Standard Devnet USDC faucet mint
const USDC_MINT = IS_DEVNET ? DEVNET_USDC_MINT : MAINNET_USDC_MINT;

const connection = new Connection(RPC_URL, 'confirmed');

// Admin Bypass Configuration - NO fallback in production
const ADMIN_KEY = process.env.ADMIN_SECRET;
if (!ADMIN_KEY && process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: ADMIN_SECRET environment variable required in production');
}

// Memo Program for payment binding
const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

// Devnet bypass requires explicit opt-in
const ALLOW_DEVNET_BYPASS = process.env.ALLOW_DEVNET_BYPASS === 'true';

export interface OrderRecord {
    duration: number;
    quantity: number;
    bid: number;              // NET amount (what human earns, after fees)
    gross_bid: number;        // GROSS amount (what agent paid)
    total_escrow: number;
    tx_hash: string;
    referrer: string | null;  // User who referred the campaign (web2 link)
    builder_code: string | null; // Developer who built the agent (x-builder-code)
    content_url: string | null;
    validation_question: string;
    status: 'open' | 'in_progress' | 'completed' | 'rejected_tos' | 'expired';
    created_at: number;
    expires_at: number;
    result: any | null;
    // Phase 2: Secured Pull + Webhooks
    read_key: string;           // Auth key for GET /campaigns/:tx_hash/results
    webhook_secret: string;     // HMAC signing key for webhook payloads
    callback_url: string | null; // Optional webhook URL
    agent: string;              // Agent Public Key (Escrow Owner) - Required for settlement
}

// Cleanup Job: Runs every 60s to expire old open orders
export function startExpirationJob() {
    setInterval(async () => {
        try {
            if (!redisClient.isOpen) return;

            const now = Date.now();
            let expiredCount = 0;

            const openOrderIds = await redisClient.getOpenOrders();

            for (const txHash of openOrderIds) {
                const orderData = await redisClient.getOrder(txHash) as OrderRecord | null;

                if (orderData && orderData.status === 'open' && now > orderData.expires_at) {
                    await redisClient.updateOrderStatus(txHash, 'expired');
                    expiredCount++;

                    // Broadcast expiration
                    await redisClient.client.publish('marketplace_events', JSON.stringify({
                        type: 'ORDER_EXPIRED',
                        payload: { tx_hash: txHash }
                    }));
                }
            }

            if (expiredCount > 0) {
                console.log(`[x402] Cleanup: Expired ${expiredCount} stale orders`);
            }
        } catch (error) {
            console.error('[x402] Expiration job error:', error);
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
            const { duration, quantity = 1, bid_per_second, content_url, validation_question, callback_url } = req.body;

            // VIRTUAL BYPASS ONLY: Allow 0-bid campaigns for testing/points
            if (bid_per_second === 0) {
                if (duration === undefined) {
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

                // Apply spread: agent pays gross, human sees net
                const fees = await configService.getFees();
                const netBid = bid_per_second * fees.workerMultiplier;  // 85% of gross

                // Capture Builder Code
                const builderCodeHeader = req.headers['x-builder-code'];
                const builderCode = typeof builderCodeHeader === 'string' ? builderCodeHeader : null;

                // Generate secure keys for webhook authentication
                const read_key = crypto.randomBytes(16).toString('hex');
                const webhook_secret = crypto.randomBytes(32).toString('hex');

                const orderRecord: OrderRecord = {
                    duration,
                    quantity,
                    bid: netBid,                    // NET (what human earns)
                    gross_bid: bid_per_second,      // GROSS (what agent paid)
                    total_escrow: totalEscrow,
                    tx_hash,
                    referrer: null,
                    builder_code: builderCode,
                    content_url: content_url || null,
                    validation_question: validation_question,
                    status: 'open',
                    created_at: Date.now(),
                    expires_at: Date.now() + (10 * 60 * 1000), // 10 minutes TTL
                    result: null,
                    read_key,
                    webhook_secret,
                    callback_url: callback_url || null,
                    agent: 'admin_virtual' // Placeholder for virtual points campaigns
                };

                req.order = orderRecord;

                // Save to Redis
                if (redisClient.isOpen) {
                    await redisClient.setOrder(tx_hash, orderRecord);

                    // Emit socket event (broadcast NET price to frontend)
                    await redisClient.client.publish('marketplace_events', JSON.stringify({
                        type: 'BID_CREATED',
                        payload: {
                            bidId: tx_hash,
                            price: netBid,                               // NET for display
                            max_price_per_second: netBid * 1_000_000,    // NET in micros
                            duration,
                            quantity,
                            contentUrl: content_url || null,
                            validationQuestion: validation_question
                        }
                    }));
                    console.log(`[x402] Admin bypass: Created order ${tx_hash} for ${quantity}x ${duration}s @ gross $${bid_per_second}/s (net $${netBid.toFixed(4)}/s)`);
                    return next();
                }
                return next();
            }
        } // Close Admin Block (Fallthrough if bid > 0)

        // ========================================
        // STANDARD FLOW: Payment Required
        // ========================================

        // 1. EXTRACT ORDER DETAILS
        const { duration, quantity = 1, bid_per_second, content_url, validation_question, callback_url } = req.body;

        if (!duration || !bid_per_second || bid_per_second < 0.003) {
            return res.status(400).json({
                error: "invalid_bid",
                message: "Minimum bid for agents is $0.003/s. Campaign Manager (Admin) is required for $0.0000 bids."
            });
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

            // --- NON-CUSTODIAL SERIALIZED TRANSACTION GENERATION ---
            const agentKeyHeader = req.headers['x-agent-key'];
            console.log('[x402] X-Agent-Key header:', agentKeyHeader, '| Type:', typeof agentKeyHeader);

            if (typeof agentKeyHeader === 'string') {
                try {
                    const agentPubkey = new PublicKey(agentKeyHeader);

                    // 1. Derive PDAs
                    const [escrowPDA] = PublicKey.findProgramAddressSync(
                        [Buffer.from("escrow"), agentPubkey.toBuffer()],
                        PAYMENT_ROUTER_PROGRAM_ID
                    );

                    const vaultATA = await getAssociatedTokenAddress(USDC_MINT, escrowPDA, true);
                    const agentATA = await getAssociatedTokenAddress(USDC_MINT, agentPubkey);

                    // 2. Build Transaction
                    const tx = new Transaction();

                    // Generate a unique Campaign ID for this escrow
                    const campaignId = crypto.randomBytes(16).toString('hex');

                    // 2a. Create Vault ATA (Agent pays rent) - Idempotent
                    tx.add(
                        createAssociatedTokenAccountIdempotentInstruction(
                            agentPubkey, // Payer
                            vaultATA,    // Associated Account
                            escrowPDA,   // Owner
                            USDC_MINT    // Mint
                        )
                    );

                    // 2b. Deposit Escrow Instruction (Anchor)
                    const discriminator = Buffer.from('e2709eb0b2769980', 'hex'); // deposit_escrow
                    const amountBuffer = Buffer.alloc(8);
                    // Convert totalEscrow (USDC) to atomic units (6 decimals)
                    // Note: totalEscrow is in dollars (e.g., 5.00)
                    const atomicAmount = BigInt(Math.round(totalEscrow * 1_000_000));
                    amountBuffer.writeBigUInt64LE(atomicAmount);

                    const data = Buffer.concat([discriminator, amountBuffer]);

                    // Derive Fee Vault PDAs for mint validation
                    const [feeVaultStatePDA] = PublicKey.findProgramAddressSync(
                        [Buffer.from("fee_vault_state")],
                        PAYMENT_ROUTER_PROGRAM_ID
                    );
                    const [feeVaultPDA] = PublicKey.findProgramAddressSync(
                        [Buffer.from("fee_vault"), feeVaultStatePDA.toBuffer()],
                        PAYMENT_ROUTER_PROGRAM_ID
                    );

                    const keys = [
                        { pubkey: agentPubkey, isSigner: true, isWritable: true },
                        { pubkey: agentATA, isSigner: false, isWritable: true },
                        { pubkey: escrowPDA, isSigner: false, isWritable: true },
                        { pubkey: feeVaultStatePDA, isSigner: false, isWritable: false },
                        { pubkey: feeVaultPDA, isSigner: false, isWritable: false },
                        { pubkey: vaultATA, isSigner: false, isWritable: true },
                        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false }
                    ];

                    const ix = new TransactionInstruction({
                        keys,
                        programId: PAYMENT_ROUTER_PROGRAM_ID,
                        data
                    });

                    tx.add(ix);

                    // 2c. Add Memo Instruction (binds payment to campaign_id)
                    const memoIx = new TransactionInstruction({
                        keys: [],
                        programId: new PublicKey(MEMO_PROGRAM),
                        data: Buffer.from(campaignId, 'utf-8')
                    });
                    tx.add(memoIx);

                    // 2d. Finalize
                    tx.feePayer = agentPubkey;
                    const { blockhash } = await connection.getLatestBlockhash();
                    tx.recentBlockhash = blockhash;

                    const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');

                    return res.status(402).json({
                        error: "payment_required",
                        message: "Sign the attached transaction to fund escrow.",
                        transaction: serializedTx,
                        amount: totalEscrow,
                        campaign_id: campaignId  // Frontend must send this back as X-Campaign-Id
                    });

                } catch (err) {
                    console.error("[x402] Error generating tx:", err);
                    // Fallthrough to standard invoice
                }
            }

            // Fallback: Standard Invoice (Old Flow)
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

        // Ensure transaction succeeded (not failed)
        if (txStatus.meta?.err) {
            return res.status(400).json({ error: "transaction_failed", message: "Transaction execution failed on-chain" });
        }

        // ========================================
        // MEMO VALIDATION: Bind payment to campaign_id
        // ========================================
        const campaignId = req.headers['x-campaign-id'];
        if (!campaignId || typeof campaignId !== 'string') {
            return res.status(400).json({ error: "missing_campaign_id", message: "X-Campaign-Id header required" });
        }

        // Check if transaction invokes Payment Router program
        const accountKeys = txStatus.transaction.message.getAccountKeys();
        const compiledInstructions = txStatus.transaction.message.compiledInstructions;

        const isPaymentRouterTx = compiledInstructions.some(
            (ix: any) => accountKeys.get(ix.programIdIndex)?.equals(PAYMENT_ROUTER_PROGRAM_ID)
        );

        // Parse memo from transaction
        const memoInstruction = compiledInstructions.find(
            (ix: any) => accountKeys.get(ix.programIdIndex)?.toBase58() === MEMO_PROGRAM
        );

        if (!memoInstruction) {
            return res.status(400).json({ error: "missing_memo", message: "Transaction must include campaign_id in memo" });
        }

        const memoData = Buffer.from(memoInstruction.data).toString('utf8');
        if (memoData !== campaignId) {
            return res.status(400).json({
                error: "memo_mismatch",
                message: "Transaction memo does not match X-Campaign-Id header",
                expected: campaignId,
                received: memoData
            });
        }
        console.log(`[x402] Memo validated: ${campaignId.slice(0, 8)}... | Payment Router: ${isPaymentRouterTx}`);

        // --- VALIDATION LOGIC ---
        let isValidPayment = false;

        // Check 1: Is it recent? (Prevents replay attacks older than 2 mins)
        const now = Math.floor(Date.now() / 1000);
        if (txStatus.blockTime && (now - txStatus.blockTime > 120)) {
            return res.status(403).json({ error: "expired_transaction" });
        }

        // Check 2: Payment Router Escrow Deposit
        if (isPaymentRouterTx) {
            console.log('[x402] Payment Router escrow deposit accepted');
            isValidPayment = true;
        }

        // Check 3: Devnet Bypass (Native SOL) - REQUIRES EXPLICIT OPT-IN
        if (!isValidPayment && IS_DEVNET && ALLOW_DEVNET_BYPASS) {
            const devnetAccountKeys = txStatus.transaction.message.getAccountKeys();
            const nativeTransfer = devnetAccountKeys.staticAccountKeys.some(k => k.equals(TREASURY));
            if (nativeTransfer) {
                console.log('[x402] Devnet bypass: Accepted native SOL transfer (ALLOW_DEVNET_BYPASS=true)');
                isValidPayment = true;
            }
        } else if (IS_DEVNET && !ALLOW_DEVNET_BYPASS && !isValidPayment) {
            console.warn('[x402] Devnet RPC detected but ALLOW_DEVNET_BYPASS not set - requiring USDC');
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
            // IDEMPOTENCY CHECK: Return existing order if tx already processed
            // ========================================
            const existingOrder = await redisClient.getOrder(txSignature) as any;
            if (existingOrder) {
                console.log(`[x402] Idempotent: Returning existing order for ${txSignature}`);
                req.order = existingOrder;
                return next();
            }

            // ========================================
            // CONTENT MODERATION CHECK
            // ========================================
            const moderationResult = await moderationService.moderateContentInline(content_url, validation_question);
            const orderStatus = moderationResult.approved ? 'open' : 'rejected_tos';

            // Apply spread: agent pays gross, human sees net
            const fees = await configService.getFees();
            const netBid = bid_per_second * fees.workerMultiplier;  // 85% of gross

            // Capture Builder Code
            const builderCodeHeader = req.headers['x-builder-code'];
            const builderCode = typeof builderCodeHeader === 'string' ? builderCodeHeader : null;

            // Generate secure keys for webhook authentication
            const read_key = crypto.randomBytes(16).toString('hex');
            const webhook_secret = crypto.randomBytes(32).toString('hex');

            // 5b. EXTRACT AGENT KEY FROM TRANSACTION (Signer 0 / FeePayer)
            // In Solana, accountKeys[0] is usually the fee payer and signer
            const accounts = txStatus.transaction.message.getAccountKeys();
            const agentKey = accounts.get(0)!.toBase58();

            // ATTACH DATA TO REQUEST
            const orderRecord: OrderRecord = {
                duration,
                quantity,
                bid: netBid,                    // NET (what human earns)
                gross_bid: bid_per_second,      // GROSS (what agent paid)
                total_escrow: totalEscrow,
                tx_hash: txSignature,
                referrer: referrer,
                builder_code: builderCode,
                content_url: content_url || null,
                validation_question: validation_question,
                status: orderStatus,
                created_at: Date.now(),
                expires_at: Date.now() + (10 * 60 * 1000), // 10 minutes TTL
                result: null,
                read_key,
                webhook_secret,
                callback_url: callback_url || null,
                agent: agentKey
            };

            req.order = orderRecord;

            // Save to Redis (regardless of moderation result)
            if (redisClient.isOpen) {
                await redisClient.setOrder(txSignature, orderRecord);

                // ONLY broadcast to WebSocket if moderation passed (broadcast NET price)
                if (orderStatus === 'open') {
                    await redisClient.client.publish('marketplace_events', JSON.stringify({
                        type: 'BID_CREATED',
                        payload: {
                            bidId: txSignature,
                            price: netBid,                               // NET for display
                            max_price_per_second: netBid * 1_000_000,    // NET in micros
                            duration: duration,
                            quantity: quantity,
                            contentUrl: content_url || null,
                            validationQuestion: validation_question
                        }
                    }));
                    console.log('[x402] Broadcasted BID_CREATED via WebSocket');
                    console.log(`[x402] Payment verified + Moderation PASSED: ${totalEscrow} USDC for ${quantity}x ${duration}s @ gross $${bid_per_second}/s (net $${netBid.toFixed(4)}/s)`);
                } else {
                    console.log(`[x402] Payment verified + Moderation FAILED: ${totalEscrow} USDC held. Reason: ${moderationResult.reason}`);
                }
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
