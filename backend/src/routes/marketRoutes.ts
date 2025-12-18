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
