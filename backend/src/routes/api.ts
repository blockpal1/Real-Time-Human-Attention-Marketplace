import { Router } from 'express';
import { getStatus } from '../controllers/StatusController';
import { createChallenge } from '../controllers/AttestationController';
import { startSession, getActiveSessions, cancelSession, updateSession, acceptHighestBid } from '../controllers/UserController';
import { createBid, getActiveBids } from '../controllers/AgentController';
import { completeMatch, submitValidationResult, dismissMatch } from '../controllers/MatchController';
import { getUserEarnings, getSessionHistory } from '../controllers/UserEarningsController';
import { getCampaignResponses, getAgentCampaigns } from '../controllers/AgentCampaignController';
import { registerAgent, getAgentProfile, getAgentBalance, updateWebhook } from '../controllers/AgentRegistrationController';
import { authenticateAgent, optionalAuth } from '../middleware/auth';
import { authenticateAdmin } from '../middleware/adminAuth';
import {
    getAdminStatus,
    updatePlatformMode,
    getBuilderCodes,
    reviewBuilderCode,
    createBuilderCode,
    getFlaggedContent,
    reviewContent,
    getX402FlaggedContent,
    reviewX402Content
} from '../controllers/AdminController';

const router = Router();

router.get('/status', getStatus);
router.post('/attestation/challenge', createChallenge);

// Getter Routes
router.get('/agents/bids', getActiveBids);
router.get('/users/sessions', getActiveSessions);

// User Earnings
router.get('/users/:pubkey/earnings', getUserEarnings);
router.get('/users/:pubkey/sessions', getSessionHistory);

// Agent Campaign Analytics
router.get('/agents/:pubkey/campaigns', getAgentCampaigns);
router.get('/campaigns/:bidId/responses', getCampaignResponses);

// Human Session (Ask) Management
router.post('/users/session/start', startSession);
router.delete('/users/session/cancel', cancelSession);
router.patch('/users/session/update', updateSession);
router.post('/users/session/accept-highest', acceptHighestBid);

// === Agent API (v1) ===

// Public: Register new agent
router.post('/agents/register', registerAgent);

// Authenticated: Agent profile & balance
router.get('/agents/me', authenticateAgent, getAgentProfile);
router.get('/agents/balance', authenticateAgent, getAgentBalance);
router.patch('/agents/webhook', authenticateAgent, updateWebhook);

// Create bid - supports both auth (API) and no-auth (UI)
router.post('/agents/bids', optionalAuth, createBid);

// Match Lifecycle Routes
router.post('/matches/:matchId/complete', completeMatch);
router.post('/matches/:matchId/dismiss', dismissMatch);
router.post('/matches/:matchId/validation', submitValidationResult);

// === Admin API ===
// Protected by X-Admin-Secret header

router.get('/admin/status', authenticateAdmin, getAdminStatus);
router.post('/admin/mode', authenticateAdmin, updatePlatformMode);

// Builder code management
router.get('/admin/builder-codes', authenticateAdmin, getBuilderCodes);
router.post('/admin/builder-codes', authenticateAdmin, createBuilderCode);
router.post('/admin/builder-codes/:codeId/review', authenticateAdmin, reviewBuilderCode);

// Content moderation (Legacy Prisma bids)
router.get('/admin/content/flagged', authenticateAdmin, getFlaggedContent);
router.post('/admin/content/:bidId/review', authenticateAdmin, reviewContent);

// Content moderation (x402 orders)
router.get('/admin/content/x402-flagged', authenticateAdmin, getX402FlaggedContent);
router.post('/admin/content/x402/:tx_hash/review', authenticateAdmin, reviewX402Content);

// === x402 Payment Protocol ===
// Agent verification with HTTP 402 payment required
import { x402OrderBook, orderStore } from '../middleware/x402OrderBook';

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
        }
    });
});

// Order status polling endpoint
router.get('/orders/:tx_hash', (req, res) => {
    const { tx_hash } = req.params;

    const order = orderStore.get(tx_hash);

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

export default router;
