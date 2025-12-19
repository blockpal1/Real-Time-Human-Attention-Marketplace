import { Request, Response } from 'express';
import { redis, redisClient } from '../utils/redis';

export const completeMatch = async (req: Request, res: Response) => {
    const { matchId } = req.params;
    const { answer, actualDuration, exitedEarly, bidId } = req.body;

    try {
        // Handle in-memory match completion (these aren't stored in Prisma)
        // Covers both: x402_match_ (from MatchingEngine) and match_ (from acceptHighestBid)
        if (matchId.startsWith('x402_match_') || matchId.startsWith('match_')) {
            console.log(`[x402] Match ${matchId} completed. Answer: ${answer || 'none'}`);

            // Import redisClient to update x402 order status
            const { redisClient } = await import('../utils/redis');

            // 2. If this was an x402 match (has bidId), update order status
            if (bidId) {
                const order = await redisClient.getOrder(bidId) as any;
                if (order) {
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

                    await redisClient.setOrder(bidId, order);

                    // Update status tracking if changed
                    if (order.status !== 'open') {
                        await redisClient.updateOrderStatus(bidId, order.status);
                    }

                    console.log(`[x402] Order ${bidId.slice(0, 16)}... match completed. Status: ${order.status}, Qty: ${order.quantity}`);
                }
            }

            // 3. Calculate earnings and credit user balance
            let earnedAmount = 0;
            let userWallet: string | null = null;

            if (bidId) {
                const order = await redisClient.getOrder(bidId) as any;
                if (order) {
                    // Calculate earnings: bid price (per second) * actual duration
                    const duration = actualDuration || order.duration || 30;
                    earnedAmount = order.bid * duration;

                    // Get user wallet from session (passed from frontend or stored during match)
                    // For now, extract from request body or use a placeholder
                    userWallet = req.body.wallet || null;

                    if (userWallet && earnedAmount > 0) {
                        // Credit user balance
                        const newBalance = await redisClient.incrementBalance(userWallet, earnedAmount);
                        console.log(`[x402] Credited ${earnedAmount.toFixed(4)} USDC to ${userWallet.slice(0, 12)}... (new balance: ${newBalance.toFixed(4)})`);

                        // Award points (1 point per 0.01 USDC earned)
                        const pointsEarned = Math.floor(earnedAmount * 100);
                        if (pointsEarned > 0) {
                            await redisClient.incrementPoints(userWallet, pointsEarned);
                        }

                        // Record in user history
                        await redisClient.addToHistory(userWallet, {
                            matchId,
                            bidId,
                            earnedAmount,
                            duration,
                            answer: answer || null,
                            completedAt: Date.now()
                        });

                        // Add to match history stream for archiving
                        await redisClient.addMatchToStream({
                            matchId,
                            bidId,
                            wallet: userWallet,
                            earnedAmount,
                            duration,
                            answer: answer || null,
                            exitedEarly: exitedEarly || false,
                            completedAt: Date.now()
                        });
                    }
                }
            }

            // 4. Publish completion event
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
                        earnedAmount,
                        timestamp: new Date().toISOString()
                    }
                }));
            }

            return res.status(200).json({
                success: true,
                matchId,
                approved: true,
                earnedAmount: Number(earnedAmount.toFixed(4)),
                engagementScore: 1.0,
                threshold: 0.7
            });
        }

        // Legacy Prisma match completion - no longer supported
        // All matches should now be x402-based (matchId starts with 'x402_match_' or 'match_')
        console.error(`[Match] Unsupported legacy match ID: ${matchId}`);
        return res.status(400).json({
            error: 'legacy_match_unsupported',
            message: 'Legacy Prisma-based matches are no longer supported. Use x402 protocol.'
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
        // For x402 matches, validation is automatic (all approved)
        // This endpoint is kept for backwards compatibility
        console.log(`Validation result for match ${matchId}: ${result}`);

        // Publish result to human (for transparency)
        if (redis.isOpen) {
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'VALIDATION_RESULT',
                payload: {
                    matchId,
                    result,
                    reason,
                    earningsApproved: result === 'approved'
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
        // Import redisClient to restore x402 order quantity
        const { redisClient } = await import('../utils/redis');

        // 1. Restore order quantity in Redis (if bidId provided)
        if (bidId) {
            const order = await redisClient.getOrder(bidId) as any;
            if (order) {
                order.quantity += 1;
                order.status = 'open';

                await redisClient.setOrder(bidId, order);
                await redisClient.updateOrderStatus(bidId, 'open');

                console.log(`[Dismiss] Restored ${bidId.slice(0, 16)}... quantity to ${order.quantity}`);
            }

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
            const sessionId = await redisClient.client.get(`user:${pubkey}:active_session`);

            if (sessionId) {
                const session = await redisClient.getSession(sessionId) as any;
                if (session) {
                    session.active = false;
                    session.endedAt = Date.now();
                    await redisClient.setSession(sessionId, session, 300);
                    await redisClient.removeAvailableUser(sessionId);
                    await redisClient.client.del(`user:${pubkey}:active_session`);
                    console.log(`[Dismiss] Cancelled session for ${pubkey.slice(0, 12)}...`);

                    // Broadcast ASK_CANCELLED
                    if (redis.isOpen) {
                        await redis.publish('marketplace_events', JSON.stringify({
                            type: 'ASK_CANCELLED',
                            payload: { id: sessionId }
                        }));
                    }
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
