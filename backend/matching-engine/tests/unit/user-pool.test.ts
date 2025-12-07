import { UserPool } from '../../src/engine/user-pool';
import { UserSession, SessionStatus } from '../../src/types/session';

function createTestSession(overrides: Partial<UserSession> = {}): UserSession {
    const now = Date.now();
    return {
        sessionId: `session-${Math.random().toString(36).substring(7)}`,
        userPubkey: 'user-pubkey-123',
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

describe('UserPool', () => {
    let userPool: UserPool;

    beforeEach(() => {
        userPool = new UserPool(30000); // 30s heartbeat timeout
    });

    describe('addUser / removeUser', () => {
        it('should add a user to the pool', () => {
            const session = createTestSession();
            userPool.addUser(session);

            expect(userPool.size).toBe(1);
            expect(userPool.getSession(session.sessionId)).toEqual(session);
        });

        it('should remove old session when same pubkey connects', () => {
            const session1 = createTestSession({
                sessionId: 'session1',
                userPubkey: 'same-pubkey',
            });
            const session2 = createTestSession({
                sessionId: 'session2',
                userPubkey: 'same-pubkey',
            });

            userPool.addUser(session1);
            userPool.addUser(session2);

            expect(userPool.size).toBe(1);
            expect(userPool.getSession('session1')).toBeNull();
            expect(userPool.getSession('session2')).toBeTruthy();
        });

        it('should remove user and return session', () => {
            const session = createTestSession();
            userPool.addUser(session);

            const removed = userPool.removeUser(session.sessionId);

            expect(removed).toEqual(session);
            expect(userPool.size).toBe(0);
        });

        it('should return null when removing non-existent user', () => {
            expect(userPool.removeUser('non-existent')).toBeNull();
        });
    });

    describe('getSession / getSessionByPubkey', () => {
        it('should find session by ID', () => {
            const session = createTestSession();
            userPool.addUser(session);

            expect(userPool.getSession(session.sessionId)).toEqual(session);
        });

        it('should find session by pubkey', () => {
            const session = createTestSession({ userPubkey: 'test-pubkey' });
            userPool.addUser(session);

            expect(userPool.getSessionByPubkey('test-pubkey')).toEqual(session);
        });
    });

    describe('updateSession', () => {
        it('should update session properties', () => {
            const session = createTestSession();
            userPool.addUser(session);

            const updated = userPool.updateSession(session.sessionId, {
                lastEngagementScore: 0.9,
            });

            expect(updated?.lastEngagementScore).toBe(0.9);
        });
    });

    describe('markBusy / markAvailable', () => {
        it('should mark session as busy with match ID', () => {
            const session = createTestSession();
            userPool.addUser(session);

            userPool.markBusy(session.sessionId, 'match-123');

            const updated = userPool.getSession(session.sessionId);
            expect(updated?.status).toBe(SessionStatus.BUSY);
            expect(updated?.currentMatchId).toBe('match-123');
        });

        it('should mark session as available', () => {
            const session = createTestSession({
                status: SessionStatus.BUSY,
                currentMatchId: 'match-123',
            });
            userPool.addUser(session);

            userPool.markAvailable(session.sessionId);

            const updated = userPool.getSession(session.sessionId);
            expect(updated?.status).toBe(SessionStatus.AVAILABLE);
            expect(updated?.currentMatchId).toBeNull();
        });
    });

    describe('getAvailableUsers', () => {
        it('should return only available users with recent heartbeat', () => {
            const now = Date.now();
            const available = createTestSession({
                sessionId: 'available',
                status: SessionStatus.AVAILABLE,
                lastHeartbeat: now,
            });
            const busy = createTestSession({
                sessionId: 'busy',
                status: SessionStatus.BUSY,
                lastHeartbeat: now,
            });
            const stale = createTestSession({
                sessionId: 'stale',
                status: SessionStatus.AVAILABLE,
                lastHeartbeat: now - 60000, // 60s ago
            });

            userPool.addUser(available);
            userPool.addUser(busy);
            userPool.addUser(stale);

            const users = userPool.getAvailableUsers();

            expect(users.length).toBe(1);
            expect(users[0].sessionId).toBe('available');
        });
    });

    describe('findMatchingUsers', () => {
        it('should find users with price floor below max price', () => {
            const now = Date.now();
            const cheap = createTestSession({
                sessionId: 'cheap',
                priceFloorMicros: 25,
                lastHeartbeat: now,
            });
            const moderate = createTestSession({
                sessionId: 'moderate',
                priceFloorMicros: 50,
                lastHeartbeat: now,
            });
            const expensive = createTestSession({
                sessionId: 'expensive',
                priceFloorMicros: 100,
                lastHeartbeat: now,
            });

            userPool.addUser(cheap);
            userPool.addUser(moderate);
            userPool.addUser(expensive);

            const matches = userPool.findMatchingUsers(75);

            expect(matches.length).toBe(2);
            // Should be sorted by price floor ascending
            expect(matches[0].sessionId).toBe('cheap');
            expect(matches[1].sessionId).toBe('moderate');
        });

        it('should not return busy users', () => {
            const now = Date.now();
            const available = createTestSession({
                sessionId: 'available',
                priceFloorMicros: 50,
                status: SessionStatus.AVAILABLE,
                lastHeartbeat: now,
            });
            const busy = createTestSession({
                sessionId: 'busy',
                priceFloorMicros: 25,
                status: SessionStatus.BUSY,
                lastHeartbeat: now,
            });

            userPool.addUser(available);
            userPool.addUser(busy);

            const matches = userPool.findMatchingUsers(100);

            expect(matches.length).toBe(1);
            expect(matches[0].sessionId).toBe('available');
        });
    });

    describe('pruneStale', () => {
        it('should remove sessions with stale heartbeat', () => {
            const now = Date.now();
            const fresh = createTestSession({
                sessionId: 'fresh',
                lastHeartbeat: now,
            });
            const stale = createTestSession({
                sessionId: 'stale',
                lastHeartbeat: now - 60000, // 60s ago
            });

            userPool.addUser(fresh);
            userPool.addUser(stale);

            const removed = userPool.pruneStale(now);

            expect(removed).toBe(1);
            expect(userPool.size).toBe(1);
            expect(userPool.getSession('fresh')).toBeTruthy();
        });
    });

    describe('updateEngagement', () => {
        it('should update engagement scores and heartbeat', () => {
            const session = createTestSession({
                lastEngagementScore: 0.5,
                lastHeartbeat: Date.now() - 5000,
            });
            userPool.addUser(session);

            const before = userPool.getSession(session.sessionId)?.lastHeartbeat;
            userPool.updateEngagement(session.sessionId, 0.9, 0.95);
            const after = userPool.getSession(session.sessionId);

            expect(after?.lastEngagementScore).toBe(0.9);
            expect(after?.lastLivenessScore).toBe(0.95);
            expect(after?.lastHeartbeat).toBeGreaterThan(before!);
        });
    });
});
