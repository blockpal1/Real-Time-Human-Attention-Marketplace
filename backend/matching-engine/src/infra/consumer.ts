import { Redis } from 'ioredis';
import { createBlockingClient } from './redis-client';
import {
    CONSUMER_GROUP_MATCHING_ENGINE,
    CONSUMER_NAME_PREFIX,
    STREAM_BLOCK_TIMEOUT_MS,
    STREAM_READ_COUNT,
} from './stream-keys';

export interface StreamMessage {
    id: string;
    fields: Record<string, string>;
}

export interface ConsumerOptions {
    /** Stream key to consume from */
    streamKey: string;
    /** Consumer group name */
    groupName?: string;
    /** Consumer name (unique within group) */
    consumerName?: string;
    /** Block timeout in milliseconds (lower = less latency, more CPU) */
    blockMs?: number;
    /** Number of messages to read per call */
    count?: number;
    /** Start from '0' for beginning, '$' for new messages only, or specific ID */
    startId?: string;
}

// Type for xreadgroup result
type XReadGroupResult = [string, [string, string[]][]][] | null;

/**
 * Redis Stream Consumer - base class for consuming from Redis streams
 * Uses XREADGROUP for reliable, at-least-once delivery with consumer groups
 */
export class StreamConsumer {
    private client: Redis | null = null;
    private running = false;
    private readonly options: Required<ConsumerOptions>;

    constructor(options: ConsumerOptions) {
        this.options = {
            streamKey: options.streamKey,
            groupName: options.groupName || CONSUMER_GROUP_MATCHING_ENGINE,
            consumerName: options.consumerName || `${CONSUMER_NAME_PREFIX}${process.pid}`,
            blockMs: options.blockMs ?? STREAM_BLOCK_TIMEOUT_MS,
            count: options.count ?? STREAM_READ_COUNT,
            startId: options.startId || '$',
        };
    }

    /**
     * Initialize the consumer - creates group if needed
     */
    async initialize(): Promise<void> {
        this.client = await createBlockingClient();
        await this.ensureConsumerGroup();
    }

    /**
     * Create consumer group if it doesn't exist
     */
    private async ensureConsumerGroup(): Promise<void> {
        if (!this.client) throw new Error('Consumer not initialized');

        try {
            await this.client.xgroup(
                'CREATE',
                this.options.streamKey,
                this.options.groupName,
                this.options.startId,
                'MKSTREAM'
            );
            console.log(
                `[Consumer] Created group '${this.options.groupName}' on stream '${this.options.streamKey}'`
            );
        } catch (err: unknown) {
            // Group already exists is fine
            if (err instanceof Error && err.message.includes('BUSYGROUP')) {
                console.log(
                    `[Consumer] Group '${this.options.groupName}' already exists on '${this.options.streamKey}'`
                );
            } else {
                throw err;
            }
        }
    }

    /**
     * Start consuming messages - calls handler for each message
     */
    async start(
        handler: (message: StreamMessage) => Promise<void>
    ): Promise<void> {
        if (!this.client) {
            await this.initialize();
        }
        if (!this.client) throw new Error('Failed to initialize consumer');

        this.running = true;
        console.log(`[Consumer] Starting on stream '${this.options.streamKey}'`);

        // First, claim any pending messages (from crashes)
        await this.processPending(handler);

        // Main consumption loop
        while (this.running) {
            try {
                // Use call to bypass strict type checking for Redis commands
                const result = await this.client.call(
                    'XREADGROUP',
                    'GROUP',
                    this.options.groupName,
                    this.options.consumerName,
                    'BLOCK',
                    this.options.blockMs.toString(),
                    'COUNT',
                    this.options.count.toString(),
                    'STREAMS',
                    this.options.streamKey,
                    '>'
                ) as XReadGroupResult;

                if (result) {
                    for (const [, messages] of result) {
                        for (const [id, fields] of messages) {
                            const message: StreamMessage = {
                                id,
                                fields: this.arrayToObject(fields),
                            };

                            try {
                                await handler(message);
                                // Acknowledge successful processing
                                await this.client.xack(
                                    this.options.streamKey,
                                    this.options.groupName,
                                    id
                                );
                            } catch (handlerErr) {
                                console.error(
                                    `[Consumer] Handler error for message ${id}:`,
                                    handlerErr
                                );
                                // Don't ack - message will be retried
                            }
                        }
                    }
                }
            } catch (err) {
                if (this.running) {
                    console.error('[Consumer] Read error:', err);
                    // Brief pause before retry
                    await this.sleep(100);
                }
            }
        }
    }

    /**
     * Process any pending messages (from previous crashes)
     */
    private async processPending(
        handler: (message: StreamMessage) => Promise<void>
    ): Promise<void> {
        if (!this.client) return;

        try {
            const pending = await this.client.xpending(
                this.options.streamKey,
                this.options.groupName
            ) as unknown[];

            if (pending && Array.isArray(pending) && (pending[0] as number) > 0) {
                console.log(
                    `[Consumer] Processing ${pending[0]} pending messages`
                );

                const result = await this.client.call(
                    'XREADGROUP',
                    'GROUP',
                    this.options.groupName,
                    this.options.consumerName,
                    'COUNT',
                    this.options.count.toString(),
                    'STREAMS',
                    this.options.streamKey,
                    '0'
                ) as XReadGroupResult;

                if (result) {
                    for (const [, messages] of result) {
                        for (const [id, fields] of messages) {
                            if (fields) {
                                const message: StreamMessage = {
                                    id,
                                    fields: this.arrayToObject(fields),
                                };
                                await handler(message);
                                await this.client.xack(
                                    this.options.streamKey,
                                    this.options.groupName,
                                    id
                                );
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Consumer] Error processing pending:', err);
        }
    }

    /**
     * Stop the consumer gracefully
     */
    async stop(): Promise<void> {
        this.running = false;
        if (this.client) {
            await this.client.quit();
            this.client = null;
        }
        console.log(`[Consumer] Stopped on stream '${this.options.streamKey}'`);
    }

    /**
     * Convert ioredis field array to object
     */
    private arrayToObject(arr: string[]): Record<string, string> {
        const obj: Record<string, string> = {};
        for (let i = 0; i < arr.length; i += 2) {
            obj[arr[i]] = arr[i + 1];
        }
        return obj;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
