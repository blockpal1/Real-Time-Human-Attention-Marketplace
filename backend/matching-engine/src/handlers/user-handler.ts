import { v4 as uuidv4 } from 'uuid';
import {
    StreamConsumer,
    StreamMessage,
    STREAM_USER_STATUS,
    STREAM_ENGAGEMENT_EVENTS,
} from '../infra';
import { StreamProducer } from '../infra/producer';
import { UserPool } from '../engine/user-pool';
import { Matcher } from '../engine/matcher';
import { UserSession, SessionStatus, CreateSessionInput } from '../types/session';
import {
    UserConnectedEvent,
    UserDisconnectedEvent,
    EngagementUpdateEvent,
} from '../types/events';
import { MatchEndReason, MatchStatus } from '../types/match';

/**
 * UserHandler - Consumes user connection and engagement events
 */
export class UserHandler {
    private statusConsumer: StreamConsumer;
    private engagementConsumer: StreamConsumer;
    private readonly userPool: UserPool;
    private readonly matcher: Matcher;

    /** Track engagement timing for verified seconds calculation */
    private lastEngagementTime: Map<string, number> = new Map();

    constructor(userPool: UserPool, matcher: Matcher) {
        this.userPool = userPool;
        this.matcher = matcher;

        this.statusConsumer = new StreamConsumer({
            streamKey: STREAM_USER_STATUS,
            consumerName: `user-status-handler-${process.pid}`,
        });

        this.engagementConsumer = new StreamConsumer({
            streamKey: STREAM_ENGAGEMENT_EVENTS,
            consumerName: `engagement-handler-${process.pid}`,
            blockMs: 5, // Very low block time for engagement events
        });
    }

    /**
     * Start consuming user events
     */
    async start(): Promise<void> {
        await this.statusConsumer.initialize();
        await this.engagementConsumer.initialize();

        console.log('[UserHandler] Starting status and engagement consumers');

        // Start both consumers in parallel
        this.statusConsumer.start(async (message) => {
            await this.handleStatusMessage(message);
        });

        this.engagementConsumer.start(async (message) => {
            await this.handleEngagementMessage(message);
        });
    }

    /**
     * Stop the consumers
     */
    async stop(): Promise<void> {
        await Promise.all([
            this.statusConsumer.stop(),
            this.engagementConsumer.stop(),
        ]);
    }

    /**
     * Handle user status messages (connect/disconnect)
     */
    private async handleStatusMessage(message: StreamMessage): Promise<void> {
        const { type } = message.fields;

        switch (type) {
            case 'user_connected':
                await this.handleUserConnected(message);
                break;
            case 'user_disconnected':
                await this.handleUserDisconnected(message);
                break;
            default:
                console.warn(`[UserHandler] Unknown status event type: ${type}`);
        }
    }

    /**
     * Handle user connection
     */
    private async handleUserConnected(message: StreamMessage): Promise<void> {
        try {
            const event = StreamProducer.parseEvent<UserConnectedEvent>(message.fields);
            const { session: input } = event;

            // Create full session object
            const now = Date.now();
            const session: UserSession = {
                sessionId: input.sessionId || uuidv4(),
                userPubkey: input.userPubkey,
                priceFloorMicros: input.priceFloorMicros,
                currentMatchId: null,
                lastEngagementScore: 0,
                lastLivenessScore: 0,
                connectedAt: now,
                lastHeartbeat: now,
                status: SessionStatus.AVAILABLE,
            };

            // Validate session
            if (!this.validateSession(session)) {
                console.warn(`[UserHandler] Invalid session rejected: ${session.sessionId}`);
                return;
            }

            // Add to user pool
            this.userPool.addUser(session);
            this.lastEngagementTime.set(session.sessionId, now);

            console.log(
                `[UserHandler] User connected: ${session.sessionId} (floor: ${session.priceFloorMicros})`
            );
        } catch (err) {
            console.error('[UserHandler] Error handling user_connected:', err);
        }
    }

    /**
     * Handle user disconnection
     */
    private async handleUserDisconnected(message: StreamMessage): Promise<void> {
        try {
            const event = StreamProducer.parseEvent<UserDisconnectedEvent>(message.fields);

            // Clean up and potentially end match
            await this.matcher.handleUserDisconnect(event.sessionId);
            this.lastEngagementTime.delete(event.sessionId);

            console.log(`[UserHandler] User disconnected: ${event.sessionId}`);
        } catch (err) {
            console.error('[UserHandler] Error handling user_disconnected:', err);
        }
    }

    /**
     * Handle engagement update messages
     */
    private async handleEngagementMessage(message: StreamMessage): Promise<void> {
        try {
            const event = StreamProducer.parseEvent<EngagementUpdateEvent>(message.fields);
            const { update } = event;

            const now = Date.now();
            const lastTime = this.lastEngagementTime.get(update.sessionId) ?? now;
            const durationSeconds = (now - lastTime) / 1000;

            // Update the matcher with engagement data
            this.matcher.processEngagement(
                update.sessionId,
                update.attentionScore,
                update.livenessScore,
                durationSeconds
            );

            // Update timing
            this.lastEngagementTime.set(update.sessionId, now);
        } catch (err) {
            console.error('[UserHandler] Error handling engagement_update:', err);
        }
    }

    /**
     * Validate a session before adding to pool
     */
    private validateSession(session: UserSession): boolean {
        // Pubkey must be present
        if (!session.userPubkey || session.userPubkey.length === 0) return false;

        // Price floor must be non-negative
        if (session.priceFloorMicros < 0) return false;

        return true;
    }

    /**
     * Manually add a user session (for testing or direct API calls)
     */
    addUserDirect(input: CreateSessionInput): UserSession {
        const now = Date.now();
        const session: UserSession = {
            sessionId: uuidv4(),
            userPubkey: input.userPubkey,
            priceFloorMicros: input.priceFloorMicros,
            currentMatchId: null,
            lastEngagementScore: 0.5, // Default moderate engagement
            lastLivenessScore: 1.0, // Assume alive
            connectedAt: now,
            lastHeartbeat: now,
            status: SessionStatus.AVAILABLE,
        };

        if (!this.validateSession(session)) {
            throw new Error('Invalid session parameters');
        }

        this.userPool.addUser(session);
        this.lastEngagementTime.set(session.sessionId, now);
        return session;
    }

    /**
     * Manually process an engagement update (for testing)
     */
    processEngagementDirect(
        sessionId: string,
        attentionScore: number,
        livenessScore: number
    ): void {
        const now = Date.now();
        const lastTime = this.lastEngagementTime.get(sessionId) ?? now;
        const durationSeconds = (now - lastTime) / 1000;

        this.matcher.processEngagement(
            sessionId,
            attentionScore,
            livenessScore,
            durationSeconds
        );

        this.lastEngagementTime.set(sessionId, now);
    }
}
