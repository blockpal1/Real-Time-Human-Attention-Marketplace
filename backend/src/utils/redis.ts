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

    async resetBalance(wallet: string): Promise<void> {
        await this.client.set(`user:${wallet}:balance`, '0');
    }

    async incrementPoints(wallet: string, points: number, season = 'season_1'): Promise<void> {
        await this.client.zIncrBy(`campaign:${season}`, points, wallet);
    }

    async getLeaderboard(season = 'season_1', limit = 100): Promise<Array<{ wallet: string; points: number }>> {
        const results = await this.client.zRangeWithScores(`campaign:${season}`, 0, limit - 1, { REV: true });
        return results.map(r => ({ wallet: r.value, points: r.score }));
    }

    /**
     * Ensure user record exists in Redis (idempotent)
     * Called on first session to initialize user metadata
     */
    async ensureUserExists(wallet: string): Promise<boolean> {
        const key = `user:${wallet}:info`;
        // HSETNX only sets if field doesn't exist (atomic)
        const wasNew = await this.client.hSetNX(key, 'created_at', Date.now().toString());
        if (wasNew) {
            // Initialize other fields for new user
            await this.client.hSet(key, {
                first_session_at: Date.now().toString(),
                status: 'active'
            });
            console.log(`[Redis] New user initialized: ${wallet.slice(0, 12)}...`);
        }
        return wasNew === 1;
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

    // ===== Settlement Logging (Non-Custodial) =====

    async logPendingSettlement(wallet: string, matchData: any): Promise<void> {
        const key = `user:${wallet}:pending_settlements`;
        await this.client.lPush(key, JSON.stringify(matchData));
    }

    async getPendingSettlements(wallet: string, limit = 1000): Promise<any[]> {
        const key = `user:${wallet}:pending_settlements`;
        const items = await this.client.lRange(key, 0, limit - 1);
        return items.map(item => JSON.parse(item));
    }

    async clearPendingSettlements(wallet: string): Promise<void> {
        await this.client.del(`user:${wallet}:pending_settlements`);
    }

    /**
     * Atomically moves all pending items to a processing list.
     * Returns the list of items moved.
     */
    async lockPendingSettlements(wallet: string, claimId: string): Promise<any[]> {
        const sourceKey = `user:${wallet}:pending_settlements`;
        const destKey = `claim:${claimId}:processing`;

        // Rename is atomic. If source doesn't exist, it throws.
        // But we want to 'move' contents.
        // RENAME is risky if we have concurrent pushes.
        // Lua script or Multi/Exec is safer.
        // Simplest: GET items, DEL source, SET dest. (Not atomic if crash in between)
        // Better: RENAME (assuming single consumer for wallet).
        // Since we lock the wallet UI, RENAME is acceptable.

        try {
            console.log(`[Redis] Locking settlements for ${wallet}. Key: ${sourceKey} -> ${destKey}`);

            // Check if exists
            const len = await this.client.lLen(sourceKey);
            console.log(`[Redis] Source Key Length: ${len}`);

            if (len === 0) return [];

            // Move entire list by renaming key
            await this.client.rename(sourceKey, destKey);

            // Set TTL on processing key (e.g. 10 mins) to auto-expire if stuck?
            // If it expires, data is lost!
            // So NO TTL. We need a cleanup job.
            // Or set a long TTL (24h).
            await this.client.expire(destKey, 86400);

            // Return items
            const items = await this.client.lRange(destKey, 0, -1);
            console.log(`[Redis] Moved to ${destKey}. Found ${items.length} items.`);
            console.log(`[Redis] Item 0: ${items[0]}`);
            return items.map(i => JSON.parse(i));
        } catch (e) {
            console.error("[Redis] Lock/Parse Error:", e);
            return [];
        }
    }

    async getProcessingSettlements(claimId: string): Promise<any[]> {
        const key = `claim:${claimId}:processing`;
        const items = await this.client.lRange(key, 0, -1);
        return items.map(i => JSON.parse(i));
    }

    async deleteProcessingSettlements(claimId: string): Promise<void> {
        await this.client.del(`claim:${claimId}:processing`);
    }

    // Restore items from processing back to pending (on failure)
    async restoreProcessingToPending(wallet: string, claimId: string): Promise<void> {
        const processingKey = `claim:${claimId}:processing`;
        const pendingKey = `user:${wallet}:pending_settlements`;

        const items = await this.client.lRange(processingKey, 0, -1);
        if (items.length > 0) {
            // Push back to head or tail? 
            // Doesn't matter for settlement usually, 
            // but let's push to list.
            await this.client.rPush(pendingKey, items);
        }
        await this.client.del(processingKey);
    }

    // ===== Claim Intent (Deferred Locking) =====

    async setClaimIntent(claimId: string, data: {
        userPubkey: string;
        amount: number;
        settlements: any[];
        transactionBase64: string;
        createdAt: number;
    }): Promise<void> {
        const key = `claim_intent:${claimId}`;
        await this.client.set(key, JSON.stringify(data), { EX: 300 }); // 5 min TTL
        console.log(`[Redis] Created claim intent: ${claimId} (TTL: 5min)`);
    }

    async getClaimIntent(claimId: string): Promise<{
        userPubkey: string;
        amount: number;
        settlements: any[];
        transactionBase64: string;
        createdAt: number;
    } | null> {
        const key = `claim_intent:${claimId}`;
        const data = await this.client.get(key);
        if (!data) return null;
        return JSON.parse(data);
    }

    async deleteClaimIntent(claimId: string): Promise<void> {
        await this.client.del(`claim_intent:${claimId}`);
    }

    /**
     * Atomically lock ALL settlements from pending to processing.
     * Uses RENAME for atomic move (no JSON comparison issues).
     * Returns true if items were locked.
     */
    async atomicLockSettlements(wallet: string, claimId: string, _settlements: any[]): Promise<boolean> {
        const sourceKey = `user:${wallet}:pending_settlements`;
        const destKey = `claim:${claimId}:processing`;

        try {
            // Check if source has items
            const len = await this.client.lLen(sourceKey);
            if (len === 0) {
                console.log(`[Redis] Atomic lock: No items in ${sourceKey}`);
                return false;
            }

            // Atomic rename - moves entire list
            await this.client.rename(sourceKey, destKey);

            // Set TTL on processing key
            await this.client.expire(destKey, 600);

            console.log(`[Redis] Atomic lock: ${len} items moved to ${destKey}`);
            return true;
        } catch (e: any) {
            // RENAME fails if source doesn't exist (already claimed)
            if (e.message?.includes('no such key')) {
                console.log(`[Redis] Atomic lock: Source key already claimed`);
                return false;
            }
            console.error(`[Redis] Atomic lock failed:`, e);
            return false;
        }
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

    // ===== Agent Campaign Indexing =====

    async addAgentCampaign(agentKey: string, txHash: string): Promise<void> {
        await this.client.sAdd(`agent:${agentKey}:campaigns`, txHash);
    }

    async getAgentCampaigns(agentKey: string): Promise<string[]> {
        return await this.client.sMembers(`agent:${agentKey}:campaigns`);
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

    // ===== Pending Match Tracking (Stale Sweeper) =====

    async addPendingMatch(matchId: string, bidId: string): Promise<void> {
        const now = Date.now();
        // 1. Store metadata
        await this.client.hSet(`pending:match:${matchId}`, {
            matchId,
            bidId,
            createdAt: now
        });
        // 2. Add to time-based index
        await this.client.zAdd('pending_matches', { score: now, value: matchId });
    }

    async removePendingMatch(matchId: string): Promise<void> {
        await this.client.del(`pending:match:${matchId}`);
        await this.client.zRem('pending_matches', matchId);
    }

    async getStaleMatches(maxAgeSeconds: number): Promise<string[]> {
        const threshold = Date.now() - (maxAgeSeconds * 1000);
        // Get matchIds older than threshold
        return await this.client.zRangeByScore('pending_matches', 0, threshold);
    }

    async getPendingMatchDetails(matchId: string): Promise<{ bidId: string } | null> {
        const data = await this.client.hGetAll(`pending:match:${matchId}`);
        if (!data || !data.bidId) return null;
        return { bidId: data.bidId };
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
