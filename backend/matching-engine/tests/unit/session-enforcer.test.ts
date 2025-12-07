import { SessionEnforcer } from '../../src/engine/session-enforcer';
import { Bid, BidStatus } from '../../src/types/bid';
import { UserSession, SessionStatus } from '../../src/types/session';
import { Match, MatchStatus } from '../../src/types/match';

function createTestBid(overrides: Partial<Bid> = {}): Bid {
    const now = Date.now();
    return {
        bidId: 'test-bid',
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
        sessionId: 'test-session',
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

function createTestMatch(overrides: Partial<Match> = {}): Match {
    const now = Date.now();
    return {
        matchId: 'test-match',
        bidId: 'test-bid',
        sessionId: 'test-session',
        agentPubkey: 'agent-pubkey',
        userPubkey: 'user-pubkey',
        agreedPricePerSecond: 100,
        startedAt: now,
        verifiedSeconds: 0,
        accumulatedAmount: 0,
        status: MatchStatus.ACTIVE,
        ...overrides,
    };
}

describe('SessionEnforcer', () => {
    let enforcer: SessionEnforcer;

    beforeEach(() => {
        enforcer = new SessionEnforcer({
            minAttentionSeconds: 5,
            heartbeatTimeoutMs: 30000,
            minEngagementScore: 0.3,
            minLivenessScore: 0.5,
            lowEngagementGracePeriodSec: 3,
        });
    });

    describe('canMatch', () => {
        it('should allow valid match', () => {
            const session = createTestSession();
            const bid = createTestBid();

            const result = enforcer.canMatch(session, bid);

            expect(result.valid).toBe(true);
        });

        it('should reject if session already has a match', () => {
            const session = createTestSession({ currentMatchId: 'existing-match' });
            const bid = createTestBid();

            const result = enforcer.canMatch(session, bid);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('already has active match');
        });

        it('should reject if session is not available', () => {
            const session = createTestSession({ status: SessionStatus.BUSY });
            const bid = createTestBid();

            const result = enforcer.canMatch(session, bid);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not available');
        });

        it('should reject if bid price is below session floor', () => {
            const session = createTestSession({ priceFloorMicros: 200 });
            const bid = createTestBid({ maxPricePerSecond: 100 });

            const result = enforcer.canMatch(session, bid);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('below session floor');
        });

        it('should reject if session heartbeat is stale', () => {
            const now = Date.now();
            const session = createTestSession({ lastHeartbeat: now - 60000 });
            const bid = createTestBid();

            const result = enforcer.canMatch(session, bid, now);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('heartbeat stale');
        });

        it('should reject if bid is not pending', () => {
            const session = createTestSession();
            const bid = createTestBid({ status: BidStatus.MATCHED });

            const result = enforcer.canMatch(session, bid);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not pending');
        });

        it('should reject if bid is expired', () => {
            const now = Date.now();
            const session = createTestSession({ lastHeartbeat: now });
            const bid = createTestBid({ expiryTimestamp: now - 1000 });

            const result = enforcer.canMatch(session, bid, now);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('expired');
        });
    });

    describe('shouldContinueMatch', () => {
        it('should allow continuing valid active match', () => {
            const match = createTestMatch();
            const session = createTestSession({
                status: SessionStatus.BUSY,
                lastEngagementScore: 0.7,
                lastLivenessScore: 0.9,
            });

            const result = enforcer.shouldContinueMatch(match, session);

            expect(result.valid).toBe(true);
        });

        it('should reject if match is not active', () => {
            const match = createTestMatch({ status: MatchStatus.COMPLETED });
            const session = createTestSession();

            const result = enforcer.shouldContinueMatch(match, session);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('not active');
        });

        it('should reject if user disconnected', () => {
            const match = createTestMatch();
            const session = createTestSession({ status: SessionStatus.DISCONNECTED });

            const result = enforcer.shouldContinueMatch(match, session);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('disconnected');
        });

        it('should reject if liveness score is too low', () => {
            const match = createTestMatch();
            const session = createTestSession({ lastLivenessScore: 0.3 });

            const result = enforcer.shouldContinueMatch(match, session);

            expect(result.valid).toBe(false);
            expect(result.reason).toContain('Liveness score');
        });

        it('should allow low engagement during grace period', () => {
            const now = Date.now();
            const match = createTestMatch();
            const session = createTestSession({
                status: SessionStatus.BUSY,
                lastEngagementScore: 0.1, // Below threshold
                lastLivenessScore: 0.9,
                lastHeartbeat: now,
            });

            // First check - starts grace period
            const result1 = enforcer.shouldContinueMatch(match, session, now);
            expect(result1.valid).toBe(true);

            // Check during grace period
            const result2 = enforcer.shouldContinueMatch(match, session, now + 2000);
            expect(result2.valid).toBe(true);
        });

        it('should reject after grace period expires', () => {
            const now = Date.now();
            const match = createTestMatch();
            const session = createTestSession({
                status: SessionStatus.BUSY,
                lastEngagementScore: 0.1,
                lastLivenessScore: 0.9,
                lastHeartbeat: now + 5000,
            });

            // Start grace period
            enforcer.shouldContinueMatch(match, session, now);

            // After grace period
            const result = enforcer.shouldContinueMatch(match, session, now + 5000);
            expect(result.valid).toBe(false);
            expect(result.reason).toContain('below threshold for too long');
        });
    });

    describe('calculateAgreedPrice', () => {
        it('should return bid max price', () => {
            const session = createTestSession({ priceFloorMicros: 50 });
            const bid = createTestBid({ maxPricePerSecond: 100 });

            const price = enforcer.calculateAgreedPrice(session, bid);

            expect(price).toBe(100);
        });
    });

    describe('calculateSettlement', () => {
        it('should calculate total amount correctly', () => {
            const match = createTestMatch({
                verifiedSeconds: 30,
                agreedPricePerSecond: 100,
            });

            const amount = enforcer.calculateSettlement(match);

            expect(amount).toBe(3000);
        });
    });

    describe('meetsEngagementRequirement', () => {
        it('should return true when score meets requirement', () => {
            const session = createTestSession({ lastEngagementScore: 0.7 });
            const bid = createTestBid({ requiredAttentionScore: 0.5 });

            expect(enforcer.meetsEngagementRequirement(session, bid)).toBe(true);
        });

        it('should return false when score is below requirement', () => {
            const session = createTestSession({ lastEngagementScore: 0.3 });
            const bid = createTestBid({ requiredAttentionScore: 0.5 });

            expect(enforcer.meetsEngagementRequirement(session, bid)).toBe(false);
        });
    });
});
