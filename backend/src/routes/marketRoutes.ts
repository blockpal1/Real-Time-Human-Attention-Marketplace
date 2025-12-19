import { Router } from 'express';
import { redisClient } from '../utils/redis';
import { configService } from '../services/ConfigService';

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
    try {
        const fees = await configService.getFees();

        const openOrders: Array<{
            tx_hash: string;
            duration: number;
            bid_per_second: number;      // NET (what human earns) - spread already applied
            gross_bid: number;           // GROSS (what agent paid)
            total_escrow: number;
            quantity: number;
            created_at: number;
        }> = [];

        if (redisClient.isOpen) {
            const openOrderIds = await redisClient.getOpenOrders();

            for (const txHash of openOrderIds) {
                const order = await redisClient.getOrder(txHash) as any;
                if (order && order.status === 'open') {
                    openOrders.push({
                        tx_hash: txHash,
                        duration: order.duration,
                        bid_per_second: order.bid,           // Already NET (spread applied at creation)
                        gross_bid: order.gross_bid || order.bid,  // GROSS (fallback for legacy orders)
                        total_escrow: order.total_escrow,
                        quantity: order.quantity,
                        created_at: order.created_at
                    });
                }
            }
        }

        // Sort by bid (highest first - what humans see)
        openOrders.sort((a, b) => b.bid_per_second - a.bid_per_second);

        res.json({
            count: openOrders.length,
            fee_rate: fees.total,
            orders: openOrders
        });
    } catch (error) {
        console.error('Orderbook Error:', error);
        res.status(500).json({ error: 'Failed to fetch order book' });
    }
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

export default router;
