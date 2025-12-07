/**
 * User Session Interface - Represents a human seller's active session
 */
export interface UserSession {
    /** Unique session identifier */
    sessionId: string;

    /** Solana public key of the user */
    userPubkey: string;

    /** Minimum price the user accepts per second in micro-USDC */
    priceFloorMicros: number;

    /** Current match ID if assigned, null if available */
    currentMatchId: string | null;

    /** Most recent engagement score (0.0 - 1.0) */
    lastEngagementScore: number;

    /** Most recent liveness score (0.0 - 1.0) */
    lastLivenessScore: number;

    /** Unix timestamp when the session was established */
    connectedAt: number;

    /** Unix timestamp of last heartbeat */
    lastHeartbeat: number;

    /** Session status */
    status: SessionStatus;
}

export enum SessionStatus {
    /** User is connected and available for matching */
    AVAILABLE = 'available',
    /** User is currently engaged in a matched task */
    BUSY = 'busy',
    /** User has disconnected */
    DISCONNECTED = 'disconnected',
}

/**
 * Input for creating a new session
 */
export interface CreateSessionInput {
    userPubkey: string;
    priceFloorMicros: number;
    deviceAttestation?: string;
}

/**
 * Engagement update from the user's device
 */
export interface EngagementUpdate {
    sessionId: string;
    seq: number;
    timestamp: number;
    attentionScore: number;
    livenessScore: number;
    isHuman: number;
    signature?: string;
}
