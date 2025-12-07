import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';

export const getStatus = async (req: Request, res: Response) => {
    try {
        const [userCount, bidCount] = await Promise.all([
            prisma.user.count(),
            prisma.bid.count({ where: { active: true } })
        ]);

        const redisStatus = redis.isOpen ? 'connected' : 'disconnected';

        res.json({
            status: 'ok',
            database: {
                users: userCount,
                active_bids: bidCount
            },
            redis: redisStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Status Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};
