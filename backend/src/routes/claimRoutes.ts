import express from 'express';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SettlementService } from '../services/SettlementService';
import { redisClient } from '../utils/redis';

const router = express.Router();

/**
 * Verify wallet ownership via Ed25519 signature
 * CRIT-1 FIX: Prevent attackers from creating claims for other wallets
 */
function verifyWalletOwnership(publicKey: string, message: string, signature: string): boolean {
    try {
        const pubkeyBytes = bs58.decode(publicKey);
        const messageBytes = new TextEncoder().encode(message);
        const signatureBytes = bs58.decode(signature);
        return nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
    } catch {
        return false;
    }
}

/**
 * POST /withdraw
 * Creates a claim intent (Deferred Locking).
 * Requires wallet signature to prove ownership (CRIT-1 FIX).
 */
router.post('/withdraw', async (req, res) => {
    try {
        const { userPubkey, signature, timestamp } = req.body;

        // Validate required fields
        if (!userPubkey || !signature || !timestamp) {
            return res.status(400).json({
                error: "Missing required fields: userPubkey, signature, timestamp"
            });
        }

        // Verify timestamp is within 5 minutes (prevent replay attacks)
        const now = Date.now();
        if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
            return res.status(400).json({ error: "Expired timestamp" });
        }

        // Verify signature proves wallet ownership
        const message = `Claim request for ${userPubkey} at ${timestamp}`;
        if (!verifyWalletOwnership(userPubkey, message, signature)) {
            return res.status(403).json({ error: "Invalid signature - cannot verify wallet ownership" });
        }

        const result = await SettlementService.createClaimIntent(userPubkey);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json(result);

    } catch (e: any) {
        console.error("[Claim] Create Intent Error:", e);
        res.status(500).json({ error: e.message || "Internal Server Error" });
    }
});

/**
 * POST /submit
 * Executes the claim intent (Deferred Locking).
 * NOW locks funds atomically, broadcasts transaction, handles cleanup.
 */
router.post('/submit', async (req, res) => {
    try {
        const { claimId, signedTransaction } = req.body;

        if (!claimId || !signedTransaction) {
            return res.status(400).json({ error: "Missing claimId or signedTransaction" });
        }

        const result = await SettlementService.executeClaimIntent(claimId, signedTransaction);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json(result);

    } catch (e: any) {
        console.error("[Claim] Execute Intent Error:", e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET /balance
 * Returns the aggregated Unclaimed Earnings and Total Season Points.
 */
router.get('/balance', async (req, res) => {
    try {
        const { userPubkey } = req.query;

        if (!userPubkey || typeof userPubkey !== 'string') {
            return res.status(400).json({ error: "Missing userPubkey" });
        }

        // 1. Calculate Unclaimed USDC from pending logs
        const logs = await redisClient.getPendingSettlements(userPubkey);
        let usdc = 0;

        for (const l of logs) {
            usdc += (l.amount || 0);
        }

        // 2. Fetch Total Season Points from Leaderboard
        const seasonPoints = await redisClient.client.zScore('campaign:season_1', userPubkey);

        res.json({
            usdc_balance: usdc,
            season_points: seasonPoints || 0,
            pending_items: logs.length
        });

    } catch (e: any) {
        console.error("[Claim] Balance Error:", e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
