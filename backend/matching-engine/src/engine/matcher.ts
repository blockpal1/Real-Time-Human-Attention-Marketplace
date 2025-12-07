import { v4 as uuidv4 } from 'uuid';
import { OrderBook } from './order-book';
import { UserPool } from './user-pool';
import { SessionEnforcer } from './session-enforcer';
import { Bid, BidStatus } from '../types/bid';
import { UserSession } from '../types/session';
import { Match, MatchStatus, MatchEndReason, SettlementInstruction } from '../types/match';
import { MatchAssignedEvent, MatchEndedEvent, SettlementInstructionEvent } from '../types/events';
import { emitEvent, STREAM_MATCH_ASSIGNMENTS, STREAM_SETTLEMENT_INSTRUCTIONS } from '../infra';

/**
 * Match result from the matcher
 */
export interface MatchResult {
    match: Match;
    bid: Bid;
    session: UserSession;
}

/**
 * Configuration for the matcher
 */
export interface MatcherConfig {
    /** How often to run the matching loop (ms) */
    matchIntervalMs: number;
    /** How often to prune expired bids/sessions (ms) */
    pruneIntervalMs: number;
    /** Maximum matches per iteration (prevents starvation) */
    maxMatchesPerIteration: number;
    /** Enable event emission */
    emitEvents: boolean;
}

const DEFAULT_CONFIG: MatcherConfig = {
    matchIntervalMs: 10,
    pruneIntervalMs: 1000,
    maxMatchesPerIteration: 50,
    emitEvents: true,
};

/**
 * Matcher - Core matching algorithm
 * 
 * Runs a tight loop matching highest-priced bids to available users.
 * Optimized for <50ms latency.
 */
export class Matcher {
    private readonly orderBook: OrderBook;
    private readonly userPool: UserPool;
    private readonly enforcer: SessionEnforcer;
    private readonly config: MatcherConfig;

    /** Active matches by match ID */
    private activeMatches: Map<string, Match> = new Map();

    /** Running state */
    private running = false;
    private matchTimer: NodeJS.Timeout | null = null;
    private pruneTimer: NodeJS.Timeout | null = null;

    /** Performance metrics */
    private metrics = {
        matchesCreated: 0,
        matchesFailed: 0,
        matchesCompleted: 0,
        lastMatchLatencyMs: 0,
        avgMatchLatencyMs: 0,
        totalMatchTime: 0,
        matchCount: 0,
    };

    constructor(
        orderBook: OrderBook,
        userPool: UserPool,
        enforcer: SessionEnforcer,
        config: Partial<MatcherConfig> = {}
    ) {
        this.orderBook = orderBook;
        this.userPool = userPool;
        this.enforcer = enforcer;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Start the matching loop
     */
    start(): void {
        if (this.running) return;
        this.running = true;

        console.log('[Matcher] Starting matching loop');

        // Main matching loop using setImmediate for low latency
        this.scheduleMatchLoop();

        // Prune stale data periodically
        this.pruneTimer = setInterval(() => {
            this.prune();
        }, this.config.pruneIntervalMs);
    }

    /**
     * Stop the matching loop
     */
    stop(): void {
        this.running = false;

        if (this.matchTimer) {
            clearTimeout(this.matchTimer);
            this.matchTimer = null;
        }

        if (this.pruneTimer) {
            clearInterval(this.pruneTimer);
            this.pruneTimer = null;
        }

        console.log('[Matcher] Stopped');
    }

    /**
     * Schedule next match iteration
     */
    private scheduleMatchLoop(): void {
        if (!this.running) return;

        // Use setImmediate for lowest possible latency when there's work
        // Fall back to setTimeout when idle
        if (this.orderBook.size > 0 && this.userPool.availableCount > 0) {
            setImmediate(() => {
                this.runMatchIteration();
                this.scheduleMatchLoop();
            });
        } else {
            this.matchTimer = setTimeout(() => {
                this.runMatchIteration();
                this.scheduleMatchLoop();
            }, this.config.matchIntervalMs);
        }
    }

    /**
     * Run one iteration of the matching algorithm
     */
    private async runMatchIteration(): Promise<void> {
        const startTime = performance.now();
        let matchesThisIteration = 0;

        try {
            while (matchesThisIteration < this.config.maxMatchesPerIteration) {
                const result = await this.tryMatch();
                if (!result) break;

                matchesThisIteration++;
                this.metrics.matchesCreated++;
            }
        } catch (err) {
            console.error('[Matcher] Iteration error:', err);
        }

        // Update latency metrics
        const elapsed = performance.now() - startTime;
        if (matchesThisIteration > 0) {
            this.metrics.lastMatchLatencyMs = elapsed;
            this.metrics.totalMatchTime += elapsed;
            this.metrics.matchCount += matchesThisIteration;
            this.metrics.avgMatchLatencyMs =
                this.metrics.totalMatchTime / this.metrics.matchCount;
        }
    }

    /**
     * Try to create a single match
     * @returns MatchResult if successful, null if no match possible
     */
    async tryMatch(): Promise<MatchResult | null> {
        const now = Date.now();

        // Get highest-priced bid
        const bid = this.orderBook.peekTop();
        if (!bid) return null;

        // Check if bid is expired
        if (bid.expiryTimestamp <= now) {
            this.orderBook.popTop();
            return null;
        }

        // Find matching users
        const candidates = this.userPool.findMatchingUsers(bid.maxPricePerSecond);
        if (candidates.length === 0) return null;

        // Try each candidate until one validates
        for (const session of candidates) {
            const validation = this.enforcer.canMatch(session, bid, now);
            if (!validation.valid) {
                continue;
            }

            // Check engagement requirement
            if (!this.enforcer.meetsEngagementRequirement(session, bid)) {
                continue;
            }

            // Create match
            const match = this.createMatch(bid, session, now);

            // Update state
            this.orderBook.popTop();
            this.userPool.markBusy(session.sessionId, match.matchId);
            this.activeMatches.set(match.matchId, match);

            // Emit event
            if (this.config.emitEvents) {
                await this.emitMatchAssigned(match);
            }

            return { match, bid, session };
        }

        // No valid match found, but don't remove bid yet
        return null;
    }

    /**
     * Create a new match record
     */
    private createMatch(bid: Bid, session: UserSession, now: number): Match {
        return {
            matchId: uuidv4(),
            bidId: bid.bidId,
            sessionId: session.sessionId,
            agentPubkey: bid.agentPubkey,
            userPubkey: session.userPubkey,
            agreedPricePerSecond: this.enforcer.calculateAgreedPrice(session, bid),
            startedAt: now,
            verifiedSeconds: 0,
            accumulatedAmount: 0,
            status: MatchStatus.ACTIVE,
        };
    }

    /**
     * Process engagement update and accumulate verified time
     */
    processEngagement(
        sessionId: string,
        attentionScore: number,
        livenessScore: number,
        durationSeconds: number
    ): void {
        // Update session scores
        this.userPool.updateEngagement(sessionId, attentionScore, livenessScore);

        // Find active match for this session
        const session = this.userPool.getSession(sessionId);
        if (!session || !session.currentMatchId) return;

        const match = this.activeMatches.get(session.currentMatchId);
        if (!match || match.status !== MatchStatus.ACTIVE) return;

        // Validate match should continue
        const validation = this.enforcer.shouldContinueMatch(match, session);
        if (!validation.valid) {
            this.endMatch(
                match.matchId,
                MatchStatus.FAILED,
                MatchEndReason.LOW_ENGAGEMENT
            );
            return;
        }

        // Accumulate verified time
        match.verifiedSeconds += durationSeconds;
        match.accumulatedAmount = this.enforcer.calculateSettlement(match);
        this.activeMatches.set(match.matchId, match);
    }

    /**
     * End a match and emit settlement
     */
    async endMatch(
        matchId: string,
        status: MatchStatus,
        reason: MatchEndReason
    ): Promise<SettlementInstruction | null> {
        const match = this.activeMatches.get(matchId);
        if (!match) return null;

        const now = Date.now();

        // Update match
        match.status = status;
        match.endReason = reason;
        match.endedAt = now;
        match.accumulatedAmount = this.enforcer.calculateSettlement(match);

        // Free up the user
        this.userPool.markAvailable(match.sessionId);
        this.enforcer.clearMatchState(matchId);

        // Remove from active matches
        this.activeMatches.delete(matchId);

        // Create settlement instruction
        const settlement: SettlementInstruction = {
            matchId: match.matchId,
            escrowAccount: match.agentPubkey, // In real impl, would look up escrow
            userWallet: match.userPubkey,
            verifiedSeconds: match.verifiedSeconds,
            agreedPricePerSecond: match.agreedPricePerSecond,
            totalAmount: match.accumulatedAmount,
            nonce: now, // Simple nonce, would use better in production
            createdAt: now,
        };

        // Emit events
        if (this.config.emitEvents) {
            await this.emitMatchEnded(match);
            await this.emitSettlement(settlement);
        }

        if (status === MatchStatus.COMPLETED) {
            this.metrics.matchesCompleted++;
        } else {
            this.metrics.matchesFailed++;
        }

        return settlement;
    }

    /**
     * Handle user disconnect - end any active match
     */
    async handleUserDisconnect(sessionId: string): Promise<void> {
        const session = this.userPool.getSession(sessionId);
        if (session?.currentMatchId) {
            await this.endMatch(
                session.currentMatchId,
                MatchStatus.CANCELLED,
                MatchEndReason.USER_DISCONNECTED
            );
        }
        this.userPool.removeUser(sessionId);
    }

    /**
     * Prune expired bids and stale sessions
     */
    private prune(): void {
        const now = Date.now();
        const expiredBids = this.orderBook.pruneExpired(now);
        const staleSessions = this.userPool.pruneStale(now);

        if (expiredBids > 0 || staleSessions > 0) {
            console.log(
                `[Matcher] Pruned ${expiredBids} expired bids, ${staleSessions} stale sessions`
            );
        }
    }

    /**
     * Get a match by ID
     */
    getMatch(matchId: string): Match | null {
        return this.activeMatches.get(matchId) ?? null;
    }

    /**
     * Get all active matches
     */
    getActiveMatches(): Match[] {
        return [...this.activeMatches.values()];
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            activeMatches: this.activeMatches.size,
            pendingBids: this.orderBook.size,
            availableUsers: this.userPool.availableCount,
            totalUsers: this.userPool.size,
        };
    }

    // ============================================================
    // Event emission
    // ============================================================

    private async emitMatchAssigned(match: Match): Promise<void> {
        const event: MatchAssignedEvent = {
            type: 'match_assigned',
            timestamp: Date.now(),
            match,
        };
        try {
            await emitEvent(STREAM_MATCH_ASSIGNMENTS, event);
        } catch (err) {
            console.error('[Matcher] Failed to emit match_assigned:', err);
        }
    }

    private async emitMatchEnded(match: Match): Promise<void> {
        const event: MatchEndedEvent = {
            type: 'match_ended',
            timestamp: Date.now(),
            match,
        };
        try {
            await emitEvent(STREAM_MATCH_ASSIGNMENTS, event);
        } catch (err) {
            console.error('[Matcher] Failed to emit match_ended:', err);
        }
    }

    private async emitSettlement(instruction: SettlementInstruction): Promise<void> {
        const event: SettlementInstructionEvent = {
            type: 'settlement_instruction',
            timestamp: Date.now(),
            instruction,
        };
        try {
            await emitEvent(STREAM_SETTLEMENT_INSTRUCTIONS, event);
        } catch (err) {
            console.error('[Matcher] Failed to emit settlement:', err);
        }
    }
}
