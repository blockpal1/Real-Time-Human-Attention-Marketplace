import { UserSession, SessionStatus } from '../types/session';

/**
 * UserPool - Tracks available users for matching
 * Uses Maps for O(1) lookups and a sorted list for price-ordered retrieval
 */
export class UserPool {
    /** All sessions by session ID */
    private sessions: Map<string, UserSession> = new Map();

    /** Sessions indexed by user pubkey (for duplicate detection) */
    private sessionsByPubkey: Map<string, string> = new Map();

    /** Heartbeat timeout in milliseconds */
    private readonly heartbeatTimeoutMs: number;

    constructor(heartbeatTimeoutMs: number = 30000) {
        this.heartbeatTimeoutMs = heartbeatTimeoutMs;
    }

    /**
     * Add or update a user session
     */
    addUser(session: UserSession): void {
        // Check for existing session by pubkey
        const existingSessionId = this.sessionsByPubkey.get(session.userPubkey);
        if (existingSessionId && existingSessionId !== session.sessionId) {
            // Remove old session
            this.removeUser(existingSessionId);
        }

        this.sessions.set(session.sessionId, session);
        this.sessionsByPubkey.set(session.userPubkey, session.sessionId);
    }

    /**
     * Remove a user session
     */
    removeUser(sessionId: string): UserSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        this.sessions.delete(sessionId);
        this.sessionsByPubkey.delete(session.userPubkey);
        return session;
    }

    /**
     * Get a session by ID
     */
    getSession(sessionId: string): UserSession | null {
        return this.sessions.get(sessionId) ?? null;
    }

    /**
     * Get a session by user pubkey
     */
    getSessionByPubkey(userPubkey: string): UserSession | null {
        const sessionId = this.sessionsByPubkey.get(userPubkey);
        if (!sessionId) return null;
        return this.sessions.get(sessionId) ?? null;
    }

    /**
     * Update a session's properties
     */
    updateSession(
        sessionId: string,
        updates: Partial<UserSession>
    ): UserSession | null {
        const session = this.sessions.get(sessionId);
        if (!session) return null;

        const updated = { ...session, ...updates };
        this.sessions.set(sessionId, updated);
        return updated;
    }

    /**
     * Mark a session as busy (assigned to a match)
     */
    markBusy(sessionId: string, matchId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        this.sessions.set(sessionId, {
            ...session,
            status: SessionStatus.BUSY,
            currentMatchId: matchId,
        });
        return true;
    }

    /**
     * Mark a session as available again
     */
    markAvailable(sessionId: string): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        this.sessions.set(sessionId, {
            ...session,
            status: SessionStatus.AVAILABLE,
            currentMatchId: null,
        });
        return true;
    }

    /**
     * Update engagement scores for a session
     */
    updateEngagement(
        sessionId: string,
        attentionScore: number,
        livenessScore: number
    ): boolean {
        const session = this.sessions.get(sessionId);
        if (!session) return false;

        this.sessions.set(sessionId, {
            ...session,
            lastEngagementScore: attentionScore,
            lastLivenessScore: livenessScore,
            lastHeartbeat: Date.now(),
        });
        return true;
    }

    /**
     * Get all sessions currently available for matching
     */
    getAvailableUsers(): UserSession[] {
        const now = Date.now();
        const available: UserSession[] = [];

        for (const session of this.sessions.values()) {
            if (
                session.status === SessionStatus.AVAILABLE &&
                session.currentMatchId === null &&
                now - session.lastHeartbeat < this.heartbeatTimeoutMs
            ) {
                available.push(session);
            }
        }

        return available;
    }

    /**
     * Find users who can match a bid based on price floor
     * Returns users sorted by price floor (ascending) for fair matching
     */
    findMatchingUsers(maxPrice: number): UserSession[] {
        const now = Date.now();
        const matching: UserSession[] = [];

        for (const session of this.sessions.values()) {
            if (
                session.status === SessionStatus.AVAILABLE &&
                session.currentMatchId === null &&
                session.priceFloorMicros <= maxPrice &&
                now - session.lastHeartbeat < this.heartbeatTimeoutMs
            ) {
                matching.push(session);
            }
        }

        // Sort by price floor ascending (cheaper users first for agent)
        // Tie-breaker: earlier connected user
        matching.sort((a, b) => {
            const priceDiff = a.priceFloorMicros - b.priceFloorMicros;
            if (priceDiff !== 0) return priceDiff;
            return a.connectedAt - b.connectedAt;
        });

        return matching;
    }

    /**
     * Remove sessions that have timed out
     * @returns Number of sessions removed
     */
    pruneStale(now: number = Date.now()): number {
        const staleIds: string[] = [];

        for (const [sessionId, session] of this.sessions) {
            if (now - session.lastHeartbeat > this.heartbeatTimeoutMs) {
                staleIds.push(sessionId);
            }
        }

        for (const sessionId of staleIds) {
            this.removeUser(sessionId);
        }

        return staleIds.length;
    }

    /**
     * Get total number of sessions
     */
    get size(): number {
        return this.sessions.size;
    }

    /**
     * Get number of available sessions
     */
    get availableCount(): number {
        return this.getAvailableUsers().length;
    }

    /**
     * Get all sessions (for debugging/testing)
     */
    getAllSessions(): UserSession[] {
        return [...this.sessions.values()];
    }

    /**
     * Clear all sessions
     */
    clear(): void {
        this.sessions.clear();
        this.sessionsByPubkey.clear();
    }
}
