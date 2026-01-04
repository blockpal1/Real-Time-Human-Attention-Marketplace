import { Router } from 'express';
import { redisClient } from '../utils/redis';
import { configService } from '../services/ConfigService';
import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PAYMENT_ROUTER_PROGRAM_ID = new PublicKey(process.env.PAYMENT_ROUTER_PROGRAM_ID || 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

const connection = new Connection(RPC_URL, 'confirmed');

const router = Router();

/**
 * GET /v1/oracle/quote
 * Returns the "Blind" Oracle clearing price for agents
 * Agents pay Gross - they don't see the net calculation
 */
router.get('/oracle/quote', async (req, res) => {
    try {
        const duration = parseInt(req.query.duration as string) || 30;

        // Validate duration
        if (![10, 30, 60].includes(duration)) {
            return res.status(400).json({
                error: 'invalid_duration',
                message: 'Duration must be 10, 30, or 60 seconds',
                valid_durations: [10, 30, 60]
            });
        }

        // Fetch all open orders
        const bids: number[] = [];

        if (redisClient.isOpen) {
            const openOrderIds = await redisClient.getOpenOrders();

            for (const txHash of openOrderIds) {
                const order = await redisClient.getOrder(txHash) as any;
                if (order && order.status === 'open') {
                    // Filter by duration if specific, or include all
                    if (order.duration === duration || !req.query.duration) {
                        bids.push(order.bid); // bid per second in USDC
                    }
                }
            }
        }

        let grossBidCents: number;

        const fees = await configService.getFees();

        if (bids.length === 0) {
            // Empty market: use floor price (0.01 USDC/second = 1 cent)
            grossBidCents = 1;
        } else {
            // NEW ORACLE LOGIC:
            // 1. Find Highest Net Bid
            // 2. Add $0.01 (to beat it)
            // 3. Gross it up (Reverse the spread)

            const maxNetBid = Math.max(...bids);
            const targetNetBid = maxNetBid + 0.01;

            // net = gross * multiplier  =>  gross = net / multiplier
            const recommendedGross = targetNetBid / fees.workerMultiplier;

            // Convert to cents (integer)
            grossBidCents = Math.round(recommendedGross * 100);

            // Safety: Ensure it's at least 1 cent
            grossBidCents = Math.max(1, grossBidCents);
        }

        res.json({
            duration,
            gross_bid_cents: grossBidCents,
            market_depth: bids.length,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Oracle Quote Error:', error);
        res.status(500).json({ error: 'Failed to generate quote' });
    }
});


/**
 * GET /v1/orderbook
 * Returns all open orders for the frontend Order Book UI
 * bid is already NET (spread applied at order creation)
 */
router.get('/orderbook', async (req, res) => {
    // PLACEHOLDER DATA (Requested by User)
    const openOrders = [
        {
            tx_hash: 'order_mock_123',
            duration: 30,
            bid_per_second: 0.05,
            gross_bid: 0.06,
            total_escrow: 10,
            quantity: 5,
            created_at: Date.now()
        },
        {
            tx_hash: 'order_mock_456',
            duration: 60,
            bid_per_second: 0.10,
            gross_bid: 0.12,
            total_escrow: 20,
            quantity: 2,
            created_at: Date.now() - 60000
        }
    ];

    res.json({
        count: openOrders.length,
        fee_rate: 0.20,
        orders: openOrders
    });
});

/**
 * POST /v1/orders/:tx_hash/fill
 * Human accepts an order from the book
 */
router.post('/orders/:tx_hash/fill', async (req, res) => {
    const { tx_hash } = req.params;

    const order = await redisClient.getOrder(tx_hash) as any;

    if (!order) {
        return res.status(404).json({
            error: 'order_not_found',
            message: 'No order found with this transaction hash'
        });
    }

    if (order.status !== 'open') {
        return res.status(400).json({
            error: 'order_not_available',
            message: `Order is already ${order.status}`,
            current_status: order.status
        });
    }

    // Update status to in_progress
    order.status = 'in_progress';
    await redisClient.setOrder(tx_hash, order);
    await redisClient.updateOrderStatus(tx_hash, 'in_progress');

    // Broadcast to WebSocket clients
    if (redisClient.isOpen) {
        await redisClient.client.publish('marketplace_events', JSON.stringify({
            type: 'BID_FILLED',
            payload: { bidId: tx_hash }
        }));
        console.log('[Market] Broadcasted BID_FILLED via WebSocket');
    }

    console.log(`[Market] Order filled: ${tx_hash.slice(0, 16)}...`);

    res.json({
        status: 'filled',
        order: {
            tx_hash: order.tx_hash,
            duration: order.duration,
            quantity: order.quantity,
            bid_per_second: order.bid,
            total_escrow: order.total_escrow,
            status: order.status
        }
    });
});

/**
 * POST /v1/orders/:tx_hash/complete
 * Human completes an order with their answer
 * Supports multi-quantity: appends to results array
 */
router.post('/orders/:tx_hash/complete', async (req, res) => {
    const { tx_hash } = req.params;
    const { answer, actual_duration, session_id } = req.body;

    const order = await redisClient.getOrder(tx_hash) as any;

    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    // Allow completion for 'in_progress' or 'open'
    if (order.status !== 'in_progress' && order.status !== 'open') {
        return res.status(400).json({
            error: 'invalid_status',
            message: `Order cannot accept completions in status: ${order.status}`,
            current_status: order.status
        });
    }

    // Calculate earnings
    const duration = actual_duration || order.duration;
    const earnedAmount = order.bid * duration;

    // Store result
    if (!Array.isArray(order.result)) {
        order.result = [];
    }

    const responseEntry = {
        answer: answer || null,
        actual_duration: duration,
        completed_at: Date.now(),
        earned_amount: earnedAmount,
        session_id: session_id || null
    };
    order.result.push(responseEntry);

    // Save to Redis
    await redisClient.setOrder(tx_hash, order);

    console.log(`[Market] Order result recorded: ${tx_hash.slice(0, 16)}...`);

    // Broadcast result
    if (redisClient.isOpen) {
        await redisClient.client.publish('marketplace_events', JSON.stringify({
            type: 'ORDER_RESULT',
            payload: {
                tx_hash,
                result: responseEntry
            }
        }));
    }

    res.json({
        success: true,
        saved_result: responseEntry
    });
});

/**
 * GET /v1/campaigns/:tx_hash/results
 * Agent retrieves all human responses for their campaign
 * Returns the original validation question + all answers
 */
router.get('/campaigns/:tx_hash/results', async (req, res) => {
    const { tx_hash } = req.params;

    try {
        const order = await redisClient.getOrder(tx_hash) as any;

        if (!order) {
            return res.status(404).json({
                error: 'campaign_not_found',
                message: 'No campaign found with this transaction hash'
            });
        }

        // Security Check: Require read_key to access paid results
        if (req.query.key !== order.read_key) {
            return res.status(401).json({
                error: 'unauthorized',
                message: 'Invalid or missing read_key. Use ?key=YOUR_READ_KEY'
            });
        }

        // Parse results array (may be stored as string or array)
        let results: any[] = [];
        if (order.result) {
            if (Array.isArray(order.result)) {
                results = order.result;
            } else if (typeof order.result === 'string') {
                try {
                    results = JSON.parse(order.result);
                } catch {
                    results = [order.result];
                }
            } else {
                results = [order.result];
            }
        }

        // Calculate aggregates
        const completedCount = results.length;
        const targetQuantity = order.quantity_original || order.quantity + completedCount;
        const avgDuration = completedCount > 0
            ? results.reduce((sum, r) => sum + (r.actual_duration || r.duration || 0), 0) / completedCount
            : 0;

        res.json({
            campaign_id: tx_hash,
            validation_question: order.validation_question || null,
            content_url: order.content_url || null,
            status: order.status,
            target_quantity: targetQuantity,
            completed_quantity: completedCount,
            remaining_quantity: order.quantity || 0,
            bid_per_second: order.bid,
            duration_per_response: order.duration,
            created_at: order.created_at,
            results: results.map((r, idx) => ({
                response_id: `resp_${idx + 1}`,
                answer: r.answer || null,
                duration_seconds: r.actual_duration || r.duration || order.duration,
                completed_at: r.completed_at || null,
                exited_early: r.exited_early || false
            })),
            aggregates: {
                avg_duration_seconds: parseFloat(avgDuration.toFixed(1)),
                completion_rate: targetQuantity > 0 ? parseFloat((completedCount / targetQuantity).toFixed(2)) : 0,
                total_responses: completedCount
            }
        });

    } catch (error) {
        console.error('Get campaign results error:', error);
        res.status(500).json({ error: 'Failed to fetch campaign results' });
    }
});

/**
 * GET /v1/campaigns/:tx_hash
 * Agent checks campaign status and requests refund if expired
 */
router.get('/campaigns/:tx_hash', async (req, res) => {
    const { tx_hash } = req.params;

    try {
        const order = await redisClient.getOrder(tx_hash) as any;

        if (!order) {
            return res.status(404).json({ error: 'campaign_not_found' });
        }

        const isRefunable = (order.status === 'expired' || order.status === 'completed' || order.status === 'cancelled');
        let withdrawTx: string | null = null;
        let escrowBalance = 0;

        // If refundable, check chain balance and build tx
        if (isRefunable && order.agent_key) {
            const agentKey = new PublicKey(order.agent_key);
            const [escrowPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("escrow"), agentKey.toBuffer()],
                PAYMENT_ROUTER_PROGRAM_ID
            );

            // Check balance
            const vaultATA = await getAssociatedTokenAddress(USDC_MINT, escrowPDA, true);
            try {
                const balance = await connection.getTokenAccountBalance(vaultATA);
                escrowBalance = balance.value.uiAmount || 0;
            } catch (e) {
                // Account might not exist if fully withdrawn
                escrowBalance = 0;
            }

            if (escrowBalance > 0) {
                // Build Withdraw Tx
                // withdraw_escrow instruction takes amount: u64
                const discriminator = Buffer.from('5154e280f52f6068', 'hex'); // withdraw_escrow

                // Convert USDC amount to lamports (6 decimals)
                const amountLamports = BigInt(Math.floor(escrowBalance * 1_000_000));

                const dataBuffer = Buffer.alloc(8 + 8);
                discriminator.copy(dataBuffer, 0);
                dataBuffer.writeBigUInt64LE(amountLamports, 8);

                const agentATA = await getAssociatedTokenAddress(USDC_MINT, agentKey);

                // WithdrawEscrow accounts (from lib.rs):
                // agent (signer, mut), agent_token_account (mut), escrow_account (mut), vault (mut), token_program
                const keys = [
                    { pubkey: agentKey, isSigner: true, isWritable: true },
                    { pubkey: agentATA, isSigner: false, isWritable: true },
                    { pubkey: escrowPDA, isSigner: false, isWritable: true },
                    { pubkey: vaultATA, isSigner: false, isWritable: true },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
                ];

                const ix = new TransactionInstruction({
                    keys,
                    programId: PAYMENT_ROUTER_PROGRAM_ID,
                    data: dataBuffer
                });

                const { blockhash } = await connection.getLatestBlockhash();
                const tx = new Transaction();
                tx.recentBlockhash = blockhash;
                tx.feePayer = agentKey; // Agent pays for refund
                tx.add(ix);

                withdrawTx = tx.serialize({ requireAllSignatures: false }).toString('base64');
            }
        }

        res.json({
            tx_hash: order.tx_hash,
            status: order.status,
            escrow_balance: escrowBalance,
            refundable: isRefunable && escrowBalance > 0,
            withdraw_escrow_tx: withdrawTx,
            created_at: order.created_at,
            agent: order.agent_key
        });

    } catch (error) {
        console.error('Get campaign info error:', error);
        res.status(500).json({ error: 'Failed to fetch campaign info' });
    }
});

export default router;
