import { Request, Response } from 'express';
import { redis, redisClient } from '../utils/redis';
import { configService } from '../services/ConfigService';

export const getStatus = async (req: Request, res: Response) => {
    try {
        // Get counts from Redis
        const openOrders = await redisClient.getOpenOrders();
        const availableSessions = await redisClient.client.zCard('market:available_users');
        const config = await configService.getConfig();

        const redisStatus = redis.isOpen ? 'connected' : 'disconnected';

        res.json({
            status: 'ok',
            platform: {
                mode: config.mode,
                fee_rate: config.fee_rate
            },
            stats: {
                active_orders: openOrders.length,
                available_sessions: availableSessions
            },
            redis: redisStatus,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Status Error:', error);
        res.status(500).json({ status: 'error', message: 'Internal Server Error' });
    }
};
