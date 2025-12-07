import { Router } from 'express';
import { getStatus } from '../controllers/StatusController';
import { createChallenge } from '../controllers/AttestationController';
import { startSession } from '../controllers/UserController';
import { createBid } from '../controllers/AgentController';
import { acceptMatch, rejectMatch, submitQA } from '../controllers/MatchController';

const router = Router();

router.get('/status', getStatus);
router.post('/attestation/challenge', createChallenge);
router.post('/users/session/start', startSession);
router.post('/agents/bids', createBid);

// Match Lifecycle Routes
router.post('/match/accept', acceptMatch);
router.post('/match/reject', rejectMatch);
router.post('/match/qa', submitQA);

export default router;
