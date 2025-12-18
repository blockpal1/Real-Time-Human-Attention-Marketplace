import { prisma } from '../utils/prisma';

// Content moderation status
export enum ContentStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    FLAGGED = 'flagged',
    REJECTED = 'rejected'
}

interface ModerationResult {
    flagged: boolean;
    categories: {
        sexual: boolean;
        hate: boolean;
        harassment: boolean;
        'self-harm': boolean;
        'sexual/minors': boolean;
        'hate/threatening': boolean;
        'violence/graphic': boolean;
        violence: boolean;
    };
    category_scores: Record<string, number>;
}

/**
 * ContentModerationService - Scans content for ToS violations
 * Uses OpenAI Moderation API (free) for text content
 */
export class ContentModerationService {
    private static instance: ContentModerationService;
    private openaiApiKey: string | undefined;
    private processingQueue: string[] = [];
    private isProcessing = false;

    constructor() {
        this.openaiApiKey = process.env.OPENAI_API_KEY;
        if (!this.openaiApiKey) {
            console.warn('[Moderation] OPENAI_API_KEY not set - content moderation disabled');
        }
    }

    static getInstance(): ContentModerationService {
        if (!ContentModerationService.instance) {
            ContentModerationService.instance = new ContentModerationService();
        }
        return ContentModerationService.instance;
    }

    /**
     * Queue a bid's content for moderation
     */
    async queueForModeration(bidId: string): Promise<void> {
        this.processingQueue.push(bidId);
        this.processQueue();
    }

    /**
     * Process the moderation queue
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.processingQueue.length === 0) return;
        this.isProcessing = true;

        while (this.processingQueue.length > 0) {
            const bidId = this.processingQueue.shift();
            if (bidId) {
                try {
                    await this.moderateBid(bidId);
                } catch (error) {
                    console.error(`[Moderation] Error processing bid ${bidId}:`, error);
                }
            }
        }

        this.isProcessing = false;
    }

    /**
     * Moderate a specific bid's content
     */
    private async moderateBid(bidId: string): Promise<void> {
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            select: {
                id: true,
                contentUrl: true,
                targetUrl: true,
                validationQuestion: true
            }
        });

        if (!bid) {
            console.warn(`[Moderation] Bid ${bidId} not found`);
            return;
        }

        // If no OpenAI key, auto-approve (for development)
        if (!this.openaiApiKey) {
            await this.updateBidStatus(bidId, ContentStatus.APPROVED);
            console.log(`[Moderation] Auto-approved bid ${bidId} (no API key)`);
            return;
        }

        // Collect text content to moderate
        const textToModerate: string[] = [];

        if (bid.targetUrl) textToModerate.push(bid.targetUrl);
        if (bid.validationQuestion) textToModerate.push(bid.validationQuestion);

        // If content URL is text-based, try to fetch and moderate
        if (bid.contentUrl) {
            const contentText = await this.fetchContentText(bid.contentUrl);
            if (contentText) textToModerate.push(contentText);
        }

        if (textToModerate.length === 0) {
            // No text to moderate, approve
            await this.updateBidStatus(bidId, ContentStatus.APPROVED);
            console.log(`[Moderation] Approved bid ${bidId} (no text content)`);
            return;
        }

        // Check each piece of text
        let isFlagged = false;
        let flagReason = '';

        for (const text of textToModerate) {
            const result = await this.moderateText(text);
            if (result?.flagged) {
                isFlagged = true;
                // Find which category triggered
                const flaggedCategories = Object.entries(result.categories)
                    .filter(([, flagged]) => flagged)
                    .map(([category]) => category);
                flagReason = flaggedCategories.join(', ');
                break;
            }
        }

        if (isFlagged) {
            await this.updateBidStatus(bidId, ContentStatus.FLAGGED);
            console.log(`[Moderation] Flagged bid ${bidId}: ${flagReason}`);
        } else {
            await this.updateBidStatus(bidId, ContentStatus.APPROVED);
            console.log(`[Moderation] Approved bid ${bidId}`);
        }
    }

    /**
     * Call OpenAI Moderation API
     */
    private async moderateText(text: string): Promise<ModerationResult | null> {
        if (!this.openaiApiKey) return null;

        try {
            const response = await fetch('https://api.openai.com/v1/moderations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openaiApiKey}`
                },
                body: JSON.stringify({ input: text })
            });

            if (!response.ok) {
                console.error(`[Moderation] API error: ${response.status}`);
                return null;
            }

            const data = await response.json();
            return data.results?.[0] || null;

        } catch (error) {
            console.error('[Moderation] API call failed:', error);
            return null;
        }
    }

    /**
     * Fetch text content from URL (for HTML pages)
     */
    private async fetchContentText(url: string): Promise<string | null> {
        try {
            // Skip binary content types
            if (url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm|mov)$/i)) {
                return null; // For now, skip image/video moderation
            }

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: { 'User-Agent': 'Attentium-Moderation/1.0' }
            });

            clearTimeout(timeout);

            if (!response.ok) return null;

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
                return null;
            }

            const text = await response.text();
            // Extract visible text (strip HTML tags)
            const visibleText = text.replace(/<[^>]*>/g, ' ').slice(0, 5000);
            return visibleText.trim() || null;

        } catch {
            return null; // Network error, skip
        }
    }

    /**
     * Update bid content status
     */
    private async updateBidStatus(bidId: string, status: ContentStatus): Promise<void> {
        await prisma.bid.update({
            where: { id: bidId },
            data: { contentStatus: status }
        });
    }

    /**
     * Check if a bid's content is approved
     */
    async isContentApproved(bidId: string): Promise<boolean> {
        const bid = await prisma.bid.findUnique({
            where: { id: bidId },
            select: { contentStatus: true }
        });
        return bid?.contentStatus === ContentStatus.APPROVED;
    }

    /**
     * Inline moderation for x402 orders (no database storage)
     * Returns { approved: boolean, reason?: string }
     */
    async moderateContentInline(
        contentUrl: string | null,
        validationQuestion: string
    ): Promise<{ approved: boolean; reason?: string }> {
        // Collect text to moderate
        const textToModerate: string[] = [validationQuestion];

        if (contentUrl) {
            // Check URL domain blocklist
            const blockedDomains = ['nsfw', 'porn', 'xxx', 'adult'];
            const urlLower = contentUrl.toLowerCase();
            for (const blocked of blockedDomains) {
                if (urlLower.includes(blocked)) {
                    return { approved: false, reason: `blocked_domain: ${blocked}` };
                }
            }

            // Fetch text content if not binary
            const contentText = await this.fetchContentText(contentUrl);
            if (contentText) textToModerate.push(contentText);
        }

        // If no OpenAI key, auto-approve (for development)
        if (!this.openaiApiKey) {
            console.log('[Moderation] Auto-approved (no API key)');
            return { approved: true };
        }

        // Check each piece of text with OpenAI Moderation API
        for (const text of textToModerate) {
            const result = await this.moderateText(text);
            if (result?.flagged) {
                const flaggedCategories = Object.entries(result.categories)
                    .filter(([, flagged]) => flagged)
                    .map(([category]) => category);
                return { approved: false, reason: flaggedCategories.join(', ') };
            }
        }

        return { approved: true };
    }
}

// Export singleton
export const moderationService = ContentModerationService.getInstance();
