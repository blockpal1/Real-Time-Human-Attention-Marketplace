import { Router } from 'express';
import { getStatus } from '../controllers/StatusController';
import { createChallenge } from '../controllers/AttestationController';
import { startSession, getActiveSessions } from '../controllers/UserController';
import { createBid, getActiveBids } from '../controllers/AgentController';
import { acceptMatch, rejectMatch, submitQA } from '../controllers/MatchController';

const router = Router();

router.get('/status', getStatus);
router.post('/attestation/challenge', createChallenge);
// Getter Routes
router.get('/agents/bids', getActiveBids);
router.get('/users/sessions', getActiveSessions);

router.post('/users/session/start', startSession);
router.post('/agents/bids', createBid);

// Match Lifecycle Routes
router.post('/match/accept', acceptMatch);
router.post('/match/reject', rejectMatch);
router.post('/match/qa', submitQA);

export default router;
