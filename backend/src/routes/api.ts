import { Router } from 'express';
import { getStatus } from '../controllers/StatusController';
import { createChallenge } from '../controllers/AttestationController';
import { startSession, getActiveSessions } from '../controllers/UserController';
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
    reviewContent
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

router.post('/users/session/start', startSession);

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

// Content moderation
router.get('/admin/content/flagged', authenticateAdmin, getFlaggedContent);
router.post('/admin/content/:bidId/review', authenticateAdmin, reviewContent);

// === x402 Payment Protocol ===
// Agent verification with HTTP 402 payment required
import { x402OrderBook } from '../middleware/x402OrderBook';

router.post('/verify', x402OrderBook, (req, res) => {
    // If we reach here, payment was verified
    const order = req.order!;

    res.json({
        success: true,
        message: `Verification slots reserved: ${order.quantity}x ${order.duration}s @ $${order.bid_per_second}/s`,
        order: {
            duration: order.duration,
            quantity: order.quantity,
            bid_per_second: order.bid_per_second,
            total_escrow: order.total_escrow,
            tx_hash: order.txHash,
            payer: order.payer,
            referrer: order.referrer || null
        }
    });
});

export default router;
