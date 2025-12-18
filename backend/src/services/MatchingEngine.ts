import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import { webhookService } from './WebhookService';
import { orderStore, OrderRecord } from '../middleware/x402OrderBook';

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
            // UNIFIED BID POOL: Prisma + x402 Orders
            // ========================================

            // 1. Fetch Prisma bids
            const prismaBids = await prisma.bid.findMany({
                where: {
                    active: true,
                    expiry: { gt: new Date() },
                    targetQuantity: { gt: 0 }
                },
                orderBy: { maxPricePerSecond: 'desc' },
                take: 100
            });

            // 2. Get x402 orders from orderStore
            const x402Bids: Array<{
                source: 'x402';
                tx_hash: string;
                maxPricePerSecond: number; // In micros for comparison
                durationPerUser: number;
                quantity: number;
                contentUrl: string | null;
                validationQuestion: string;
            }> = [];

            orderStore.forEach((order, txHash) => {
                if (order.status === 'open' && order.quantity > 0) {
                    x402Bids.push({
                        source: 'x402',
                        tx_hash: txHash,
                        maxPricePerSecond: order.bid * 1_000_000, // Convert USDC to micros
                        durationPerUser: order.duration,
                        quantity: order.quantity,
                        contentUrl: order.content_url,
                        validationQuestion: order.validation_question
                    });
                }
            });

            // 3. Create unified bid pool
            interface UnifiedBid {
                source: 'prisma' | 'x402';
                id: string;
                maxPricePerSecond: number;
                durationPerUser: number;
                quantity: number;
                contentUrl: string | null;
                validationQuestion: string | null;
                agentPubkey?: string | null;
                targetUrl?: string | null;
            }

            const unifiedBids: UnifiedBid[] = [
                ...prismaBids.map(b => ({
                    source: 'prisma' as const,
                    id: b.id,
                    maxPricePerSecond: b.maxPricePerSecond,
                    durationPerUser: b.durationPerUser,
                    quantity: b.targetQuantity,
                    contentUrl: b.contentUrl,
                    validationQuestion: b.validationQuestion,
                    agentPubkey: b.agentPubkey,
                    targetUrl: b.targetUrl
                })),
                ...x402Bids.map(b => ({
                    source: 'x402' as const,
                    id: b.tx_hash,
                    maxPricePerSecond: b.maxPricePerSecond,
                    durationPerUser: b.durationPerUser,
                    quantity: b.quantity,
                    contentUrl: b.contentUrl,
                    validationQuestion: b.validationQuestion,
                    agentPubkey: null,
                    targetUrl: undefined
                }))
            ];

            // Sort by price descending (best bids first)
            unifiedBids.sort((a, b) => b.maxPricePerSecond - a.maxPricePerSecond);

            if (unifiedBids.length === 0) return;

            // Fetch active sessions NOT currently in a match
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

            if (unifiedBids.length > 0 && availableSessions.length > 0) {
                const prismaCount = prismaBids.length;
                const x402Count = x402Bids.length;
                console.log(`Matching Cycle: ${prismaCount} Prisma + ${x402Count} x402 Bids, ${availableSessions.length} Sessions`);
            }

            for (const bid of unifiedBids) {
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
                    console.log(`MATCH FOUND! Bid ${bid.maxPricePerSecond} (${bid.source}) >= Ask ${match.priceFloor}`);

                    if (bid.source === 'prisma') {
                        // Use existing Prisma matching logic
                        const prismaBid = prismaBids.find(b => b.id === bid.id)!;
                        await this.executeSoftMatch(prismaBid, match);
                    } else {
                        // Use x402 matching logic
                        await this.executeX402Match(bid.id, match);
                    }

                    // Remove matched session from local pool
                    const index = availableSessions.indexOf(match);
                    if (index > -1) availableSessions.splice(index, 1);
                } else {
                    if (availableSessions.length > 0) {
                        const s = availableSessions[0];
                        console.log(`No Match: Bid ${bid.maxPricePerSecond} (${bid.source}) vs Session ${s.priceFloor}`);
                    }
                }
            }

            // Cleanup Stale Offers
            await this.cleanupStaleOffers();

        } catch (error) {
            console.error('Matching Cycle Error:', error);
        }
    }

    private async executeSoftMatch(bid: any, session: any) {
        console.log(`SOFT MATCH: Bid ${bid.id} -> Session ${session.id}`);

        // 1. ATOMIC: Decrement Quantity (Virtual Ledger)
        const updatedBid = await prisma.bid.update({
            where: { id: bid.id },
            data: { targetQuantity: { decrement: 1 } }
        });

        // 2. Create Match Record
        const matchRecord = await prisma.match.create({
            data: {
                bidId: bid.id,
                sessionId: session.id,
                status: 'offered',
                startTime: new Date()
            }
        });

        // 3. Mark session as consumed (prevents re-matching after stale cleanup)
        await prisma.session.update({
            where: { id: session.id },
            data: { active: false }
        });

        // 3. Publish Granular Events
        if (redis.isOpen) {
            // A. Update Order Book (The "100 -> 99" visual)
            if (updatedBid.targetQuantity > 0) {
                await redis.publish('marketplace_events', JSON.stringify({
                    type: 'BID_UPDATED',
                    payload: {
                        bidId: bid.id,
                        remainingQuantity: updatedBid.targetQuantity
                    }
                }));
            } else {
                await redis.publish('marketplace_events', JSON.stringify({
                    type: 'BID_FILLED',
                    payload: { bidId: bid.id }
                }));
            }

            // B. Remove Ask (It's taken)
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'ASK_MATCHED',
                payload: { askId: session.id }
            }));

            // C. Notify Users (Broadcast for Demo Mode)
            await redis.publish('marketplace_events', JSON.stringify({
                type: 'MATCH_CREATED', // Triggers MATCH_FOUND in WS
                sessionId: session.id, // For Targeted
                matchId: matchRecord.id,
                bidId: bid.id,
                price: bid.maxPricePerSecond / 1_000_000,
                // Payload for Broadcast Feed/Modal
                payload: {
                    price: bid.maxPricePerSecond / 1_000_000,
                    duration: bid.durationPerUser,
                    quantity: 1,
                    topic: bid.targetUrl || 'Ad Campaign',
                    matchId: matchRecord.id,
                    // Content for Focus Session
                    contentUrl: bid.contentUrl || null,
                    validationQuestion: bid.validationQuestion || null
                }
            }));
        }

        // 4. Send webhook to agent
        if (bid.agentPubkey) {
            await webhookService.notifyMatchCreated(
                bid.agentPubkey,
                matchRecord.id,
                bid.id,
                session.id,
                bid.maxPricePerSecond,
                bid.durationPerUser
            );
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

    private async cleanupStaleOffers() {
        // Reduced to 10s for snappier UX during demo/testing
        const timeThreshold = new Date(Date.now() - 10 * 1000);

        const expired = await prisma.match.findMany({
            where: {
                status: 'offered',
                startTime: { lt: timeThreshold }
            },
            include: { bid: true } // Include bid data for quantity restoration
        });

        for (const match of expired) {
            console.log(`Stale offer cleanup: Match ${match.id}`);

            // 1. Mark match as failed
            await prisma.match.update({
                where: { id: match.id },
                data: { status: 'failed' }
            });

            // 2. Restore bid quantity (bid returns to book)
            const updatedBid = await prisma.bid.update({
                where: { id: match.bidId },
                data: { targetQuantity: { increment: 1 } }
            });

            // 3. Publish BID_UPDATED to restore bid in order book
            if (redis.isOpen) {
                await redis.publish('marketplace_events', JSON.stringify({
                    type: 'BID_UPDATED',
                    payload: {
                        bidId: match.bidId,
                        remainingQuantity: updatedBid.targetQuantity
                    }
                }));
            }

            // Note: Session is already marked inactive on match creation, so it won't re-match
        }
    }
}
