import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { orderStore } from '../middleware/x402OrderBook';

/**
 * Get platform status and configuration
 * GET /v1/admin/status
 */
export const getAdminStatus = async (req: Request, res: Response) => {
    try {
        const config = await prisma.platformConfig.findUnique({
            where: { id: 'singleton' }
        });

        // Count x402 orders
        let x402OrderCount = 0;
        let x402FlaggedCount = 0;
        orderStore.forEach((order) => {
            if (order.status === 'open') x402OrderCount++;
            if (order.status === 'rejected_tos') x402FlaggedCount++;
        });

        res.json({
            platform_mode: config?.mode || 'beta',
            stats: {
                active_x402_orders: x402OrderCount,
                flagged_content: x402FlaggedCount
            },
            updated_at: config?.updatedAt
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
    const { mode } = req.body;

    if (!['beta', 'hybrid', 'live'].includes(mode)) {
        return res.status(400).json({
            error: 'Invalid mode',
            valid_modes: ['beta', 'hybrid', 'live']
        });
    }

    try {
        const config = await prisma.platformConfig.update({
            where: { id: 'singleton' },
            data: { mode }
        });

        console.log(`[Admin] Platform mode changed to: ${mode}`);

        res.json({
            success: true,
            mode: config.mode,
            message: getModeDescription(mode)
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

        orderStore.forEach((order, txHash) => {
            if (order.status === 'rejected_tos') {
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
        });

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

    const order = orderStore.get(tx_hash);

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
    order.status = action === 'approve' ? 'open' : 'rejected_tos';
    orderStore.set(tx_hash, order);

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
