import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';

export const completeMatch = async (req: Request, res: Response) => {
    const { matchId } = req.params;
    const { answer, actualDuration, exitedEarly } = req.body;

    try {
        // STUB: Auto-approve all sessions (engagementScore = 1.0)
        // TODO: Replace with real ML scoring in Phase 3
        const engagementScore = 1.0;
        const threshold = 0.7;
        const approved = engagementScore >= threshold;

        // Update match with completion data
        const match = await prisma.match.update({
            where: { id: matchId },
            data: {
                status: approved ? 'completed' : 'rejected',
                validationAnswer: answer || null,
                validationSubmittedAt: answer ? new Date() : null,
                completedAt: new Date(),
                actualDuration: actualDuration || null,
                humanExitedEarly: exitedEarly || false,
                validationResult: approved ? 'approved' : 'rejected',
                endTime: new Date()
            },
            include: {
                bid: true,
                session: {
                    include: { user: true }
                }
            }
        });

        // Calculate earnings
        const pricePerSecond = match.bid.maxPricePerSecond / 1_000_000;
        const duration = actualDuration || match.bid.durationPerUser;
        const earnedAmount = approved ? pricePerSecond * duration : 0;

        console.log(`Match ${matchId} completed. Approved: ${approved}, Earned: $${earnedAmount.toFixed(4)}`);

        // Publish completion event to agent for analytics
        if (redis.isOpen && approved) {
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'MATCH_COMPLETED',
                agentPubkey: match.bid.agentPubkey,
                matchId: match.id,
                bidId: match.bidId,
                payload: {
                    matchId: match.id,
                    humanPubkey: match.session.userPubkey,
                    validationQuestion: match.bid.validationQuestion,
                    validationAnswer: answer,
                    actualDuration,
                    exitedEarly,
                    earned: earnedAmount,
                    timestamp: new Date().toISOString()
                }
            }));
        }

        // Return immediate payment confirmation to frontend
        res.status(200).json({
            success: true,
            matchId: match.id,
            approved,
            earnedAmount: Number(earnedAmount.toFixed(4)),
            engagementScore,
            threshold
        });

    } catch (error) {
        console.error('Complete Match Error:', error);
        res.status(500).json({ error: 'Failed to complete match' });
    }
};

export const submitValidationResult = async (req: Request, res: Response) => {
    const { matchId } = req.params;
    const { result, reason } = req.body;

    if (!['approved', 'rejected'].includes(result)) {
        return res.status(400).json({ error: 'Result must be "approved" or "rejected"' });
    }

    try {
        const match = await prisma.match.update({
            where: { id: matchId },
            data: {
                validationResult: result,
            },
            include: { session: true, bid: true }
        });

        console.log(`Validation result for match ${matchId}: ${result}`);

        // Publish result to human (for transparency)
        if (redis.isOpen) {
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'VALIDATION_RESULT',
                sessionId: match.sessionId,
                payload: {
                    matchId,
                    result,
                    reason,
                    earningsApproved: result === 'approved',
                    amount: (match.bid.maxPricePerSecond / 1_000_000) * (match.actualDuration || match.bid.durationPerUser)
                }
            }));
        }

        res.status(200).json({ success: true, result });

    } catch (error) {
        console.error('Submit Validation Error:', error);
        res.status(500).json({ error: 'Failed to submit validation result' });
    }
};
