import { Redis } from 'ioredis';
import { getRedisClient } from './redis-client';
import { STREAM_MAX_LEN } from './stream-keys';
import { BaseEvent } from '../types/events';

export interface ProducerOptions {
    /** Maximum stream length (auto-trim) */
    maxLen?: number;
    /** Use approximate trimming for better performance */
    approximate?: boolean;
}

/**
 * Redis Stream Producer - utility for emitting events to streams
 */
export class StreamProducer {
    private client: Redis | null = null;
    private readonly options: Required<ProducerOptions>;

    constructor(options: ProducerOptions = {}) {
        this.options = {
            maxLen: options.maxLen ?? STREAM_MAX_LEN,
            approximate: options.approximate ?? true,
        };
    }

    /**
     * Initialize the producer
     */
    async initialize(): Promise<void> {
        this.client = await getRedisClient();
    }

    /**
     * Emit an event to a stream
     * @returns The stream message ID
     */
    async emit(streamKey: string, event: BaseEvent): Promise<string> {
        if (!this.client) {
            await this.initialize();
        }
        if (!this.client) throw new Error('Producer not initialized');

        // Convert event to flat key-value pairs
        const fields = this.eventToFields(event);

        // XADD with MAXLEN for auto-trimming
        const id = await this.client.xadd(
            streamKey,
            'MAXLEN',
            this.options.approximate ? '~' : '=',
            this.options.maxLen.toString(),
            '*', // Auto-generate ID
            ...fields
        );

        return id as string;
    }

    /**
     * Emit multiple events in a pipeline for better throughput
     */
    async emitBatch(
        items: Array<{ streamKey: string; event: BaseEvent }>
    ): Promise<string[]> {
        if (!this.client) {
            await this.initialize();
        }
        if (!this.client) throw new Error('Producer not initialized');

        const pipeline = this.client.pipeline();

        for (const { streamKey, event } of items) {
            const fields = this.eventToFields(event);
            pipeline.xadd(
                streamKey,
                'MAXLEN',
                this.options.approximate ? '~' : '=',
                this.options.maxLen.toString(),
                '*',
                ...fields
            );
        }

        const results = await pipeline.exec();
        if (!results) return [];

        return results.map(([err, id]) => {
            if (err) throw err;
            return id as string;
        });
    }

    /**
     * Convert event object to flat array for XADD
     */
    private eventToFields(event: BaseEvent): string[] {
        const fields: string[] = [];

        // Add type and timestamp explicitly
        fields.push('type', event.type);
        fields.push('timestamp', event.timestamp.toString());

        // Serialize the rest as JSON in a 'data' field
        const { type, timestamp, eventId, ...rest } = event;
        if (Object.keys(rest).length > 0) {
            fields.push('data', JSON.stringify(rest));
        }

        return fields;
    }

    /**
     * Parse fields back to event (used by consumers)
     */
    static parseEvent<T extends BaseEvent>(
        fields: Record<string, string>
    ): T {
        const event: Record<string, unknown> = {
            type: fields.type,
            timestamp: parseInt(fields.timestamp, 10),
        };

        if (fields.data) {
            const data = JSON.parse(fields.data);
            Object.assign(event, data);
        }

        return event as T;
    }
}

// Singleton producer instance
let producerInstance: StreamProducer | null = null;

/**
 * Get or create the singleton producer
 */
export async function getProducer(): Promise<StreamProducer> {
    if (!producerInstance) {
        producerInstance = new StreamProducer();
        await producerInstance.initialize();
    }
    return producerInstance;
}

/**
 * Convenience function to emit a single event
 */
export async function emitEvent(
    streamKey: string,
    event: BaseEvent
): Promise<string> {
    const producer = await getProducer();
    return producer.emit(streamKey, event);
}
