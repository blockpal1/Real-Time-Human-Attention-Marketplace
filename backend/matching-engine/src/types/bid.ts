/**
 * Bid Interface - Represents an AI agent's bid for human attention
 */
export interface Bid {
    /** Unique identifier for the bid */
    bidId: string;

    /** Solana public key of the agent placing the bid */
    agentPubkey: string;

    /** Optional target URL the user should be viewing */
    targetUrl?: string;

    /** Maximum price willing to pay per second in micro-USDC */
    maxPricePerSecond: number;

    /** Minimum engagement score required (0.0 - 1.0) */
    requiredAttentionScore: number;

    /** Minimum attention duration required in seconds */
    minAttentionSeconds: number;

    /** Unix timestamp when the bid expires */
    expiryTimestamp: number;

    /** Unix timestamp when the bid was created */
    createdAt: number;

    /** Current status of the bid */
    status: BidStatus;
}

export enum BidStatus {
    /** Bid is active and awaiting a match */
    PENDING = 'pending',
    /** Bid has been matched to a user */
    MATCHED = 'matched',
    /** Bid has expired without a match */
    EXPIRED = 'expired',
    /** Bid has been cancelled by the agent */
    CANCELLED = 'cancelled',
}

/**
 * Input for creating a new bid
 */
export interface CreateBidInput {
    agentPubkey: string;
    targetUrl?: string;
    maxPricePerSecond: number;
    requiredAttentionScore: number;
    minAttentionSeconds?: number;
    expirySeconds?: number;
}
