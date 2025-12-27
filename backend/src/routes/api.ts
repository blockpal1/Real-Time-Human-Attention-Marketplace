import { Router } from 'express';
import { getStatus } from '../controllers/StatusController';
import { createChallenge } from '../controllers/AttestationController';
import { startSession, getActiveSessions, cancelSession, updateSession, acceptHighestBid } from '../controllers/UserController';
import { getActiveBids } from '../controllers/AgentController';
import { completeMatch, submitValidationResult, dismissMatch } from '../controllers/MatchController';
import { authenticateAdmin } from '../middleware/adminAuth';
import {
    getAdminStatus,
    updatePlatformMode,
    getX402FlaggedContent,
    reviewX402Content,
    createBuilderCode,
    listBuilderCodes
} from '../controllers/AdminController';
import debugRoutes from './debugRoutes';
import signalQualityRoutes from './signalQualityRoutes';

const router = Router();

router.use('/debug', debugRoutes);
router.use(signalQualityRoutes);

router.get('/status', getStatus);
router.post('/attestation/challenge', createChallenge);

// Getter Routes
router.get('/agents/bids', getActiveBids);
router.get('/users/sessions', getActiveSessions);

// Human Session (Ask) Management
router.post('/users/session/start', startSession);
router.delete('/users/session/cancel', cancelSession);
router.patch('/users/session/update', updateSession);
router.post('/users/session/accept-highest', acceptHighestBid);

// Legacy POST /agents/bids removed - use POST /verify with x402 payment instead

// Match Lifecycle Routes
router.post('/matches/:matchId/complete', completeMatch);
router.post('/matches/:matchId/dismiss', dismissMatch);
router.post('/matches/:matchId/validation', submitValidationResult);

// === Admin API ===
// Protected by X-Admin-Secret header
router.get('/admin/status', authenticateAdmin, getAdminStatus);
router.post('/admin/mode', authenticateAdmin, updatePlatformMode);

// Content moderation (x402 orders only)
router.get('/admin/content/x402-flagged', authenticateAdmin, getX402FlaggedContent);
router.post('/admin/content/x402/:tx_hash/review', authenticateAdmin, reviewX402Content);

// Genesis Builder Codes
router.get('/admin/builders', authenticateAdmin, listBuilderCodes);
router.post('/admin/builders/create', authenticateAdmin, createBuilderCode);

// === x402 Payment Protocol ===
// Agent verification with HTTP 402 payment required
// === x402 Payment Protocol ===
// Agent verification with HTTP 402 payment required
import { x402OrderBook } from '../middleware/x402OrderBook';
import { redisClient } from '../utils/redis';

router.post('/verify', x402OrderBook, (req, res) => {
    // If we reach here, payment was verified
    const order = req.order!;

    res.json({
        success: true,
        message: `Verification slots reserved: ${order.quantity}x ${order.duration}s @ $${order.bid}/s`,
        order: {
            duration: order.duration,
            quantity: order.quantity,
            bid_per_second: order.bid,
            total_escrow: order.total_escrow,
            tx_hash: order.tx_hash,
            referrer: order.referrer || null
        },
        // Phase 2: Secure keys for results access and webhooks
        read_key: order.read_key,
        webhook_secret: order.webhook_secret
    });
});

// Order status polling endpoint
router.get('/orders/:tx_hash', async (req, res) => {
    const { tx_hash } = req.params;

    const order = await redisClient.getOrder(tx_hash) as any;

    if (!order) {
        return res.status(404).json({
            error: 'order_not_found',
            message: 'No order found with this transaction hash'
        });
    }

    res.json({
        status: order.status,
        created_at: order.created_at,
        duration: order.duration,
        quantity: order.quantity,
        total_escrow: order.total_escrow,
        referrer: order.referrer,
        result: order.result
    });
});

// === User State (Redis-based) ===

// Get user balance
router.get('/users/:wallet/balance', async (req, res) => {
    const { wallet } = req.params;
    try {
        const balance = await redisClient.getBalance(wallet);
        res.json({ wallet, balance });
    } catch (error) {
        console.error('Get Balance Error:', error);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

// Get user lifetime earnings (sum of all completed match payouts)
router.get('/users/:wallet/earnings', async (req, res) => {
    const { wallet } = req.params;
    try {
        // Get history and sum up all earnings
        const history = await redisClient.getHistory(wallet, 1000);
        const allTime = history.reduce((sum: number, entry: any) => {
            // History entries have grossPay (or workerPay for net)
            return sum + (entry.grossPay || entry.workerPay || entry.amount || 0);
        }, 0);
        res.json({ wallet, allTime });
    } catch (error) {
        console.error('Get Earnings Error:', error);
        res.status(500).json({ error: 'Failed to fetch earnings' });
    }
});

// Get user Season Zero points
router.get('/users/:wallet/season-points', async (req, res) => {
    const { wallet } = req.params;
    try {
        const points = await redisClient.client.hGet(`user:${wallet}`, 'points');
        res.json({ wallet, points: points ? parseInt(points) : 0 });
    } catch (error) {
        console.error('Get Season Points Error:', error);
        res.status(500).json({ error: 'Failed to fetch season points' });
    }
});

// Get user match history
router.get('/users/:wallet/history', async (req, res) => {
    const { wallet } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    try {
        const history = await redisClient.getHistory(wallet, limit);
        res.json({ wallet, count: history.length, history });
    } catch (error) {
        console.error('Get History Error:', error);
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
    const season = (req.query.season as string) || 'season_1';
    const limit = parseInt(req.query.limit as string) || 100;
    try {
        const leaderboard = await redisClient.getLeaderboard(season, limit);
        res.json({ season, count: leaderboard.length, leaderboard });
    } catch (error) {
        console.error('Get Leaderboard Error:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

export default router;
