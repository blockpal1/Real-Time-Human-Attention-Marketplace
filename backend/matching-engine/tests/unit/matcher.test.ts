import { OrderBook } from '../../src/engine/order-book';
import { UserPool } from '../../src/engine/user-pool';
import { SessionEnforcer } from '../../src/engine/session-enforcer';
import { Matcher } from '../../src/engine/matcher';
import { Bid, BidStatus } from '../../src/types/bid';
import { UserSession, SessionStatus } from '../../src/types/session';
import { MatchStatus, MatchEndReason } from '../../src/types/match';

function createTestBid(overrides: Partial<Bid> = {}): Bid {
    const now = Date.now();
    return {
        bidId: `bid-${Math.random().toString(36).substring(7)}`,
        agentPubkey: 'agent-pubkey',
        maxPricePerSecond: 100,
        requiredAttentionScore: 0.5,
        minAttentionSeconds: 5,
        expiryTimestamp: now + 60000,
        createdAt: now,
        status: BidStatus.PENDING,
        ...overrides,
    };
}

function createTestSession(overrides: Partial<UserSession> = {}): UserSession {
    const now = Date.now();
    return {
        sessionId: `session-${Math.random().toString(36).substring(7)}`,
        userPubkey: 'user-pubkey',
        priceFloorMicros: 50,
        currentMatchId: null,
        lastEngagementScore: 0.7,
        lastLivenessScore: 0.9,
        connectedAt: now,
        lastHeartbeat: now,
        status: SessionStatus.AVAILABLE,
        ...overrides,
    };
}

describe('Matcher', () => {
    let orderBook: OrderBook;
    let userPool: UserPool;
    let enforcer: SessionEnforcer;
    let matcher: Matcher;

    beforeEach(() => {
        orderBook = new OrderBook();
        userPool = new UserPool();
        enforcer = new SessionEnforcer();
        matcher = new Matcher(orderBook, userPool, enforcer, {
            emitEvents: false, // Disable event emission for unit tests
        });
    });

    afterEach(() => {
        matcher.stop();
    });

    describe('tryMatch', () => {
        it('should match highest bid to available user', async () => {
            const bid = createTestBid({ bidId: 'bid1', maxPricePerSecond: 100 });
            const session = createTestSession({ sessionId: 'session1' });

            orderBook.addBid(bid);
            userPool.addUser(session);

            const result = await matcher.tryMatch();

            expect(result).not.toBeNull();
            expect(result?.match.bidId).toBe('bid1');
            expect(result?.match.sessionId).toBe('session1');
            expect(result?.match.status).toBe(MatchStatus.ACTIVE);
        });

        it('should return null when no bids exist', async () => {
            const session = createTestSession();
            userPool.addUser(session);

            const result = await matcher.tryMatch();

            expect(result).toBeNull();
        });

        it('should return null when no users available', async () => {
            const bid = createTestBid();
            orderBook.addBid(bid);

            const result = await matcher.tryMatch();

            expect(result).toBeNull();
        });

        it('should skip expired bids', async () => {
            const now = Date.now();
            const expiredBid = createTestBid({
                bidId: 'expired',
                expiryTimestamp: now - 1000,
            });
            const validBid = createTestBid({
                bidId: 'valid',
                maxPricePerSecond: 50, // Lower price
                expiryTimestamp: now + 60000,
            });
            const session = createTestSession();

            orderBook.addBid(expiredBid);
            orderBook.addBid(validBid);
            userPool.addUser(session);

            const result = await matcher.tryMatch();

            expect(result?.match.bidId).toBe('valid');
            expect(orderBook.getBid('expired')).toBeNull();
        });

        it('should match based on price floor', async () => {
            const expensiveBid = createTestBid({
                bidId: 'expensive',
                maxPricePerSecond: 200,
            });
            const cheapBid = createTestBid({
                bidId: 'cheap',
                maxPricePerSecond: 30,
            });
            const expensiveUser = createTestSession({
                sessionId: 'expensive-user',
                priceFloorMicros: 150,
            });
            const cheapUser = createTestSession({
                sessionId: 'cheap-user',
                priceFloorMicros: 25,
            });

            orderBook.addBid(expensiveBid);
            orderBook.addBid(cheapBid);
            userPool.addUser(expensiveUser);
            userPool.addUser(cheapUser);

            // First match: expensive bid to cheap user (cheapest available)
            const result1 = await matcher.tryMatch();
            expect(result1?.match.bidId).toBe('expensive');
            expect(result1?.match.sessionId).toBe('cheap-user');

            // Second match: cheap bid can only match expensive user (cheap is busy)
            const result2 = await matcher.tryMatch();
            // Cheap bid at 30 can't match expensive user at 150
            expect(result2).toBeNull();
        });

        it('should mark user as busy after match', async () => {
            const bid = createTestBid();
            const session = createTestSession({ sessionId: 'test-session' });

            orderBook.addBid(bid);
            userPool.addUser(session);

            await matcher.tryMatch();

            const updatedSession = userPool.getSession('test-session');
            expect(updatedSession?.status).toBe(SessionStatus.BUSY);
            expect(updatedSession?.currentMatchId).not.toBeNull();
        });

        it('should not match same user twice', async () => {
            const bid1 = createTestBid({ bidId: 'bid1' });
            const bid2 = createTestBid({ bidId: 'bid2' });
            const session = createTestSession();

            orderBook.addBid(bid1);
            orderBook.addBid(bid2);
            userPool.addUser(session);

            const result1 = await matcher.tryMatch();
            const result2 = await matcher.tryMatch();

            expect(result1).not.toBeNull();
            expect(result2).toBeNull(); // User is now busy
        });

        it('should skip users with low engagement', async () => {
            const bid = createTestBid({ requiredAttentionScore: 0.7 });
            const lowEngagement = createTestSession({
                sessionId: 'low',
                lastEngagementScore: 0.3,
            });
            const highEngagement = createTestSession({
                sessionId: 'high',
                lastEngagementScore: 0.9,
            });

            orderBook.addBid(bid);
            userPool.addUser(lowEngagement);
            userPool.addUser(highEngagement);

            const result = await matcher.tryMatch();

            expect(result?.match.sessionId).toBe('high');
        });
    });

    describe('processEngagement', () => {
        it('should accumulate verified seconds', async () => {
            const bid = createTestBid();
            const session = createTestSession({ sessionId: 'test-session' });

            orderBook.addBid(bid);
            userPool.addUser(session);

            const result = await matcher.tryMatch();
            expect(result).not.toBeNull();

            // Process engagement updates
            matcher.processEngagement('test-session', 0.8, 0.9, 1);
            matcher.processEngagement('test-session', 0.8, 0.9, 1);

            const match = matcher.getMatch(result!.match.matchId);
            expect(match?.verifiedSeconds).toBe(2);
            expect(match?.accumulatedAmount).toBe(200); // 2s × 100 micro-USDC
        });

        it('should end match on low engagement after grace period', async () => {
            const now = Date.now();
            const bid = createTestBid();
            const session = createTestSession({
                sessionId: 'test-session',
                lastEngagementScore: 0.8,
                lastHeartbeat: now,
            });

            orderBook.addBid(bid);
            userPool.addUser(session);

            await matcher.tryMatch();

            // Simulate low engagement beyond grace period
            userPool.updateEngagement('test-session', 0.1, 0.9);

            // Wait for grace period to expire (mocked by multiple calls)
            for (let i = 0; i < 5; i++) {
                matcher.processEngagement('test-session', 0.1, 0.9, 1);
            }

            // Match should have ended
            expect(matcher.getActiveMatches().length).toBe(0);
        });
    });

    describe('endMatch', () => {
        it('should create settlement instruction', async () => {
            const bid = createTestBid();
            const session = createTestSession();

            orderBook.addBid(bid);
            userPool.addUser(session);

            const matchResult = await matcher.tryMatch();
            expect(matchResult).not.toBeNull();

            // Add some verified time
            matcher.processEngagement(session.sessionId, 0.8, 0.9, 10);

            const settlement = await matcher.endMatch(
                matchResult!.match.matchId,
                MatchStatus.COMPLETED,
                MatchEndReason.DURATION_MET
            );

            expect(settlement).not.toBeNull();
            expect(settlement?.verifiedSeconds).toBe(10);
            expect(settlement?.totalAmount).toBe(1000);
        });

        it('should free user after match ends', async () => {
            const bid = createTestBid();
            const session = createTestSession({ sessionId: 'test-session' });

            orderBook.addBid(bid);
            userPool.addUser(session);

            const result = await matcher.tryMatch();
            await matcher.endMatch(
                result!.match.matchId,
                MatchStatus.COMPLETED,
                MatchEndReason.DURATION_MET
            );

            const updatedSession = userPool.getSession('test-session');
            expect(updatedSession?.status).toBe(SessionStatus.AVAILABLE);
            expect(updatedSession?.currentMatchId).toBeNull();
        });
    });

    describe('handleUserDisconnect', () => {
        it('should end active match when user disconnects', async () => {
            const bid = createTestBid();
            const session = createTestSession({ sessionId: 'test-session' });

            orderBook.addBid(bid);
            userPool.addUser(session);

            const result = await matcher.tryMatch();
            expect(result).not.toBeNull();

            await matcher.handleUserDisconnect('test-session');

            // Match should be ended
            expect(matcher.getActiveMatches().length).toBe(0);
            // User should be removed
            expect(userPool.getSession('test-session')).toBeNull();
        });
    });

    describe('getMetrics', () => {
        it('should track match statistics', async () => {
            const bid = createTestBid();
            const session = createTestSession();

            orderBook.addBid(bid);
            userPool.addUser(session);

            await matcher.tryMatch();

            const metrics = matcher.getMetrics();

            expect(metrics.matchesCreated).toBe(1);
            expect(metrics.activeMatches).toBe(1);
            expect(metrics.pendingBids).toBe(0);
        });
    });
});
