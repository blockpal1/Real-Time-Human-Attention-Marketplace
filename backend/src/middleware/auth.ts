import { Request, Response, NextFunction } from 'express';
import { prisma } from '../utils/prisma';

// Extend Express Request to include agent
declare global {
    namespace Express {
        interface Request {
            agent?: {
                id: string;
                pubkey: string;
                tier: string;
                builderCode: string | null;
            };
        }
    }
}

/**
 * API Key Authentication Middleware
 * Expects: Authorization: Bearer att_<api_key>
 */
export const authenticateAgent = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({
            error: 'Missing or invalid Authorization header',
            hint: 'Use: Authorization: Bearer <your_api_key>'
        });
    }

    const apiKey = authHeader.slice(7); // Remove "Bearer "

    try {
        const agent = await prisma.agent.findUnique({
            where: { apiKey },
            select: {
                id: true,
                pubkey: true,
                tier: true,
                builderCode: true,
                active: true
            }
        });

        if (!agent) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        if (!agent.active) {
            return res.status(403).json({ error: 'Agent account is deactivated' });
        }

        // Attach agent to request
        req.agent = {
            id: agent.id,
            pubkey: agent.pubkey,
            tier: agent.tier,
            builderCode: agent.builderCode
        };

        next();
    } catch (error) {
        console.error('Auth error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
};

/**
 * Optional auth - allows unauthenticated requests but attaches agent if present
 */
export const optionalAuth = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        return next(); // Continue without auth
    }

    const apiKey = authHeader.slice(7);

    try {
        const agent = await prisma.agent.findUnique({
            where: { apiKey },
            select: {
                id: true,
                pubkey: true,
                tier: true,
                builderCode: true,
                active: true
            }
        });

        if (agent?.active) {
            req.agent = {
                id: agent.id,
                pubkey: agent.pubkey,
                tier: agent.tier,
                builderCode: agent.builderCode
            };
        }
    } catch (error) {
        // Continue without auth on error
    }

    next();
};
