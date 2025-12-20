import { Request, Response } from 'express';
import { redisClient } from '../utils/redis';

/**
 * GET /v1/agents/bids
 * Returns active bids in the order book
 * Used by frontend Order Book component
 */
export const getActiveBids = async (req: Request, res: Response) => {
    try {
        if (!redisClient.isOpen) {
            return res.status(503).json({ error: 'Redis connection unavailable' });
        }

        const now = Date.now();
        const bids: any[] = [];
        const openOrderIds = await redisClient.getOpenOrders();

        for (const txHash of openOrderIds) {
            const order = await redisClient.getOrder(txHash) as any;

            // Only include open orders that haven't expired
            if (order && order.status === 'open' && order.quantity > 0 && now < order.expires_at) {
                bids.push({
                    id: txHash,
                    maxPricePerSecond: Math.round(order.bid * 1_000_000), // Convert back to micros for compatibility
                    durationPerUser: order.duration,
                    targetQuantity: order.quantity,
                    contentUrl: order.content_url,
                    validationQuestion: order.validation_question,
                    createdAt: new Date(order.created_at),
                    expiry: new Date(order.expires_at),
                    active: true
                });
            }
        }

        // Sort by price descending
        bids.sort((a, b) => b.maxPricePerSecond - a.maxPricePerSecond);

        res.json(bids.slice(0, 100));
    } catch (error) {
        console.error('Get Active Bids Error:', error);
        res.status(500).json({ error: 'Failed to fetch bids' });
    }
};
