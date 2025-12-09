import { Router } from 'express';
import { getStatus } from '../controllers/StatusController';
import { createChallenge } from '../controllers/AttestationController';
import { startSession, getActiveSessions } from '../controllers/UserController';
import { createBid, getActiveBids } from '../controllers/AgentController';
import { completeMatch, submitValidationResult } from '../controllers/MatchController';

const router = Router();

router.get('/status', getStatus);
router.post('/attestation/challenge', createChallenge);
// Getter Routes
router.get('/agents/bids', getActiveBids);
router.get('/users/sessions', getActiveSessions);

router.post('/users/session/start', startSession);
router.post('/agents/bids', createBid);

// Match Lifecycle Routes
router.post('/matches/:matchId/complete', completeMatch); // Human completes match
router.post('/matches/:matchId/validation', submitValidationResult); // Agent validates answer

export default router;
