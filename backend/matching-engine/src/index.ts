import {
    redisManager,
    getRedisClient,
    getInputStreams,
    CONSUMER_GROUP_MATCHING_ENGINE,
} from './infra';
import { OrderBook, UserPool, SessionEnforcer, Matcher } from './engine';
import { BidHandler, UserHandler } from './handlers';

// Re-export all types and modules
export * from './types';
export * from './infra';
export * from './engine';
export * from './handlers';

/**
 * MatchingEngine - Main entry point for the matching engine service
 */
export class MatchingEngine {
    private readonly orderBook: OrderBook;
    private readonly userPool: UserPool;
    private readonly enforcer: SessionEnforcer;
    private readonly matcher: Matcher;
    private readonly bidHandler: BidHandler;
    private readonly userHandler: UserHandler;

    private running = false;

    constructor() {
        // Initialize components
        this.orderBook = new OrderBook();
        this.userPool = new UserPool();
        this.enforcer = new SessionEnforcer();
        this.matcher = new Matcher(this.orderBook, this.userPool, this.enforcer);

        // Initialize handlers
        this.bidHandler = new BidHandler(this.orderBook);
        this.userHandler = new UserHandler(this.userPool, this.matcher);
    }

    /**
     * Initialize Redis and create consumer groups
     */
    async initialize(): Promise<void> {
        console.log('[MatchingEngine] Initializing...');

        const client = await getRedisClient();

        // Create consumer groups for input streams
        for (const streamKey of getInputStreams()) {
            try {
                await client.xgroup(
                    'CREATE',
                    streamKey,
                    CONSUMER_GROUP_MATCHING_ENGINE,
                    '$',
                    'MKSTREAM'
                );
                console.log(`[MatchingEngine] Created consumer group for ${streamKey}`);
            } catch (err: unknown) {
                if (err instanceof Error && err.message.includes('BUSYGROUP')) {
                    console.log(`[MatchingEngine] Consumer group already exists for ${streamKey}`);
                } else {
                    throw err;
                }
            }
        }

        console.log('[MatchingEngine] Initialization complete');
    }

    /**
     * Start the matching engine
     */
    async start(): Promise<void> {
        if (this.running) {
            console.warn('[MatchingEngine] Already running');
            return;
        }

        console.log('[MatchingEngine] Starting...');

        // Start handlers
        await this.bidHandler.start();
        await this.userHandler.start();

        // Start matcher
        this.matcher.start();

        this.running = true;
        console.log('[MatchingEngine] Started successfully');
    }

    /**
     * Stop the matching engine gracefully
     */
    async stop(): Promise<void> {
        if (!this.running) return;

        console.log('[MatchingEngine] Stopping...');

        // Stop in reverse order
        this.matcher.stop();
        await this.bidHandler.stop();
        await this.userHandler.stop();

        // Disconnect Redis
        await redisManager.disconnect();

        this.running = false;
        console.log('[MatchingEngine] Stopped');
    }

    /**
     * Get the current metrics
     */
    getMetrics() {
        return this.matcher.getMetrics();
    }

    /**
     * Get components for testing/direct access
     */
    getComponents() {
        return {
            orderBook: this.orderBook,
            userPool: this.userPool,
            enforcer: this.enforcer,
            matcher: this.matcher,
            bidHandler: this.bidHandler,
            userHandler: this.userHandler,
        };
    }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
    const engine = new MatchingEngine();

    // Setup graceful shutdown
    const shutdown = async (signal: string) => {
        console.log(`\n[Main] Received ${signal}, shutting down...`);
        await engine.stop();
        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    try {
        await engine.initialize();
        await engine.start();

        // Log metrics periodically
        setInterval(() => {
            const metrics = engine.getMetrics();
            console.log('[Metrics]', JSON.stringify(metrics));
        }, 10000);

        console.log('[Main] Matching engine is running. Press Ctrl+C to stop.');
    } catch (err) {
        console.error('[Main] Failed to start:', err);
        process.exit(1);
    }
}

// Run if this is the main module
if (require.main === module) {
    main();
}
