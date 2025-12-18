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

        const [agentCount, bidCount, pendingBuilderCodes, flaggedBids] = await Promise.all([
            prisma.agent.count(),
            prisma.bid.count({ where: { active: true } }),
            prisma.builderCode.count({ where: { tier: 'pending' } }),
            prisma.bid.count({ where: { contentStatus: 'flagged' } })
        ]);

        res.json({
            platform_mode: config?.mode || 'beta',
            stats: {
                total_agents: agentCount,
                active_bids: bidCount,
                pending_builder_codes: pendingBuilderCodes,
                flagged_content: flaggedBids
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
 * Get pending builder code applications
 * GET /v1/admin/builder-codes
 */
export const getBuilderCodes = async (req: Request, res: Response) => {
    try {
        const codes = await prisma.builderCode.findMany({
            orderBy: { createdAt: 'desc' }
        });

        res.json(codes.map(code => ({
            id: code.id,
            code: code.code,
            builder_pubkey: code.builderPubkey,
            tier: code.tier,
            revenue_share_bps: code.revenueShareBps,
            total_volume: code.totalVolume.toString(),
            created_at: code.createdAt,
            approved_at: code.approvedAt
        })));
    } catch (error) {
        console.error('Get builder codes error:', error);
        res.status(500).json({ error: 'Failed to get builder codes' });
    }
};

/**
 * Approve/reject a builder code
 * POST /v1/admin/builder-codes/:codeId/review
 */
export const reviewBuilderCode = async (req: Request, res: Response) => {
    const { codeId } = req.params;
    const { action, tier } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
    }

    try {
        if (action === 'approve') {
            const updatedCode = await prisma.builderCode.update({
                where: { id: codeId },
                data: {
                    tier: tier || 'genesis',
                    approvedAt: new Date()
                }
            });

            console.log(`[Admin] Approved builder code: ${updatedCode.code} as ${updatedCode.tier}`);

            res.json({
                success: true,
                code: updatedCode.code,
                tier: updatedCode.tier
            });
        } else {
            await prisma.builderCode.delete({
                where: { id: codeId }
            });

            console.log(`[Admin] Rejected builder code: ${codeId}`);

            res.json({ success: true, action: 'rejected' });
        }
    } catch (error) {
        console.error('Review builder code error:', error);
        res.status(500).json({ error: 'Failed to review builder code' });
    }
};

/**
 * Get flagged content for review
 * GET /v1/admin/content/flagged
 */
export const getFlaggedContent = async (req: Request, res: Response) => {
    try {
        const flaggedBids = await prisma.bid.findMany({
            where: { contentStatus: 'flagged' },
            include: {
                agent: {
                    select: { pubkey: true, name: true, tier: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json(flaggedBids.map(bid => ({
            bid_id: bid.id,
            content_url: bid.contentUrl,
            target_url: bid.targetUrl,
            validation_question: bid.validationQuestion,
            content_status: bid.contentStatus,
            agent: bid.agent ? {
                pubkey: bid.agent.pubkey,
                name: bid.agent.name,
                tier: bid.agent.tier
            } : null,
            created_at: bid.createdAt
        })));
    } catch (error) {
        console.error('Get flagged content error:', error);
        res.status(500).json({ error: 'Failed to get flagged content' });
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

/**
 * Review flagged content
 * POST /v1/admin/content/:bidId/review
 */
export const reviewContent = async (req: Request, res: Response) => {
    const { bidId } = req.params;
    const { action } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
    }

    try {
        const updatedBid = await prisma.bid.update({
            where: { id: bidId },
            data: {
                contentStatus: action === 'approve' ? 'approved' : 'rejected',
                active: action === 'approve' // Deactivate rejected bids
            }
        });

        console.log(`[Admin] Content ${action}: bid ${bidId}`);

        res.json({
            success: true,
            bid_id: updatedBid.id,
            content_status: updatedBid.contentStatus
        });
    } catch (error) {
        console.error('Review content error:', error);
        res.status(500).json({ error: 'Failed to review content' });
    }
};

/**
 * Create a new builder code (admin-initiated)
 * POST /v1/admin/builder-codes
 */
export const createBuilderCode = async (req: Request, res: Response) => {
    const { code, builder_pubkey, tier, revenue_share_bps } = req.body;

    if (!code || !builder_pubkey) {
        return res.status(400).json({ error: 'code and builder_pubkey required' });
    }

    try {
        const builderCode = await prisma.builderCode.create({
            data: {
                code,
                builderPubkey: builder_pubkey,
                tier: tier || 'genesis',
                revenueShareBps: revenue_share_bps || 5000,
                approvedAt: tier !== 'pending' ? new Date() : null
            }
        });

        console.log(`[Admin] Created builder code: ${code} for ${builder_pubkey}`);

        res.status(201).json({
            id: builderCode.id,
            code: builderCode.code,
            builder_pubkey: builderCode.builderPubkey,
            tier: builderCode.tier,
            revenue_share_bps: builderCode.revenueShareBps
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Builder code already exists' });
        }
        console.error('Create builder code error:', error);
        res.status(500).json({ error: 'Failed to create builder code' });
    }
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
