import { prisma } from '../utils/prisma';
import { redis } from '../utils/redis';

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
                    expiry: { gt: new Date() }
                },
                include: { matches: true }, // Need to count matches
                orderBy: { maxPricePerSecond: 'desc' },
                take: 100
            });

            if (pendingBids.length === 0) return;

            // Fetch active sessions NOT currently in a match (active OR offered)
            const availableSessions = await prisma.session.findMany({
                where: {
                    active: true,
                    connected: true,
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

            for (const bid of pendingBids) {
                // Check Capacity
                // @ts-ignore - Prisma Client not regenerated
                const activeMatches = bid.matches.filter(m => ['active', 'offered', 'completed'].includes(m.status)).length;
                // @ts-ignore - Prisma Client not regenerated
                if (activeMatches >= bid.targetQuantity) continue;

                const match = availableSessions.find(session =>
                    session.priceFloor <= bid.maxPricePerSecond
                );

                if (match) {
                    await this.executeSoftMatch(bid, match);
                    // Remove matched session from local pool
                    const index = availableSessions.indexOf(match);
                    if (index > -1) availableSessions.splice(index, 1);
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

        // Create match with 'offered' status
        const matchRecord = await prisma.match.create({
            data: {
                bidId: bid.id,
                sessionId: session.id,
                status: 'offered', // <--- RESERVATION STATE
                startTime: new Date()
            }
        });

        // Notify Extension via Redis PubSub
        if (redis.isOpen) {
            await redis.publish('match_events', JSON.stringify({
                type: 'MATCH_FOUND',
                sessionId: session.id,
                payload: {
                    bidId: bid.id,
                    matchId: matchRecord.id,
                    price: bid.maxPricePerSecond / 1_000_000, // Convert to USDC for frontend
                    duration: bid.durationPerUser,
                    category: bid.targetUrl ? 'Ad' : 'Campaign',
                    content_url: bid.targetUrl || 'default.mp4',
                    validation_question: bid.validationQuestion
                }
            }));
        }
    }

    private async cleanupStaleOffers() {
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);

        const expired = await prisma.match.findMany({
            where: {
                status: 'offered',
                startTime: { lt: thirtySecondsAgo }
            }
        });

        if (expired.length > 0) {
            console.log(`Cleaning up ${expired.length} stale offers`);
            await prisma.match.updateMany({
                where: { id: { in: expired.map(e => e.id) } },
                data: { status: 'failed' } // Release session
            });
        }
    }
}
