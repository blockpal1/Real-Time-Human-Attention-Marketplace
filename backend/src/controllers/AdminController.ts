import { Request, Response } from 'express';
import { redisClient } from '../utils/redis';
import { configService } from '../services/ConfigService';

/**
 * Get platform status and configuration
 * GET /v1/admin/status
 */
export const getAdminStatus = async (req: Request, res: Response) => {
    try {
        const config = await configService.getConfig();

        // Count x402 orders from Redis sets
        const x402OrderCount = (await redisClient.getOpenOrders()).length;
        const x402FlaggedCount = (await redisClient.getRejectedOrders()).length;

        res.json({
            platform_mode: config.mode,
            fee_total: config.fee_total,
            fee_protocol: config.fee_protocol,
            fee_builder: config.fee_builder,
            min_version: config.min_version,
            stats: {
                active_x402_orders: x402OrderCount,
                flagged_content: x402FlaggedCount
            }
        });
    } catch (error) {
        console.error('Admin status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
};

/**
 * Update platform mode
 * POST /v1/admin/mode
 */
export const updatePlatformMode = async (req: Request, res: Response) => {
    const { mode, fee_rate } = req.body;

    if (mode && !['beta', 'hybrid', 'live'].includes(mode)) {
        return res.status(400).json({
            error: 'Invalid mode',
            valid_modes: ['beta', 'hybrid', 'live']
        });
    }

    try {
        // Update config in Redis
        const updates: any = {};
        if (mode) updates.mode = mode;
        if (fee_rate !== undefined) updates.fee_rate = fee_rate;

        await configService.setConfig(updates);
        const newConfig = await configService.getConfig();

        console.log(`[Admin] Platform config updated:`, updates);

        res.json({
            success: true,
            mode: newConfig.mode,
            fee_total: newConfig.fee_total,
            message: getModeDescription(newConfig.mode)
        });
    } catch (error) {
        console.error('Update mode error:', error);
        res.status(500).json({ error: 'Failed to update mode' });
    }
};

/**
 * Get x402 orders with rejected_tos status
 * GET /v1/admin/content/x402-flagged
 */
export const getX402FlaggedContent = async (req: Request, res: Response) => {
    try {
        const flaggedOrders: Array<{
            tx_hash: string;
            content_url: string | null;
            validation_question: string;
            status: string;
            bid_per_second: number;
            duration: number;
            quantity: number;
            created_at: number;
        }> = [];

        const rejectedIds = await redisClient.getRejectedOrders();

        // Fetch details for all rejected orders
        for (const txHash of rejectedIds) {
            const order = await redisClient.getOrder(txHash) as any;
            if (order && order.status === 'rejected_tos') {
                flaggedOrders.push({
                    tx_hash: txHash,
                    content_url: order.content_url,
                    validation_question: order.validation_question,
                    status: order.status,
                    bid_per_second: order.bid,
                    duration: order.duration,
                    quantity: order.quantity,
                    created_at: order.created_at
                });
            }
        }

        // Sort by created_at (newest first)
        flaggedOrders.sort((a, b) => b.created_at - a.created_at);

        res.json({
            count: flaggedOrders.length,
            source: 'x402',
            orders: flaggedOrders
        });
    } catch (error) {
        console.error('Get x402 flagged content error:', error);
        res.status(500).json({ error: 'Failed to get x402 flagged content' });
    }
};

/**
 * Review x402 flagged content
 * POST /v1/admin/content/x402/:tx_hash/review
 */
export const reviewX402Content = async (req: Request, res: Response) => {
    const { tx_hash } = req.params;
    const { action } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
    }

    const order = await redisClient.getOrder(tx_hash) as any;

    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'rejected_tos') {
        return res.status(400).json({
            error: 'Order is not in rejected_tos status',
            current_status: order.status
        });
    }

    // Update order status
    const newStatus = action === 'approve' ? 'open' : 'rejected_tos';
    order.status = newStatus;

    // Save updated order and update set membership via updateOrderStatus helper
    await redisClient.setOrder(tx_hash, order);
    await redisClient.updateOrderStatus(tx_hash, newStatus);

    console.log(`[Admin] x402 content ${action}: ${tx_hash}`);

    res.json({
        success: true,
        tx_hash,
        new_status: order.status,
        action
    });
};

// Helper
function getModeDescription(mode: string): string {
    switch (mode) {
        case 'beta':
            return 'Sandbox mode: Points for users, no escrow required';
        case 'hybrid':
            return 'Hybrid mode: Both points (beta) and real payments active';
        case 'live':
            return 'Live mode: Real USDC escrow and payments only';
        default:
            return '';
    }
}
