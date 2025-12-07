import Redis, { Redis as RedisClient } from 'ioredis';

export interface RedisConfig {
    url?: string;
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number;
    enableReadyCheck?: boolean;
    lazyConnect?: boolean;
}

/**
 * Singleton Redis client wrapper for the matching engine
 */
class RedisClientManager {
    private static instance: RedisClientManager;
    private client: RedisClient | null = null;
    private config: RedisConfig;

    private constructor() {
        this.config = {
            url: process.env.REDIS_URL,
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: process.env.REDIS_PASSWORD,
            db: parseInt(process.env.REDIS_DB || '0', 10),
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true,
        };
    }

    static getInstance(): RedisClientManager {
        if (!RedisClientManager.instance) {
            RedisClientManager.instance = new RedisClientManager();
        }
        return RedisClientManager.instance;
    }

    /**
     * Get or create the Redis client connection
     */
    async getClient(): Promise<RedisClient> {
        if (this.client && this.client.status === 'ready') {
            return this.client;
        }

        if (this.config.url) {
            this.client = new Redis(this.config.url, {
                maxRetriesPerRequest: this.config.maxRetriesPerRequest,
                enableReadyCheck: this.config.enableReadyCheck,
                lazyConnect: this.config.lazyConnect,
            });
        } else {
            this.client = new Redis({
                host: this.config.host,
                port: this.config.port,
                password: this.config.password,
                db: this.config.db,
                maxRetriesPerRequest: this.config.maxRetriesPerRequest,
                enableReadyCheck: this.config.enableReadyCheck,
                lazyConnect: this.config.lazyConnect,
            });
        }

        // Set up event handlers
        this.client.on('error', (err) => {
            console.error('[Redis] Connection error:', err.message);
        });

        this.client.on('connect', () => {
            console.log('[Redis] Connected successfully');
        });

        this.client.on('ready', () => {
            console.log('[Redis] Ready to accept commands');
        });

        this.client.on('close', () => {
            console.log('[Redis] Connection closed');
        });

        this.client.on('reconnecting', () => {
            console.log('[Redis] Reconnecting...');
        });

        // Connect
        await this.client.connect();
        return this.client;
    }

    /**
     * Create a duplicate connection for blocking operations
     */
    async createDuplicateClient(): Promise<RedisClient> {
        const mainClient = await this.getClient();
        return mainClient.duplicate();
    }

    /**
     * Gracefully close the connection
     */
    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.client = null;
        }
    }

    /**
     * Override configuration (useful for testing)
     */
    setConfig(config: Partial<RedisConfig>): void {
        this.config = { ...this.config, ...config };
    }
}

export const redisManager = RedisClientManager.getInstance();

/**
 * Helper to get a Redis client directly
 */
export async function getRedisClient(): Promise<RedisClient> {
    return redisManager.getClient();
}

/**
 * Helper to create a blocking client for stream consumers
 */
export async function createBlockingClient(): Promise<RedisClient> {
    return redisManager.createDuplicateClient();
}
