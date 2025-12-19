import { createClient, RedisClientType } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Singleton Redis client
class RedisClient {
    private static instance: RedisClient;
    public client: RedisClientType;
    private isConnected = false;

    private constructor() {
        this.client = createClient({ url: redisUrl });

        this.client.on('error', (err) => {
            console.error('[Redis] Client Error:', err);
        });

        this.client.on('connect', () => {
            console.log('[Redis] Connected');
            this.isConnected = true;
        });

        this.client.on('disconnect', () => {
            console.log('[Redis] Disconnected');
            this.isConnected = false;
        });
    }

    static getInstance(): RedisClient {
        if (!RedisClient.instance) {
            RedisClient.instance = new RedisClient();
        }
        return RedisClient.instance;
    }

    async connect(): Promise<void> {
        if (!this.client.isOpen) {
            await this.client.connect();
        }
    }

    get isOpen(): boolean {
        return this.client.isOpen;
    }

    // ===== Session Operations (Sorted Set) =====

    async addAvailableUser(sessionId: string, priceFloor: number): Promise<void> {
        await this.client.zAdd('market:available_users', { score: priceFloor, value: sessionId });
    }

    async claimUser(sessionId: string): Promise<boolean> {
        const removed = await this.client.zRem('market:available_users', sessionId);
        return removed > 0;
    }

    async findMatchableUsers(maxBid: number, limit = 10): Promise<string[]> {
        // Find users with priceFloor <= maxBid
        return await this.client.zRangeByScore('market:available_users', '-inf', maxBid, { LIMIT: { offset: 0, count: limit } });
    }

    async removeAvailableUser(sessionId: string): Promise<void> {
        await this.client.zRem('market:available_users', sessionId);
    }

    // ===== Session Data =====

    async setSession(sessionId: string, data: object, ttlSeconds = 3600): Promise<void> {
        await this.client.set(`session:${sessionId}`, JSON.stringify(data), { EX: ttlSeconds });
    }

    async getSession(sessionId: string): Promise<object | null> {
        const data = await this.client.get(`session:${sessionId}`);
        return data ? JSON.parse(data) : null;
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.client.del(`session:${sessionId}`);
    }

    // ===== User Balance & Points =====

    async incrementBalance(wallet: string, amount: number): Promise<number> {
        const result = await this.client.incrByFloat(`user:${wallet}:balance`, amount);
        return Number(result);
    }

    async getBalance(wallet: string): Promise<number> {
        const balance = await this.client.get(`user:${wallet}:balance`);
        return balance ? parseFloat(balance) : 0;
    }

    async incrementPoints(wallet: string, points: number, season = 'season_1'): Promise<void> {
        await this.client.zIncrBy(`campaign:${season}`, points, wallet);
    }

    async getLeaderboard(season = 'season_1', limit = 100): Promise<Array<{ wallet: string; points: number }>> {
        const results = await this.client.zRangeWithScores(`campaign:${season}`, 0, limit - 1, { REV: true });
        return results.map(r => ({ wallet: r.value, points: r.score }));
    }

    // ===== Builder & Protocol Revenue =====

    async incrementBuilderBalance(code: string, amount: number): Promise<number> {
        const result = await this.client.incrByFloat(`builder:${code}:balance`, amount);
        return Number(result);
    }

    async getBuilderBalance(code: string): Promise<number> {
        const balance = await this.client.get(`builder:${code}:balance`);
        return balance ? parseFloat(balance) : 0;
    }

    async incrementProtocolRevenue(amount: number): Promise<number> {
        const result = await this.client.incrByFloat('protocol:revenue', amount);
        return Number(result);
    }

    async getProtocolRevenue(): Promise<number> {
        const revenue = await this.client.get('protocol:revenue');
        return revenue ? parseFloat(revenue) : 0;
    }

    async addToHistory(wallet: string, matchData: object, maxItems = 50): Promise<void> {
        const key = `user:${wallet}:history`;
        await this.client.lPush(key, JSON.stringify(matchData));
        await this.client.lTrim(key, 0, maxItems - 1);
    }

    async getHistory(wallet: string, limit = 50): Promise<object[]> {
        const items = await this.client.lRange(`user:${wallet}:history`, 0, limit - 1);
        return items.map(item => JSON.parse(item));
    }

    // ===== Order Book =====

    async setOrder(txHash: string, orderData: any): Promise<void> {
        await this.client.hSet(`order:${txHash}`, this.flattenObject(orderData));

        if (orderData.status === 'open') {
            await this.client.sAdd('open_orders', txHash);
            await this.client.sRem('rejected_orders', txHash);
        } else if (orderData.status === 'rejected_tos') {
            await this.client.sAdd('rejected_orders', txHash);
            await this.client.sRem('open_orders', txHash);
        } else {
            await this.client.sRem('open_orders', txHash);
            await this.client.sRem('rejected_orders', txHash);
        }
    }

    async getOrder(txHash: string): Promise<object | null> {
        const data = await this.client.hGetAll(`order:${txHash}`);
        return Object.keys(data).length > 0 ? this.parseOrderData(data) : null;
    }

    async updateOrderStatus(txHash: string, status: string): Promise<void> {
        await this.client.hSet(`order:${txHash}`, 'status', status);

        if (status === 'open') {
            await this.client.sAdd('open_orders', txHash);
            await this.client.sRem('rejected_orders', txHash);
        } else if (status === 'rejected_tos') {
            await this.client.sAdd('rejected_orders', txHash);
            await this.client.sRem('open_orders', txHash);
        } else {
            await this.client.sRem('open_orders', txHash);
            await this.client.sRem('rejected_orders', txHash);
        }
    }

    async getOpenOrders(): Promise<string[]> {
        return await this.client.sMembers('open_orders');
    }

    async getRejectedOrders(): Promise<string[]> {
        return await this.client.sMembers('rejected_orders');
    }

    async deleteOrder(txHash: string): Promise<void> {
        await this.client.del(`order:${txHash}`);
        await this.client.sRem('open_orders', txHash);
        await this.client.sRem('rejected_orders', txHash);
    }

    // ===== Match History Stream =====

    async addMatchToStream(matchData: object): Promise<string> {
        const fields = this.flattenObject(matchData);
        return await this.client.xAdd('stream:match_history', '*', fields);
    }

    async getArchiverCursor(): Promise<string> {
        return await this.client.get('archiver:cursor') || '0';
    }

    async setArchiverCursor(cursor: string): Promise<void> {
        await this.client.set('archiver:cursor', cursor);
    }

    async readMatchStream(cursor: string, count = 100, blockMs = 5000): Promise<any> {
        return await this.client.xRead(
            { key: 'stream:match_history', id: cursor },
            { COUNT: count, BLOCK: blockMs }
        );
    }

    async deleteStreamEntries(entryIds: string[]): Promise<void> {
        if (entryIds.length > 0) {
            await this.client.xDel('stream:match_history', entryIds);
        }
    }

    // ===== Campaign Uniqueness =====

    async hasUserSeenCampaign(campaignId: string, userPubkey: string): Promise<boolean> {
        const result = await this.client.sIsMember(`campaign:${campaignId}:users`, userPubkey);
        return Boolean(result);
    }

    async markUserSeenCampaign(campaignId: string, userPubkey: string): Promise<void> {
        await this.client.sAdd(`campaign:${campaignId}:users`, userPubkey);
    }

    // ===== Helpers =====

    private flattenObject(obj: object): Record<string, string> {
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
        }
        return result;
    }

    private parseOrderData(data: Record<string, string>): object {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(data)) {
            // Try to parse numbers
            if (!isNaN(Number(value)) && value !== '') {
                result[key] = Number(value);
            } else if (value === 'true') {
                result[key] = true;
            } else if (value === 'false') {
                result[key] = false;
            } else {
                try {
                    result[key] = JSON.parse(value);
                } catch {
                    result[key] = value;
                }
            }
        }
        return result;
    }
}

// Export singleton instance
export const redisClient = RedisClient.getInstance();

// Export connect function for server startup
export const connectRedis = async () => {
    await redisClient.connect();
};

// Legacy export for backward compatibility during migration
export const redis = redisClient.client;
