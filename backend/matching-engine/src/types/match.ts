/**
 * Match Interface - Represents a successful pairing of bid and user
 */
export interface Match {
    /** Unique match identifier */
    matchId: string;

    /** The bid that was matched */
    bidId: string;

    /** The session that was matched */
    sessionId: string;

    /** Agent's public key (from bid) */
    agentPubkey: string;

    /** User's public key (from session) */
    userPubkey: string;

    /** Final agreed price per second in micro-USDC */
    agreedPricePerSecond: number;

    /** Unix timestamp when match was created */
    startedAt: number;

    /** Total verified attention seconds so far */
    verifiedSeconds: number;

    /** Running total of accumulated earnings in micro-USDC */
    accumulatedAmount: number;

    /** Match status */
    status: MatchStatus;

    /** Unix timestamp when match ended (if ended) */
    endedAt?: number;

    /** Reason for ending */
    endReason?: MatchEndReason;
}

export enum MatchStatus {
    /** Match is active, user is providing attention */
    ACTIVE = 'active',
    /** Match completed successfully */
    COMPLETED = 'completed',
    /** Match was cancelled */
    CANCELLED = 'cancelled',
    /** Match failed (e.g., engagement dropped below threshold) */
    FAILED = 'failed',
}

export enum MatchEndReason {
    /** User completed the required attention duration */
    DURATION_MET = 'duration_met',
    /** User disconnected */
    USER_DISCONNECTED = 'user_disconnected',
    /** Engagement score dropped below required threshold */
    LOW_ENGAGEMENT = 'low_engagement',
    /** Agent cancelled the bid */
    AGENT_CANCELLED = 'agent_cancelled',
    /** Bid expired */
    BID_EXPIRED = 'bid_expired',
    /** Escrow funds depleted */
    ESCROW_DEPLETED = 'escrow_depleted',
}

/**
 * Settlement instruction to be sent to Payment Router
 */
export interface SettlementInstruction {
    /** Match ID being settled */
    matchId: string;

    /** Agent's escrow account */
    escrowAccount: string;

    /** User's wallet to receive payment */
    userWallet: string;

    /** Total verified attention seconds */
    verifiedSeconds: number;

    /** Agreed price per second in micro-USDC */
    agreedPricePerSecond: number;

    /** Total amount to transfer in micro-USDC */
    totalAmount: number;

    /** Nonce for replay protection */
    nonce: number;

    /** Unix timestamp of settlement creation */
    createdAt: number;
}
