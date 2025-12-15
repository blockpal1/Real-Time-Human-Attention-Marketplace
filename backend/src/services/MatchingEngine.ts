import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';
import { webhookService } from './WebhookService';

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
            // Fetch active, unmatched bids
            // TODO: In production, filter by 'matches count < targetQuantity' in SQL/Prisma directly if possible, or filter in memory
            const pendingBids = await prisma.bid.findMany({
                where: {
                    active: true,
                    expiry: { gt: new Date() },
                    targetQuantity: { gt: 0 } // Strict Quantity Check
                },
                orderBy: { maxPricePerSecond: 'desc' },
                take: 100
            });

            if (pendingBids.length === 0) return;

            // Fetch active sessions NOT currently in a match (active OR offered)
            const availableSessions = await prisma.session.findMany({
                where: {
                    active: true,
                    // Note: connected check removed for demo reliability
                    // Ghost sessions prevented by server startup cleanup in server.ts
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

            if (pendingBids.length > 0 && availableSessions.length > 0) {
                console.log(`Matching Cycle: ${pendingBids.length} Bids, ${availableSessions.length} Sessions`);
            }

            for (const bid of pendingBids) {
                // Strict Quantity Check (Virtual Ledger)
                if (bid.targetQuantity <= 0) continue;

                // Find eligible session using Redis for uniqueness check
                let match = null;
                for (const session of availableSessions) {
                    const isMatch = session.priceFloor <= bid.maxPricePerSecond;
                    if (!isMatch) continue;

                    // Redis SISMEMBER: O(1) uniqueness check
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
                    console.log(`MATCH FOUND! Bid ${bid.maxPricePerSecond} >= Ask ${match.priceFloor}`);
                    await this.executeSoftMatch(bid, match);
                    // Remove matched session from local pool
                    const index = availableSessions.indexOf(match);
                    if (index > -1) availableSessions.splice(index, 1);
                } else {
                    // Debug why no match
                    if (availableSessions.length > 0) {
                        const s = availableSessions[0];
                        console.log(`No Match: Bid ${bid.maxPricePerSecond} vs Session ${s.priceFloor}`);
                    }
                }
            }

            // Cleanup Stale Offers (> 30s)
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
