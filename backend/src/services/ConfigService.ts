import { redisClient } from '../utils/redis';

export interface PlatformConfig {
    mode: 'beta' | 'hybrid' | 'live';
    fee_rate: number;
    min_version: string;
}

const CONFIG_KEY = 'system:config';
const DEFAULT_CONFIG: PlatformConfig = {
    mode: 'beta',
    fee_rate: 0.15,
    min_version: '1.0.0'
};

/**
 * ConfigService - Dynamic platform configuration from Redis
 * 
 * Key: system:config (Hash)
 * Fields: mode, fee_rate, min_version
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
                fee_rate: parseFloat(data.fee_rate) || DEFAULT_CONFIG.fee_rate,
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
            if (config.fee_rate !== undefined) updates.fee_rate = String(config.fee_rate);
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
     * Get fee rate (shortcut)
     */
    async getFeeRate(): Promise<number> {
        const config = await this.getConfig();
        return config.fee_rate;
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
