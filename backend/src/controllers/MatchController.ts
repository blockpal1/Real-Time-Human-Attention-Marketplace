import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';

export const completeMatch = async (req: Request, res: Response) => {
    const { matchId } = req.params;
    const { answer, actualDuration, exitedEarly } = req.body;

    try {
        // Update match with completion data
        const match = await prisma.match.update({
            where: { id: matchId },
            data: {
                status: 'completed',
                validationAnswer: answer || null,
                validationSubmittedAt: answer ? new Date() : null,
                completedAt: new Date(),
                actualDuration: actualDuration || null,
                humanExitedEarly: exitedEarly || false,
                validationResult: answer ? 'pending' : null, // Awaiting agent review
                endTime: new Date()
            },
            include: {
                bid: {
                    include: { agent: true }
                },
                session: {
                    include: { user: true }
                }
            }
        });

        console.log(`Match ${matchId} completed. Answer: "${answer || 'N/A'}"`);

        // Publish completion event to agent via WebSocket/Redis
        if (redis.isOpen) {
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
                    price: match.bid.maxPricePerSecond / 1_000_000,
                    timestamp: new Date().toISOString()
                }
            }));
            console.log(`MATCH_COMPLETED event published for agent ${match.bid.agentPubkey}`);
        }

        res.status(200).json({ success: true, matchId: match.id });

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
