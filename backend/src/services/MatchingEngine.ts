import { redisClient } from '../utils/redis';
import { OrderRecord } from '../middleware/x402OrderBook';

export class MatchingEngine {
    private isRunning = false;
    private matchInterval: NodeJS.Timeout | null = null;

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        console.log('Matching Engine Started');

        // Run matching loop every 500ms
        this.matchInterval = setInterval(() => this.runMatchingCycle(), 500);
    }

    stop() {
        this.isRunning = false;
        if (this.matchInterval) clearInterval(this.matchInterval);
    }

    private async runMatchingCycle() {
        try {
            if (!redisClient.isOpen) return;

            // ========================================
            // x402 ORDERS ONLY (Redis-based)
            // ========================================

            // 1. Get x402 orders from Redis
            interface Bid {
                id: string;           // tx_hash
                maxPricePerSecond: number; // In micros for comparison
                durationPerUser: number;
                quantity: number;
                contentUrl: string | null;
                validationQuestion: string;
            }

            const bids: Bid[] = [];
            const openOrderIds = await redisClient.getOpenOrders();

            for (const txHash of openOrderIds) {
                // Fetch full order data
                const order = await redisClient.getOrder(txHash) as OrderRecord | null;

                if (order && order.status === 'open' && order.quantity > 0) {
                    bids.push({
                        id: txHash,
                        maxPricePerSecond: order.bid * 1_000_000, // Convert USDC to micros
                        durationPerUser: order.duration,
                        quantity: order.quantity,
                        contentUrl: order.content_url,
                        validationQuestion: order.validation_question
                    });
                }
            }

            // Sort by price descending (best bids first)
            bids.sort((a, b) => b.maxPricePerSecond - a.maxPricePerSecond);

            if (bids.length === 0) return;

            // 2. Fetch available sessions from Redis sorted set (sorted by priceFloor)
            // We'll iterate through bids and use ZRANGEBYSCORE to find matchable users
            for (const bid of bids) {
                if (bid.quantity <= 0) continue;

                // Find sessions with priceFloor <= bid price (in micros)
                const matchableSessions = await redisClient.findMatchableUsers(bid.maxPricePerSecond, 10);

                if (matchableSessions.length === 0) continue;

                // Try to claim a session atomically
                for (const sessionId of matchableSessions) {
                    // Get session data
                    const session = await redisClient.getSession(sessionId) as any;
                    if (!session || !session.active) continue;

                    // Redis uniqueness check (has user already seen this campaign?)
                    const alreadySeen = await redisClient.hasUserSeenCampaign(bid.id, session.userPubkey);
                    if (alreadySeen) continue;

                    // Atomically claim this user (remove from pool)
                    const claimed = await redisClient.claimUser(sessionId);
                    if (!claimed) continue; // Someone else claimed them

                    console.log(`MATCH FOUND! Bid ${bid.maxPricePerSecond} (x402) >= Ask ${session.priceFloor}`);
                    await this.executeX402Match(bid.id, session);
                    break; // Move to next bid
                }
            }

            // Note: Stale cleanup handled by dismissMatch API (10s timeout client-side)

        } catch (error) {
            console.error('Matching Cycle Error:', error);
        }
    }


    /**
     * Execute x402 order match (orders from Redis, not Prisma)
     */
    private async executeX402Match(txHash: string, session: any) {
        const order = await redisClient.getOrder(txHash) as OrderRecord | null;
        if (!order) {
            console.error(`[x402 Match] Order not found: ${txHash}`);
            return;
        }

        console.log(`X402 MATCH: Order ${txHash.slice(0, 16)}... -> Session ${session.id}`);

        // 1. Decrement quantity
        order.quantity = Math.max(0, order.quantity - 1);

        // Only change status to 'in_progress' when quantity reaches 0 (fully consumed)
        // Orders with remaining quantity stay 'open' for more matches
        if (order.quantity === 0) {
            order.status = 'in_progress';
        }

        // Save updated order to Redis
        await redisClient.setOrder(txHash, order);

        // Update set tracking if status changed
        if (order.status !== 'open') {
            await redisClient.updateOrderStatus(txHash, order.status);
        }

        console.log(`[x402] Order ${txHash.slice(0, 16)}... quantity now ${order.quantity}, status: ${order.status}`);

        // 2. Mark session as consumed (already removed from pool by claimUser)
        session.active = false;
        session.endedAt = Date.now();
        await redisClient.setSession(session.id, session, 300); // Keep for 5 min for cleanup

        // Clear user's active session tracker
        await redisClient.client.del(`user:${session.userPubkey}:active_session`);

        // 3. Generate a match ID for this x402 match (for tracking)
        const matchId = `x402_match_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // 4. Publish events to WebSocket
        if (redisClient.isOpen) {
            // A. Update Order Book (remove or decrement)
            if (order.quantity > 0) {
                await redisClient.client.publish('marketplace_events', JSON.stringify({
                    type: 'BID_UPDATED',
                    payload: {
                        bidId: txHash,
                        remainingQuantity: order.quantity
                    }
                }));
            } else {
                await redisClient.client.publish('marketplace_events', JSON.stringify({
                    type: 'BID_FILLED',
                    payload: { bidId: txHash }
                }));
            }

            // B. Remove Ask (It's taken)
            await redisClient.client.publish('marketplace_events', JSON.stringify({
                type: 'ASK_MATCHED',
                payload: { askId: session.id }
            }));

            // C. Notify Users - MATCH_CREATED triggers MATCH_FOUND in WebSocketManager
            await redisClient.client.publish('marketplace_events', JSON.stringify({
                type: 'MATCH_CREATED',
                sessionId: session.id,
                matchId: matchId,
                bidId: txHash,
                price: order.bid, // Already in USDC
                payload: {
                    price: order.bid,
                    duration: order.duration,
                    quantity: 1,
                    topic: 'x402 Order',
                    matchId: matchId,
                    bidId: txHash, // Include bidId in payload for dismiss restore
                    // Content for Focus Session - THIS IS THE KEY DATA
                    contentUrl: order.content_url || null,
                    validationQuestion: order.validation_question || null
                }
            }));

            console.log(`[x402 Match] Broadcasted MATCH_CREATED for ${txHash.slice(0, 16)}...`);
        }

        // Mark user as seen for this campaign (uniqueness)
        await redisClient.markUserSeenCampaign(txHash, session.userPubkey);
    }
}
