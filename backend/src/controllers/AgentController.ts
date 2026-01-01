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

/**
 * GET /v1/agents/:pubkey/campaigns
 * Returns all campaigns (active and past) for a specific agent
 */
export const getAgentCampaigns = async (req: Request, res: Response) => {
    const { pubkey } = req.params;

    try {
        if (!redisClient.isOpen) {
            console.warn('[AgentController] Redis disconnected during getAgentCampaigns');
            return res.status(503).json({ error: 'Redis connection unavailable' });
        }

        const campaigns: any[] = [];
        // TODO: In production, use a SET per agent to index their orders.
        // For now, scanning all open orders is acceptable for MVP scale.
        const orderIds = await redisClient.getOpenOrders();

        console.log(`[AgentController] Fetching campaigns for agent: ${pubkey}`);
        console.log(`[AgentController] Total open orders in Redis: ${orderIds.length}`);

        for (const txHash of orderIds) {
            const order = await redisClient.getOrder(txHash) as any;
            // Check if this order belongs to the requesting agent
            // We need to store 'creator' or 'signer' in the order object during creation.
            // If it's missing, we can't filter effectively yet.

            // Support both keys for backward compatibility/migration
            if (order && (order.agent === pubkey || order.creator === pubkey)) {
                campaigns.push({
                    bidId: txHash,
                    question: order.validation_question,
                    targetResponses: order.quantity,
                    completedResponses: order.filled_count || 0,
                    budgetSpent: (order.filled_count || 0) * order.bid,
                    status: order.filled_count >= order.quantity ? 'completed' : 'active',
                    progress: ((order.filled_count || 0) / order.quantity) * 100,
                    date: order.created_at
                });
            }
        }

        console.log(`[AgentController] Found ${campaigns.length} matching campaigns.`);
        res.json(campaigns);
    } catch (error) {
        console.error('Get Agent Campaigns Error:', error);
        res.status(500).json({ error: 'Failed to fetch agent campaigns' });
    }
};
