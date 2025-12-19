import { redisClient } from '../utils/redis';
import * as fs from 'fs';
import * as path from 'path';

/**
 * ArchiverService - Crash-safe match history archiver
 * 
 * Consumes Redis Stream `stream:match_history` and writes to daily JSONL files.
 * Uses persistent cursor to ensure no message loss on crashes or restarts.
 */
export class ArchiverService {
    private isRunning = false;
    private logsDir: string;
    private pollInterval: NodeJS.Timeout | null = null;

    constructor(logsDir = './logs') {
        this.logsDir = logsDir;

        // Ensure logs directory exists
        if (!fs.existsSync(this.logsDir)) {
            fs.mkdirSync(this.logsDir, { recursive: true });
        }
    }

    /**
     * Start the archiver service
     * Uses polling with XREAD BLOCK for efficient stream consumption
     */
    async start(): Promise<void> {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log('[Archiver] Starting match history archiver...');

        // Start the processing loop
        this.processLoop();
    }

    /**
     * Stop the archiver service gracefully
     */
    stop(): void {
        this.isRunning = false;
        if (this.pollInterval) {
            clearTimeout(this.pollInterval);
            this.pollInterval = null;
        }
        console.log('[Archiver] Stopped');
    }

    /**
     * Main processing loop - runs continuously while isRunning
     */
    private async processLoop(): Promise<void> {
        while (this.isRunning) {
            try {
                await this.processOnce();
            } catch (error) {
                console.error('[Archiver] Error in processing loop:', error);
            }

            // Wait before next iteration (non-blocking for stream reads)
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    /**
     * Process one batch of entries from the stream
     */
    private async processOnce(): Promise<void> {
        if (!redisClient.isOpen) return;

        // Get last processed cursor
        const cursor = await redisClient.getArchiverCursor();

        // Read new entries from stream (with 5s blocking)
        const streams = await redisClient.client.xRead(
            { key: 'stream:match_history', id: cursor },
            { BLOCK: 5000, COUNT: 100 }
        );

        if (!streams || streams.length === 0) return;

        const entries = streams[0].messages;
        if (entries.length === 0) return;

        console.log(`[Archiver] Processing ${entries.length} new match entries...`);

        // Get today's log file
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const logFile = path.join(this.logsDir, `matches-${today}.jsonl`);

        // Process and write entries
        const entryIds: string[] = [];
        let lastId = cursor;

        for (const entry of entries) {
            const { id, message } = entry;
            entryIds.push(id);
            lastId = id;

            // Convert Redis hash fields back to object
            const matchData = {
                streamId: id,
                archivedAt: new Date().toISOString(),
                ...message
            };

            // Append to JSONL file
            const jsonLine = JSON.stringify(matchData) + '\n';
            fs.appendFileSync(logFile, jsonLine);
        }

        // Update cursor BEFORE deleting (crash-safe)
        await redisClient.setArchiverCursor(lastId);

        // Delete processed entries from stream to prevent unbounded growth
        if (entryIds.length > 0) {
            await redisClient.client.xDel('stream:match_history', entryIds);
        }

        console.log(`[Archiver] Archived ${entries.length} entries to ${logFile}`);
    }

    /**
     * Get archiver status for monitoring
     */
    async getStatus(): Promise<{
        running: boolean;
        cursor: string;
        streamLength: number;
    }> {
        const cursor = await redisClient.getArchiverCursor();
        const streamLength = await redisClient.client.xLen('stream:match_history');

        return {
            running: this.isRunning,
            cursor,
            streamLength
        };
    }
}

// Export singleton instance
export const archiverService = new ArchiverService();
