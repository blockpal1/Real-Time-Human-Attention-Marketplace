/**
 * Redis Stream Keys - Central definition of all stream names used by the matching engine
 */

// ============================================================
// Input Streams (consumed by Matching Engine)
// ============================================================

/** Stream for incoming bids from agents via Backend API */
export const STREAM_BIDS_INCOMING = 'matching:bids:incoming';

/** Stream for user connection status changes */
export const STREAM_USER_STATUS = 'matching:users:status';

/** Stream for engagement events from user devices */
export const STREAM_ENGAGEMENT_EVENTS = 'matching:engagement:events';

// ============================================================
// Output Streams (produced by Matching Engine)
// ============================================================

/** Stream for match assignment notifications (consumed by WS layer) */
export const STREAM_MATCH_ASSIGNMENTS = 'matching:matches:assignments';

/** Stream for match status updates (consumed by WS layer) */
export const STREAM_MATCH_UPDATES = 'matching:matches:updates';

/** Stream for settlement instructions (consumed by Payment Router) */
export const STREAM_SETTLEMENT_INSTRUCTIONS = 'matching:settlements:instructions';

// ============================================================
// Consumer Groups
// ============================================================

/** Consumer group for the matching engine */
export const CONSUMER_GROUP_MATCHING_ENGINE = 'matching-engine-group';

/** Consumer name prefix - append instance ID for scaling */
export const CONSUMER_NAME_PREFIX = 'matcher-';

// ============================================================
// Keys for State Management
// ============================================================

/** Hash storing active bid data by bid ID */
export const KEY_ACTIVE_BIDS = 'matching:state:bids';

/** Hash storing active session data by session ID */
export const KEY_ACTIVE_SESSIONS = 'matching:state:sessions';

/** Hash storing active match data by match ID */
export const KEY_ACTIVE_MATCHES = 'matching:state:matches';

/** Sorted set of bids ordered by price (for quick ordering) */
export const KEY_BID_ORDER_BOOK = 'matching:orderbook:bids';

/** Set of available session IDs */
export const KEY_AVAILABLE_SESSIONS = 'matching:available:sessions';

/** Lock key prefix for distributed locking */
export const KEY_LOCK_PREFIX = 'matching:lock:';

// ============================================================
// Configuration
// ============================================================

/** Default block timeout for XREADGROUP in milliseconds */
export const STREAM_BLOCK_TIMEOUT_MS = 5;

/** Maximum messages to read per XREADGROUP call */
export const STREAM_READ_COUNT = 100;

/** Default message retention (7 days in milliseconds) */
export const STREAM_MAX_LEN = 100000;

/**
 * Get all input stream keys for consumer group initialization
 */
export function getInputStreams(): string[] {
    return [
        STREAM_BIDS_INCOMING,
        STREAM_USER_STATUS,
        STREAM_ENGAGEMENT_EVENTS,
    ];
}

/**
 * Get all output stream keys
 */
export function getOutputStreams(): string[] {
    return [
        STREAM_MATCH_ASSIGNMENTS,
        STREAM_MATCH_UPDATES,
        STREAM_SETTLEMENT_INSTRUCTIONS,
    ];
}
