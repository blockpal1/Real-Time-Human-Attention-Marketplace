import { Request, Response } from 'express';
import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import { webhookService } from '../services/WebhookService';

export const completeMatch = async (req: Request, res: Response) => {
    const { matchId } = req.params;
    const { answer, actualDuration, exitedEarly, bidId } = req.body;

    try {
        // Handle in-memory match completion (these aren't stored in Prisma)
        // Covers both: x402_match_ (from MatchingEngine) and match_ (from acceptHighestBid)
        if (matchId.startsWith('x402_match_') || matchId.startsWith('match_')) {
            console.log(`[x402] Match ${matchId} completed. Answer: ${answer || 'none'}`);

            // Import orderStore to update x402 order status
            const { orderStore } = await import('../middleware/x402OrderBook');

            // Find and update the order if bidId provided
            if (bidId && orderStore.has(bidId)) {
                const order = orderStore.get(bidId)!;

                // Only mark order as 'completed' when quantity reaches 0
                // Otherwise keep it 'open' for more potential matches
                if (order.quantity === 0) {
                    order.status = 'completed';
                }

                // Store this match's result (supports multi-quantity orders)
                if (!Array.isArray(order.result)) {
                    order.result = [];
                }
                order.result.push({ answer, actualDuration, exitedEarly, completedAt: Date.now() });

                orderStore.set(bidId, order);
                console.log(`[x402] Order ${bidId.slice(0, 16)}... match completed. Status: ${order.status}, Qty: ${order.quantity}`);
            }

            // Publish completion event
            if (redis.isOpen) {
                await redis.publish('marketplace_events', JSON.stringify({
                    type: 'MATCH_COMPLETED',
                    payload: {
                        matchId,
                        bidId,
                        validationAnswer: answer,
                        actualDuration,
                        exitedEarly,
                        approved: true,
                        timestamp: new Date().toISOString()
                    }
                }));
            }

            return res.status(200).json({
                success: true,
                matchId,
                approved: true,
                earnedAmount: 0, // x402 payments are handled differently
                engagementScore: 1.0,
                threshold: 0.7
            });
        }

        // Prisma match completion (traditional flow)
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

        // Send webhook to agent
        if (match.bid.agentPubkey) {
            const earnedMicros = Math.round(earnedAmount * 1_000_000);
            await webhookService.notifyMatchCompleted(
                match.bid.agentPubkey,
                match.id,
                match.bidId,
                duration,
                answer || null,
                earnedMicros
            );
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
 * Restores bid quantity to order book and cancels user session
 */
export const dismissMatch = async (req: Request, res: Response) => {
    const { matchId } = req.params;
    const { bidId, pubkey } = req.body; // bidId = tx_hash for x402, pubkey for session cancellation

    try {
        // Import orderStore to restore x402 order quantity
        const { orderStore } = await import('../middleware/x402OrderBook');

        // 1. Restore order quantity in x402 orderStore (if bidId provided)
        if (bidId && orderStore.has(bidId)) {
            const order = orderStore.get(bidId)!;
            order.quantity += 1;
            order.status = 'open';
            orderStore.set(bidId, order);
            console.log(`[Dismiss] Restored ${bidId.slice(0, 16)}... quantity to ${order.quantity}`);

            // Broadcast BID_UPDATED to restore quantity in frontend order book
            // (BID_UPDATED is simpler and the bid already exists in frontend state)
            if (redis.isOpen) {
                await redis.publish('marketplace_events', JSON.stringify({
                    type: 'BID_UPDATED',
                    payload: {
                        bidId,
                        remainingQuantity: order.quantity
                    }
                }));
                console.log(`[Dismiss] Broadcasted BID_UPDATED to restore ${bidId.slice(0, 16)}... qty=${order.quantity}`);
            }
        }

        // 2. Cancel user's session (if pubkey provided)
        if (pubkey) {
            const session = await prisma.session.findFirst({
                where: { userPubkey: pubkey, active: true }
            });

            if (session) {
                await prisma.session.update({
                    where: { id: session.id },
                    data: { active: false, endedAt: new Date() }
                });
                console.log(`[Dismiss] Cancelled session for ${pubkey.slice(0, 12)}...`);

                // Broadcast ASK_CANCELLED
                if (redis.isOpen) {
                    await redis.publish('marketplace_events', JSON.stringify({
                        type: 'ASK_CANCELLED',
                        payload: { id: session.id }
                    }));
                }
            }
        }

        res.status(200).json({
            success: true,
            matchId,
            bidRestored: !!bidId,
            sessionCancelled: !!pubkey
        });

    } catch (error) {
        console.error('Dismiss Match Error:', error);
        res.status(500).json({ error: 'Failed to dismiss match' });
    }
};
