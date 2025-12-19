import { redisClient } from '../utils/redis';

export interface PlatformConfig {
    mode: 'beta' | 'hybrid' | 'live';
    fee_total: number;      // 0.15 (15%) - Total platform take
    fee_protocol: number;   // 0.12 (12%) - Goes to protocol:revenue
    fee_builder: number;    // 0.03 (3%)  - Goes to builder:{code}:balance
    min_version: string;
}

export interface FeeBreakdown {
    total: number;
    protocol: number;
    builder: number;
    workerMultiplier: number; // 1 - fee_total (what worker keeps)
}

const CONFIG_KEY = 'system:config';
const DEFAULT_CONFIG: PlatformConfig = {
    mode: 'beta',
    fee_total: 0.15,
    fee_protocol: 0.12,
    fee_builder: 0.03,
    min_version: '1.0.0'
};

/**
 * ConfigService - Dynamic platform configuration from Redis
 * 
 * Key: system:config (Hash)
 * Fields: mode, fee_total, fee_protocol, fee_builder, min_version
 * 
 * Enables dynamic fee/mode changes without deployment.
 */
class ConfigService {
    private static instance: ConfigService;
    private cache: PlatformConfig | null = null;
    private cacheExpiry: number = 0;
    private cacheTTL: number = 30_000; // 30 seconds cache

    private constructor() { }

    static getInstance(): ConfigService {
        if (!ConfigService.instance) {
            ConfigService.instance = new ConfigService();
        }
        return ConfigService.instance;
    }

    /**
     * Get current platform config (cached)
     */
    async getConfig(): Promise<PlatformConfig> {
        const now = Date.now();

        // Return cached if valid
        if (this.cache && now < this.cacheExpiry) {
            return this.cache;
        }

        // Fetch from Redis
        try {
            if (!redisClient.isOpen) {
                console.warn('[ConfigService] Redis not connected, using defaults');
                return DEFAULT_CONFIG;
            }

            const data = await redisClient.client.hGetAll(CONFIG_KEY);

            if (Object.keys(data).length === 0) {
                // Initialize with defaults if not exists
                await this.setConfig(DEFAULT_CONFIG);
                return DEFAULT_CONFIG;
            }

            this.cache = {
                mode: (data.mode as PlatformConfig['mode']) || DEFAULT_CONFIG.mode,
                fee_total: parseFloat(data.fee_total) || DEFAULT_CONFIG.fee_total,
                fee_protocol: parseFloat(data.fee_protocol) || DEFAULT_CONFIG.fee_protocol,
                fee_builder: parseFloat(data.fee_builder) || DEFAULT_CONFIG.fee_builder,
                min_version: data.min_version || DEFAULT_CONFIG.min_version
            };
            this.cacheExpiry = now + this.cacheTTL;

            return this.cache;
        } catch (error) {
            console.error('[ConfigService] Error fetching config:', error);
            return DEFAULT_CONFIG;
        }
    }

    /**
     * Update platform config
     */
    async setConfig(config: Partial<PlatformConfig>): Promise<void> {
        try {
            const updates: Record<string, string> = {};

            if (config.mode !== undefined) updates.mode = config.mode;
            if (config.fee_total !== undefined) updates.fee_total = String(config.fee_total);
            if (config.fee_protocol !== undefined) updates.fee_protocol = String(config.fee_protocol);
            if (config.fee_builder !== undefined) updates.fee_builder = String(config.fee_builder);
            if (config.min_version !== undefined) updates.min_version = config.min_version;

            await redisClient.client.hSet(CONFIG_KEY, updates);

            // Invalidate cache
            this.cache = null;
            this.cacheExpiry = 0;

            console.log('[ConfigService] Config updated:', updates);
        } catch (error) {
            console.error('[ConfigService] Error setting config:', error);
            throw error;
        }
    }

    /**
     * Get platform mode (shortcut)
     */
    async getMode(): Promise<PlatformConfig['mode']> {
        const config = await this.getConfig();
        return config.mode;
    }

    /**
     * Get fee breakdown (shortcut)
     */
    async getFees(): Promise<FeeBreakdown> {
        const config = await this.getConfig();
        return {
            total: config.fee_total,
            protocol: config.fee_protocol,
            builder: config.fee_builder,
            workerMultiplier: 1 - config.fee_total
        };
    }

    /**
     * Check if platform is in live mode
     */
    async isLive(): Promise<boolean> {
        const mode = await this.getMode();
        return mode === 'live';
    }

    /**
     * Force refresh cache on next call
     */
    invalidateCache(): void {
        this.cache = null;
        this.cacheExpiry = 0;
    }
}

// Export singleton
export const configService = ConfigService.getInstance();
