import { Router } from 'express';
import { redisClient } from '../utils/redis';

const router = Router();

// Get user's Signal Quality score
router.get('/users/:wallet/signal-quality', async (req, res) => {
    try {
        const { wallet } = req.params;
        const key = `user:${wallet}`;

        const data = await redisClient.client.hGetAll(key);

        if (!data || Object.keys(data).length === 0 || !data.quality) {
            // User hasn't completed any tasks yet
            return res.json({
                quality: 50, // Default starting score
                status: 'new'
            });
        }

        const quality = parseInt(data.quality);
        let status: 'high' | 'medium' | 'low' | 'banned';

        if (quality < 20) {
            status = 'banned';
        } else if (quality < 40) {
            status = 'low';
        } else if (quality < 60) {
            status = 'medium';
        } else {
            status = 'high';
        }

        res.json({
            quality,
            status
        });
    } catch (error) {
        console.error('[Signal Quality] Error fetching score:', error);
        res.status(500).json({ error: 'Failed to fetch signal quality' });
    }
});

export default router;
