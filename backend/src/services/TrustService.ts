/**
 * TrustService - Signal Quality validation with gate-before-pay model
 * 
 * Flow: AI Check → Update Score → Pay (if PASS)
 * 
 * Uses OpenAI gpt-4o-mini for response quality assessment.
 * Fail-open on API errors to preserve worker UX.
 */
import OpenAI from 'openai';
import { BOUNCER_SYSTEM_PROMPT } from '../lib/prompts';
import { redisClient } from '../utils/redis';

// OpenAI client with dedicated bouncer key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_Bouncer_Key,
    timeout: 10000, // 10 second timeout for all requests
    maxRetries: 0   // Don't retry on timeout
});

// --- CONSTANTS ---
const CONSTANTS = {
    START_SCORE: 50,      // Default for new workers
    MAX_SCORE: 100,       // Cap
    MIN_THRESHOLD: 20,    // Auto-ban below this
    REWARD: 1,            // Points for good answer
    PENALTY: 10,          // Penalty for spam
    DECAY_RATE: 1         // Points lost per day of inactivity
};

export type QualityStatus = 'HIGH_SIGNAL' | 'LOW_SIGNAL' | 'BANNED';

/**
 * AI Bouncer: Returns TRUE if high signal, FALSE if spam/noise.
 * Fails OPEN (returns true) if OpenAI is down to preserve UX.
 */
export async function validateResponseWithAI(question: string, answer: string): Promise<boolean> {
    // Skip validation if no answer provided
    if (!answer || answer.trim().length === 0) {
        return true; // Empty answers handled elsewhere
    }

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: BOUNCER_SYSTEM_PROMPT },
                { role: 'user', content: `Q: "${question}"\nA: "${answer}"` }
            ],
            temperature: 0,
            max_tokens: 5,
        }, {
            timeout: 10000 // 10 second timeout
        });

        const verdict = response.choices[0]?.message?.content?.trim().toUpperCase() || 'PASS';
        const passed = verdict.includes('PASS');

        console.log(`[TrustService] AI verdict for "${answer.slice(0, 30)}...": ${passed ? 'PASS' : 'FAIL'}`);
        return passed;

    } catch (error) {
        console.error('[TrustService] AI Check Failed:', error);
        // Fail OPEN - don't punish workers for our infra issues
        return true;
    }
}

/**
 * Scorekeeper: Updates Signal Quality with time decay
 * Returns status: HIGH_SIGNAL, LOW_SIGNAL, or BANNED
 */
export async function updateSignalQuality(walletAddress: string, passedAiCheck: boolean): Promise<QualityStatus> {
    const key = `user:${walletAddress}`;
    const now = Date.now();

    // 1. Initialize or fetch user
    const existingData = await redisClient.client.hGetAll(key);
    let stats: Record<string, string> = existingData;
    if (Object.keys(stats).length === 0 || !stats.quality) {
        await redisClient.client.hSet(key, { quality: String(CONSTANTS.START_SCORE), lastActive: String(now) });
        stats = { quality: String(CONSTANTS.START_SCORE), lastActive: String(now) };
    }

    let currentQuality = parseInt(stats.quality || '50');
    const lastActive = parseInt(stats.lastActive || String(now));

    // 2. Apply time decay (1 point per day inactive)
    const msPerDay = 86400000;
    const daysInactive = Math.floor((now - lastActive) / msPerDay);
    if (daysInactive > 0) {
        currentQuality = Math.max(0, currentQuality - (daysInactive * CONSTANTS.DECAY_RATE));
        console.log(`[TrustService] Applied ${daysInactive} days decay to ${walletAddress.slice(0, 12)}...`);
    }

    // 3. Apply task result
    if (passedAiCheck) {
        if (currentQuality < CONSTANTS.MAX_SCORE) {
            currentQuality += CONSTANTS.REWARD;
        }
    } else {
        currentQuality -= CONSTANTS.PENALTY;
    }

    // 4. Save updated stats
    await redisClient.client.hSet(key, {
        quality: String(currentQuality),
        lastActive: String(now)
    });

    // 5. Determine status
    if (currentQuality < CONSTANTS.MIN_THRESHOLD) {
        console.log(`[TrustService] User ${walletAddress.slice(0, 12)}... BANNED (quality: ${currentQuality})`);
        return 'BANNED';
    }

    console.log(`[TrustService] User ${walletAddress.slice(0, 12)}... quality: ${currentQuality} (${passedAiCheck ? 'HIGH' : 'LOW'}_SIGNAL)`);
    return passedAiCheck ? 'HIGH_SIGNAL' : 'LOW_SIGNAL';
}

/**
 * Get worker's current quality status
 */
export async function getWorkerStatus(walletAddress: string): Promise<{ quality: number; isBanned: boolean }> {
    const quality = await redisClient.client.hGet(`user:${walletAddress}`, 'quality');
    const score = quality ? parseInt(quality) : CONSTANTS.START_SCORE;
    return {
        quality: score,
        isBanned: score < CONSTANTS.MIN_THRESHOLD
    };
}
