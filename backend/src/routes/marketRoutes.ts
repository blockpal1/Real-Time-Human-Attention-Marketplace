import { Router } from 'express';
import { orderStore, OrderRecord } from '../middleware/x402OrderBook';
import { redis } from '../utils/redis';

const router = Router();

/**
 * GET /v1/orderbook
 * Returns all open orders for the frontend Order Book UI
 */
router.get('/orderbook', (req, res) => {
    const openOrders: Array<{
        tx_hash: string;
        duration: number;
        bid_per_second: number;
        total_escrow: number;
        quantity: number;
        created_at: number;
    }> = [];

    orderStore.forEach((order, txHash) => {
        if (order.status === 'open') {
            openOrders.push({
                tx_hash: txHash,
                duration: order.duration,
                bid_per_second: order.bid,
                total_escrow: order.total_escrow,
                quantity: order.quantity,
                created_at: order.created_at
            });
        }
    });

    // Sort by bid (highest first) - best bids at top
    openOrders.sort((a, b) => b.bid_per_second - a.bid_per_second);

    res.json({
        count: openOrders.length,
        orders: openOrders
    });
});

/**
 * POST /v1/orders/:tx_hash/fill
 * Human accepts an order from the book
 */
router.post('/orders/:tx_hash/fill', async (req, res) => {
    const { tx_hash } = req.params;

    const order = orderStore.get(tx_hash);

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
    orderStore.set(tx_hash, order);

    // Broadcast to WebSocket clients
    if (redis.isOpen) {
        await redis.publish('marketplace_events', JSON.stringify({
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

    const order = orderStore.get(tx_hash);

    if (!order) {
        return res.status(404).json({
            error: 'order_not_found',
            message: 'No order found with this transaction hash'
        });
    }

    // Allow completion for 'in_progress' or 'open' (MatchingEngine may not have updated status yet)
    if (order.status !== 'in_progress' && order.status !== 'open') {
        return res.status(400).json({
            error: 'invalid_status',
            message: `Order cannot accept completions in status: ${order.status}`,
            current_status: order.status
        });
    }

    // Calculate earnings for this response
    const duration = actual_duration || order.duration;
    const earnedAmount = order.bid * duration;

    // Initialize results array if needed
    if (!Array.isArray(order.result)) {
        order.result = [];
    }

    // Append this response to results
    const responseEntry = {
        answer: answer || null,
        actual_duration: duration,
        completed_at: Date.now(),
        earned_amount: earnedAmount,
        session_id: session_id || null
    };
    order.result.push(responseEntry);

    // Track how many have been completed
    const completedCount = order.result.length;
    const originalQuantity = order.quantity + completedCount; // quantity decrements on match

    // Update status: 'completed' only when all fills are done
    if (order.quantity === 0) {
        order.status = 'completed';
    }
    orderStore.set(tx_hash, order);

    // Broadcast completion event
    if (redis.isOpen) {
        await redis.publish('marketplace_events', JSON.stringify({
            type: 'ORDER_RESPONSE',
            payload: {
                tx_hash,
                answer: answer || null,
                duration,
                earned_amount: earnedAmount,
                response_count: completedCount,
                remaining: order.quantity
            }
        }));
        console.log(`[Market] Response ${completedCount} for ${tx_hash.slice(0, 16)}... (${order.quantity} remaining)`);
    }

    res.json({
        success: true,
        tx_hash,
        status: order.status,
        response_count: completedCount,
        remaining: order.quantity,
        this_response: responseEntry
    });
});

/**
 * GET /v1/orders/:tx_hash
 * Get order status by transaction hash
 */
router.get('/orders/:tx_hash', (req, res) => {
    const { tx_hash } = req.params;

    const order = orderStore.get(tx_hash);

    if (!order) {
        return res.status(404).json({
            error: 'order_not_found',
            message: 'No order found with this transaction hash'
        });
    }

    res.json({
        status: order.status,
        created_at: order.created_at,
        duration: order.duration,
        quantity: order.quantity,
        total_escrow: order.total_escrow,
        referrer: order.referrer,
        result: order.result
    });
});

export default router;
