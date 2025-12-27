import express from 'express';
import { Connection } from '@solana/web3.js';
import { SettlementService } from '../services/SettlementService';
import { redisClient } from '../utils/redis';

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(RPC_URL, 'confirmed');

const router = express.Router();

/**
 * POST /withdraw
 * Prepares a claim transaction for the user.
 * Locks pending settlements and returns a serialized Solana transaction.
 */
router.post('/withdraw', async (req, res) => {
    try {
        const { userPubkey } = req.body;

        // Input validation
        if (!userPubkey) {
            return res.status(400).json({ error: "Missing userPubkey" });
        }

        const result = await SettlementService.prepareClaim(userPubkey);

        if (result.error) {
            return res.status(400).json({ error: result.error });
        }

        res.json(result);

    } catch (e: any) {
        console.error("[Claim] Withdraw Error:", e);
        res.status(500).json({ error: e.message || "Internal Server Error" });
    }
});

/**
 * POST /submit
 * Finalizes the claim after the user broadcasts the transaction.
 * Only deletes the pending logs. Does NOT broadcast itself (frontend does it).
 */
router.post('/submit', async (req, res) => {
    try {
        const { userPubkey, claimId, signedTransaction } = req.body;

        if (!userPubkey || !claimId || !signedTransaction) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // 1. Decode and Broadcast
        const txBuffer = Buffer.from(signedTransaction, 'base64');
        const signature = await connection.sendRawTransaction(txBuffer, {
            skipPreflight: false,
            preflightCommitment: 'confirmed'
        });

        console.log(`[Claim] Broadcasted tx: ${signature}`);

        // 2. Wait for confirmation (Optimistic check)
        // In production, we might want to return immediately and check status async.
        // But for UX, waiting 2-3s is fine to ensure finality.
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');

        if (confirmation.value.err) {
            console.error("[Claim] Transaction failed on-chain:", confirmation.value.err);
            return res.status(400).json({ error: "Transaction failed on-chain" });
        }

        // 3. Finalize (Delete Logs)
        await SettlementService.finalizeClaim(userPubkey, claimId);

        res.json({ success: true, txHash: signature });

    } catch (e: any) {
        console.error("[Claim] Finalize Error:", e);
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
