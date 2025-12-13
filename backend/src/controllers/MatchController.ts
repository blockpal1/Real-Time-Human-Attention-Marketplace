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
            // Add user to campaign's "seen" set (enforces unique match rule)
            await redis.sAdd(`campaign:${match.bidId}:users`, match.session.userPubkey);

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

/**
 * Human dismisses/declines a match offer
 * Restores bid quantity to order book
 */
export const dismissMatch = async (req: Request, res: Response) => {
    const { matchId } = req.params;

    try {
        // Get the match and verify it's in 'offered' status
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: { bid: true }
        });

        if (!match) {
            return res.status(404).json({ error: 'Match not found' });
        }

        if (match.status !== 'offered') {
            return res.status(400).json({ error: `Cannot dismiss match with status: ${match.status}` });
        }

        // 1. Mark match as dismissed
        await prisma.match.update({
            where: { id: matchId },
            data: { status: 'dismissed' }
        });

        // 2. Restore bid quantity (return to order book)
        const updatedBid = await prisma.bid.update({
            where: { id: match.bidId },
            data: { targetQuantity: { increment: 1 } }
        });

        console.log(`Match ${matchId} dismissed. Bid ${match.bidId} quantity restored to ${updatedBid.targetQuantity}`);

        // 3. Publish BID_UPDATED to restore bid in order book on frontend
        if (redis.isOpen) {
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'BID_UPDATED',
                payload: {
                    bidId: match.bidId,
                    remainingQuantity: updatedBid.targetQuantity
                }
            }));
        }

        res.status(200).json({
            success: true,
            matchId,
            bidRestored: true,
            newBidQuantity: updatedBid.targetQuantity
        });

    } catch (error) {
        console.error('Dismiss Match Error:', error);
        res.status(500).json({ error: 'Failed to dismiss match' });
    }
};
