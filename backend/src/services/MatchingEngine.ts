import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import { orderStore } from '../middleware/x402OrderBook';

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
            // ========================================
            // x402 ORDERS ONLY (Prisma bids removed)
            // ========================================

            // 1. Get x402 orders from orderStore
            interface Bid {
                id: string;           // tx_hash
                maxPricePerSecond: number; // In micros for comparison
                durationPerUser: number;
                quantity: number;
                contentUrl: string | null;
                validationQuestion: string;
            }

            const bids: Bid[] = [];
            orderStore.forEach((order, txHash) => {
                if (order.status === 'open' && order.quantity > 0) {
                    bids.push({
                        id: txHash,
                        maxPricePerSecond: order.bid * 1_000_000, // Convert USDC to micros
                        durationPerUser: order.duration,
                        quantity: order.quantity,
                        contentUrl: order.content_url,
                        validationQuestion: order.validation_question
                    });
                }
            });

            // Sort by price descending (best bids first)
            bids.sort((a, b) => b.maxPricePerSecond - a.maxPricePerSecond);

            if (bids.length === 0) return;

            // 2. Fetch active sessions NOT currently in a match (sessions still use Prisma)
            const availableSessions = await prisma.session.findMany({
                where: {
                    active: true,
                    priceFloor: { gt: 0 }, // Exclude phantom sessions
                    matches: {
                        none: {
                            status: { in: ['active', 'offered'] }
                        }
                    }
                },
                include: { user: true },
                take: 100
            });

            if (availableSessions.length === 0) return;

            if (bids.length > 0 && availableSessions.length > 0) {
                console.log(`Matching Cycle: ${bids.length} x402 Bids, ${availableSessions.length} Sessions`);
            }

            // 3. Match bids to sessions
            for (const bid of bids) {
                if (bid.quantity <= 0) continue;

                // Find eligible session
                let match = null;
                for (const session of availableSessions) {
                    const isMatch = session.priceFloor <= bid.maxPricePerSecond;
                    if (!isMatch) continue;

                    // Redis uniqueness check
                    let alreadySeen = false;
                    if (redis.isOpen) {
                        alreadySeen = Boolean(await redis.sIsMember(`campaign:${bid.id}:users`, session.userPubkey));
                    }

                    if (!alreadySeen) {
                        match = session;
                        break;
                    }
                }

                if (match) {
                    console.log(`MATCH FOUND! Bid ${bid.maxPricePerSecond} (x402) >= Ask ${match.priceFloor}`);
                    await this.executeX402Match(bid.id, match);

                    // Remove matched session from local pool
                    const index = availableSessions.indexOf(match);
                    if (index > -1) availableSessions.splice(index, 1);
                }
            }

            // Note: Stale cleanup handled by dismissMatch API (10s timeout client-side)

        } catch (error) {
            console.error('Matching Cycle Error:', error);
        }
    }


    /**
     * Execute x402 order match (orders from orderStore, not Prisma)
     */
    private async executeX402Match(txHash: string, session: any) {
        const order = orderStore.get(txHash);
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
        orderStore.set(txHash, order);

        console.log(`[x402] Order ${txHash.slice(0, 16)}... quantity now ${order.quantity}, status: ${order.status}`);

        // 2. Mark session as consumed
        await prisma.session.update({
            where: { id: session.id },
            data: { active: false }
        });

        // 3. Generate a match ID for this x402 match (for tracking)
        const matchId = `x402_match_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

        // 4. Publish events to WebSocket
        if (redis.isOpen) {
            // A. Update Order Book (remove or decrement)
            if (order.quantity > 0) {
                await redis.publish('marketplace_events', JSON.stringify({
                    type: 'BID_UPDATED',
                    payload: {
                        bidId: txHash,
                        remainingQuantity: order.quantity
                    }
                }));
            } else {
                await redis.publish('marketplace_events', JSON.stringify({
                    type: 'BID_FILLED',
                    payload: { bidId: txHash }
                }));
            }

            // B. Remove Ask (It's taken)
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'ASK_MATCHED',
                payload: { askId: session.id }
            }));

            // C. Notify Users - MATCH_CREATED triggers MATCH_FOUND in WebSocketManager
            await redis.publish('marketplace_events', JSON.stringify({
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
        if (redis.isOpen) {
            await redis.sAdd(`campaign:${txHash}:users`, session.userPubkey);
        }
    }
}
