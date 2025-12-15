import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Validation schemas
const registerAgentSchema = z.object({
    pubkey: z.string().min(32).max(64),
    name: z.string().max(100).optional(),
    webhook_url: z.string().url().optional(),
    builder_code: z.string().max(50).optional()
});

const MIN_ESCROW_MICROS = 1_000_000; // $1 USDC minimum

/**
 * Register a new agent and receive an API key
 * POST /v1/agents/register
 */
export const registerAgent = async (req: Request, res: Response) => {
    const result = registerAgentSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
    }

    const { pubkey, name, webhook_url, builder_code } = result.data;

    try {
        // Check if agent already exists
        const existing = await prisma.agent.findUnique({
            where: { pubkey }
        });

        if (existing) {
            return res.status(409).json({
                error: 'Agent already registered',
                hint: 'Use your existing API key or contact support to recover it'
            });
        }

        // Validate builder code if provided
        let validatedBuilderCode = null;
        if (builder_code) {
            const builderCodeRecord = await prisma.builderCode.findUnique({
                where: { code: builder_code }
            });

            if (builderCodeRecord && builderCodeRecord.tier !== 'pending') {
                validatedBuilderCode = builder_code;
            }
        }

        // Generate API key
        const apiKey = `att_${randomUUID().replace(/-/g, '')}`;

        // Create agent
        const agent = await prisma.agent.create({
            data: {
                pubkey,
                apiKey,
                name: name || null,
                webhookUrl: webhook_url || null,
                builderCode: validatedBuilderCode,
                tier: 'anonymous', // Start at anonymous tier
                escrowBalance: 0
            }
        });

        // Get platform mode
        const config = await prisma.platformConfig.findUnique({
            where: { id: 'singleton' }
        });
        const platformMode = config?.mode || 'beta';

        res.status(201).json({
            api_key: apiKey,
            agent_id: agent.id,
            pubkey: agent.pubkey,
            tier: agent.tier,
            mode: platformMode,
            limits: getTierLimits(agent.tier),
            message: platformMode === 'beta'
                ? 'Sandbox mode: no escrow required, users receive points'
                : 'Live mode: escrow deposit required before bidding'
        });

    } catch (error) {
        console.error('Agent registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
};

/**
 * Get agent profile and status
 * GET /v1/agents/me
 * Requires: authenticateAgent middleware
 */
export const getAgentProfile = async (req: Request, res: Response) => {
    if (!req.agent) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const agent = await prisma.agent.findUnique({
            where: { id: req.agent.id },
            include: {
                bids: {
                    where: { active: true },
                    select: { id: true }
                }
            }
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const config = await prisma.platformConfig.findUnique({
            where: { id: 'singleton' }
        });

        res.json({
            id: agent.id,
            pubkey: agent.pubkey,
            name: agent.name,
            tier: agent.tier,
            builder_code: agent.builderCode,
            webhook_url: agent.webhookUrl,
            escrow_balance: agent.escrowBalance,
            escrow_balance_usdc: agent.escrowBalance / 1_000_000,
            active_bids: agent.bids.length,
            limits: getTierLimits(agent.tier),
            platform_mode: config?.mode || 'beta',
            created_at: agent.createdAt
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

/**
 * Get agent's escrow balance
 * GET /v1/agents/balance
 * Requires: authenticateAgent middleware
 */
export const getAgentBalance = async (req: Request, res: Response) => {
    if (!req.agent) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const agent = await prisma.agent.findUnique({
            where: { id: req.agent.id },
            select: { escrowBalance: true, tier: true }
        });

        if (!agent) {
            return res.status(404).json({ error: 'Agent not found' });
        }

        const config = await prisma.platformConfig.findUnique({
            where: { id: 'singleton' }
        });
        const isSandbox = config?.mode === 'beta';

        res.json({
            mode: isSandbox ? 'sandbox' : 'live',
            balance_micros: isSandbox ? 100_000_000 : agent.escrowBalance, // $100 virtual in sandbox
            balance_usdc: isSandbox ? 100.0 : agent.escrowBalance / 1_000_000,
            minimum_deposit_micros: MIN_ESCROW_MICROS,
            minimum_deposit_usdc: MIN_ESCROW_MICROS / 1_000_000,
            note: isSandbox ? 'Sandbox mode - no real funds required' : undefined
        });

    } catch (error) {
        console.error('Get balance error:', error);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
};

/**
 * Update agent webhook URL
 * PATCH /v1/agents/webhook
 * Requires: authenticateAgent middleware
 */
export const updateWebhook = async (req: Request, res: Response) => {
    if (!req.agent) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const schema = z.object({
        webhook_url: z.string().url().nullable()
    });

    const result = schema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: result.error.flatten() });
    }

    try {
        await prisma.agent.update({
            where: { id: req.agent.id },
            data: { webhookUrl: result.data.webhook_url }
        });

        res.json({ success: true, webhook_url: result.data.webhook_url });

    } catch (error) {
        console.error('Update webhook error:', error);
        res.status(500).json({ error: 'Failed to update webhook' });
    }
};

// Helper: Get tier limits
function getTierLimits(tier: string) {
    switch (tier) {
        case 'anonymous':
            return { max_bids_per_day: 10, max_escrow_usdc: 500 };
        case 'verified':
            return { max_bids_per_day: 1000, max_escrow_usdc: 10000 };
        case 'enterprise':
            return { max_bids_per_day: null, max_escrow_usdc: null }; // Unlimited
        default:
            return { max_bids_per_day: 10, max_escrow_usdc: 500 };
    }
}
