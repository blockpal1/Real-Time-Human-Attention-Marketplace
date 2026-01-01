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

        // SET of all relevant TxHashes for this agent
        const relevantTxHashes = new Set<string>();

        // 1. Fetch from Persistent Index (History)
        const indexedIds = await redisClient.getAgentCampaigns(pubkey);
        indexedIds.forEach(id => relevantTxHashes.add(id));

        // 2. Scan Open Orders (Legacy Support + Lazy Backfill)
        // This ensures existing active campaigns are found and indexed
        const openOrderIds = await redisClient.getOpenOrders();

        for (const txHash of openOrderIds) {
            // Optimization: if we already have it internally, skip fetching (unless we need to check if we should index it?)
            // Actually, we don't know IF it's in the index just by having it in the Set (Set was built from Index).
            // But if it IS in the Set, we don't need to re-check if it belongs to agent (we assume index is correct).
            if (relevantTxHashes.has(txHash)) continue;

            // If not in our index, we must check it
            const order = await redisClient.getOrder(txHash) as any;
            if (order && (order.agent === pubkey || order.creator === pubkey)) {
                // Found a legacy/unindexed active campaign!
                relevantTxHashes.add(txHash);

                // BACKFILL: Add to persistent index
                console.log(`[AgentController] Backfilling index for agent ${pubkey} -> ${txHash}`);
                await redisClient.addAgentCampaign(pubkey, txHash);
            }
        }

        console.log(`[AgentController] Fetching campaigns for agent: ${pubkey}`);
        console.log(`[AgentController] Total unique campaigns found: ${relevantTxHashes.size}`);

        // 3. Fetch details for all unique campaigns
        const campaignPromises = Array.from(relevantTxHashes).map(async (txHash) => {
            const order = await redisClient.getOrder(txHash) as any;
            if (order) {
                return {
                    bidId: txHash,
                    question: order.validation_question,
                    targetResponses: order.quantity,
                    completedResponses: order.filled_count || 0,
                    budgetSpent: (order.filled_count || 0) * order.bid,
                    status: order.filled_count >= order.quantity ? 'completed' : order.status,
                    progress: ((order.filled_count || 0) / order.quantity) * 100,
                    date: order.created_at
                };
            }
            return null;
        });

        const results = await Promise.all(campaignPromises);

        // Filter out nulls (if order data was deleted/expired but ID remained in set)
        const validCampaigns = results.filter(c => c !== null);

        // Sort by date descending
        validCampaigns.sort((a, b) => b.date - a.date);

        res.json(validCampaigns);
    } catch (error) {
        console.error('Get Agent Campaigns Error:', error);
        res.status(500).json({ error: 'Failed to fetch agent campaigns' });
    }
};
