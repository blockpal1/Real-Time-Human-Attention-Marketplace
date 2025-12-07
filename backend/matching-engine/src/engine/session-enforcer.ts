import { UserSession, SessionStatus } from '../types/session';
import { Bid, BidStatus } from '../types/bid';
import { Match, MatchStatus } from '../types/match';

/**
 * Validation result for session enforcement
 */
export interface ValidationResult {
    valid: boolean;
    reason?: string;
}

/**
 * Configuration for session enforcement rules
 */
export interface EnforcerConfig {
    /** Minimum attention duration required in seconds */
    minAttentionSeconds: number;
    /** Heartbeat timeout in milliseconds */
    heartbeatTimeoutMs: number;
    /** Minimum engagement score to maintain match */
    minEngagementScore: number;
    /** Minimum liveness score to maintain match */
    minLivenessScore: number;
    /** Grace period for low engagement before terminating (seconds) */
    lowEngagementGracePeriodSec: number;
}

const DEFAULT_CONFIG: EnforcerConfig = {
    minAttentionSeconds: 5,
    heartbeatTimeoutMs: 30000,
    minEngagementScore: 0.3,
    minLivenessScore: 0.5,
    lowEngagementGracePeriodSec: 3,
};

/**
 * SessionEnforcer - Enforces matching rules and session integrity
 * 
 * Rules enforced:
 * 1. One task per user at a time
 * 2. Price-per-second validation
 * 3. Session connectivity/heartbeat
 * 4. Minimum attention duration
 * 5. Engagement threshold maintenance
 */
export class SessionEnforcer {
    private readonly config: EnforcerConfig;

    /** Track low engagement start times for grace period */
    private lowEngagementStart: Map<string, number> = new Map();

    constructor(config: Partial<EnforcerConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Validate if a session can be matched with a bid
     */
    canMatch(session: UserSession, bid: Bid, now: number = Date.now()): ValidationResult {
        // Rule 1: One task per user
        if (session.currentMatchId !== null) {
            return {
                valid: false,
                reason: `Session ${session.sessionId} already has active match ${session.currentMatchId}`,
            };
        }

        // Rule 1b: Session must be available
        if (session.status !== SessionStatus.AVAILABLE) {
            return {
                valid: false,
                reason: `Session ${session.sessionId} is not available (status: ${session.status})`,
            };
        }

        // Rule 2: Price validation
        if (bid.maxPricePerSecond < session.priceFloorMicros) {
            return {
                valid: false,
                reason: `Bid price ${bid.maxPricePerSecond} is below session floor ${session.priceFloorMicros}`,
            };
        }

        // Rule 3: Session connectivity (heartbeat check)
        const heartbeatAge = now - session.lastHeartbeat;
        if (heartbeatAge > this.config.heartbeatTimeoutMs) {
            return {
                valid: false,
                reason: `Session ${session.sessionId} heartbeat stale (${heartbeatAge}ms old)`,
            };
        }

        // Rule 4: Minimum attention duration
        const requiredDuration = bid.minAttentionSeconds || this.config.minAttentionSeconds;
        if (requiredDuration < this.config.minAttentionSeconds) {
            return {
                valid: false,
                reason: `Bid requires ${requiredDuration}s but minimum is ${this.config.minAttentionSeconds}s`,
            };
        }

        // Rule 5: Bid must be pending
        if (bid.status !== BidStatus.PENDING) {
            return {
                valid: false,
                reason: `Bid ${bid.bidId} is not pending (status: ${bid.status})`,
            };
        }

        // Rule 6: Bid must not be expired
        if (bid.expiryTimestamp <= now) {
            return {
                valid: false,
                reason: `Bid ${bid.bidId} has expired`,
            };
        }

        return { valid: true };
    }

    /**
     * Validate if an active match should continue
     */
    shouldContinueMatch(
        match: Match,
        session: UserSession,
        now: number = Date.now()
    ): ValidationResult {
        // Match must be active
        if (match.status !== MatchStatus.ACTIVE) {
            return {
                valid: false,
                reason: `Match ${match.matchId} is not active`,
            };
        }

        // Session must be connected
        if (session.status === SessionStatus.DISCONNECTED) {
            return {
                valid: false,
                reason: 'User disconnected',
            };
        }

        // Heartbeat check
        const heartbeatAge = now - session.lastHeartbeat;
        if (heartbeatAge > this.config.heartbeatTimeoutMs) {
            return {
                valid: false,
                reason: `Session heartbeat stale (${heartbeatAge}ms)`,
            };
        }

        // Engagement score check with grace period
        if (session.lastEngagementScore < this.config.minEngagementScore) {
            const lowStart = this.lowEngagementStart.get(match.matchId);

            if (!lowStart) {
                // Start grace period
                this.lowEngagementStart.set(match.matchId, now);
            } else {
                const gracePeriodMs = this.config.lowEngagementGracePeriodSec * 1000;
                if (now - lowStart > gracePeriodMs) {
                    return {
                        valid: false,
                        reason: `Engagement score ${session.lastEngagementScore} below threshold for too long`,
                    };
                }
            }
        } else {
            // Reset grace period if engagement recovered
            this.lowEngagementStart.delete(match.matchId);
        }

        // Liveness check
        if (session.lastLivenessScore < this.config.minLivenessScore) {
            return {
                valid: false,
                reason: `Liveness score ${session.lastLivenessScore} below threshold`,
            };
        }

        return { valid: true };
    }

    /**
     * Calculate the agreed price for a match
     * Uses the bid's max price (could implement more complex pricing later)
     */
    calculateAgreedPrice(session: UserSession, bid: Bid): number {
        // For now, use the bid's max price
        // Future: could implement dynamic pricing based on supply/demand
        return bid.maxPricePerSecond;
    }

    /**
     * Calculate settlement amount for a match
     */
    calculateSettlement(match: Match): number {
        return match.verifiedSeconds * match.agreedPricePerSecond;
    }

    /**
     * Validate minimum engagement score requirement from bid
     */
    meetsEngagementRequirement(session: UserSession, bid: Bid): boolean {
        return session.lastEngagementScore >= bid.requiredAttentionScore;
    }

    /**
     * Clear any tracked state for a match (call when match ends)
     */
    clearMatchState(matchId: string): void {
        this.lowEngagementStart.delete(matchId);
    }

    /**
     * Get current config
     */
    getConfig(): EnforcerConfig {
        return { ...this.config };
    }
}
