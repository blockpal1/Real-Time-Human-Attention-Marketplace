import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';

/**
 * Get earnings summary for a user
 */
export const getUserEarnings = async (req: Request, res: Response) => {
    const { pubkey } = req.params;

    try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        // Get all completed matches for this user
        const allMatches = await prisma.match.findMany({
            where: {
                session: {
                    userPubkey: pubkey
                },
                status: 'completed',
                completedAt: { not: null }
            },
            include: {
                bid: true
            }
        });

        // Calculate earnings (price per second * actual duration)
        const calculateEarnings = (match: any) => {
            const pricePerSecond = match.bid.maxPricePerSecond / 1_000_000; // Convert micros to USDC
            const duration = match.actualDuration || match.bid.durationPerUser;
            return pricePerSecond * duration;
        };

        // Filter and sum by time period
        const todayMatches = allMatches.filter(m => m.completedAt! >= todayStart);
        const weekMatches = allMatches.filter(m => m.completedAt! >= weekStart);

        const today = todayMatches.reduce((sum, m) => sum + calculateEarnings(m), 0);
        const week = weekMatches.reduce((sum, m) => sum + calculateEarnings(m), 0);
        const allTime = allMatches.reduce((sum, m) => sum + calculateEarnings(m), 0);

        res.json({
            today: Number(today.toFixed(4)),
            week: Number(week.toFixed(4)),
            allTime: Number(allTime.toFixed(4)),
            sessionsToday: todayMatches.length,
            sessionsWeek: weekMatches.length,
            sessionsAllTime: allMatches.length
        });

    } catch (error) {
        console.error('Get User Earnings Error:', error);
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
};

/**
 * Get session history for a user
 */
export const getSessionHistory = async (req: Request, res: Response) => {
    const { pubkey } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    try {
        const matches = await prisma.match.findMany({
            where: {
                session: {
                    userPubkey: pubkey
                },
                status: 'completed',
                completedAt: { not: null }
            },
            include: {
                bid: true
            },
            orderBy: {
                completedAt: 'desc'
            },
            take: limit
        });

        // Format response
        const history = matches.map(match => {
            const pricePerSecond = match.bid.maxPricePerSecond / 1_000_000;
            const duration = match.actualDuration || match.bid.durationPerUser;
            const earned = pricePerSecond * duration;

            return {
                matchId: match.id,
                question: match.bid.validationQuestion || 'N/A',
                answer: match.validationAnswer || 'N/A',
                earned: Number(earned.toFixed(4)),
                duration: duration,
                completedAt: match.completedAt,
                topic: 'Campaign' // Generic topic for now
            };
        });

        res.json(history);

    } catch (error) {
        console.error('Get Session History Error:', error);
        res.status(500).json({ error: 'Failed to fetch session history' });
    }
};
