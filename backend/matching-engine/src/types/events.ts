import { Bid, CreateBidInput } from './bid';
import { UserSession, CreateSessionInput, EngagementUpdate } from './session';
import { Match, SettlementInstruction } from './match';

/**
 * Base event interface for all Redis stream events
 */
export interface BaseEvent {
    /** Event type discriminator */
    type: string;
    /** Unix timestamp of event creation */
    timestamp: number;
    /** Unique event ID (usually Redis stream ID) */
    eventId?: string;
}

// ============================================================
// Incoming Events (consumed by Matching Engine)
// ============================================================

/**
 * Emitted when an agent creates a new bid
 */
export interface BidCreatedEvent extends BaseEvent {
    type: 'bid_created';
    bid: CreateBidInput & { bidId: string };
}

/**
 * Emitted when a user connects and starts a session
 */
export interface UserConnectedEvent extends BaseEvent {
    type: 'user_connected';
    session: CreateSessionInput & { sessionId: string };
}

/**
 * Emitted when a user disconnects
 */
export interface UserDisconnectedEvent extends BaseEvent {
    type: 'user_disconnected';
    sessionId: string;
    reason?: string;
}

/**
 * Emitted on each engagement measurement from the user
 */
export interface EngagementUpdateEvent extends BaseEvent {
    type: 'engagement_update';
    update: EngagementUpdate;
}

/**
 * Emitted when an agent cancels a bid
 */
export interface BidCancelledEvent extends BaseEvent {
    type: 'bid_cancelled';
    bidId: string;
    agentPubkey: string;
}

// ============================================================
// Outgoing Events (produced by Matching Engine)
// ============================================================

/**
 * Emitted when a match is successfully created
 */
export interface MatchAssignedEvent extends BaseEvent {
    type: 'match_assigned';
    match: Match;
}

/**
 * Emitted when a match ends and settlement is needed
 */
export interface MatchEndedEvent extends BaseEvent {
    type: 'match_ended';
    match: Match;
}

/**
 * Emitted to the Payment Router for settlement
 */
export interface SettlementInstructionEvent extends BaseEvent {
    type: 'settlement_instruction';
    instruction: SettlementInstruction;
}

/**
 * Emitted to notify WS layer of match status changes
 */
export interface MatchStatusUpdateEvent extends BaseEvent {
    type: 'match_status_update';
    matchId: string;
    status: string;
    verifiedSeconds: number;
    accumulatedAmount: number;
}

// ============================================================
// Union Types
// ============================================================

export type IncomingEvent =
    | BidCreatedEvent
    | UserConnectedEvent
    | UserDisconnectedEvent
    | EngagementUpdateEvent
    | BidCancelledEvent;

export type OutgoingEvent =
    | MatchAssignedEvent
    | MatchEndedEvent
    | SettlementInstructionEvent
    | MatchStatusUpdateEvent;

export type MatchingEngineEvent = IncomingEvent | OutgoingEvent;
