import { prisma } from '../utils/prisma';

// Webhook event types
export enum WebhookEventType {
    MATCH_CREATED = 'match.created',
    MATCH_STARTED = 'match.started',
    MATCH_COMPLETED = 'match.completed',
    MATCH_FAILED = 'match.failed',
    BID_FILLED = 'bid.filled',
    BID_EXPIRED = 'bid.expired'
}

interface WebhookPayload {
    event: WebhookEventType;
    timestamp: string;
    data: Record<string, unknown>;
}

/**
 * WebhookService - Delivers events to agent webhook endpoints
 */
export class WebhookService {
    private static instance: WebhookService;
    private deliveryQueue: Array<{ agentId: string; payload: WebhookPayload }> = [];
    private processing = false;

    static getInstance(): WebhookService {
        if (!WebhookService.instance) {
            WebhookService.instance = new WebhookService();
        }
        return WebhookService.instance;
    }

    /**
     * Queue a webhook event for delivery
     */
    async queueEvent(
        agentPubkey: string,
        event: WebhookEventType,
        data: Record<string, unknown>
    ): Promise<void> {
        try {
            const agent = await prisma.agent.findUnique({
                where: { pubkey: agentPubkey },
                select: { id: true, webhookUrl: true }
            });

            if (!agent?.webhookUrl) {
                console.log(`[Webhook] No webhook URL for agent ${agentPubkey}`);
                return;
            }

            const payload: WebhookPayload = {
                event,
                timestamp: new Date().toISOString(),
                data
            };

            this.deliveryQueue.push({ agentId: agent.id, payload });
            this.processQueue();

        } catch (error) {
            console.error('[Webhook] Queue error:', error);
        }
    }

    /**
     * Process queued webhooks
     */
    private async processQueue(): Promise<void> {
        if (this.processing || this.deliveryQueue.length === 0) return;
        this.processing = true;

        while (this.deliveryQueue.length > 0) {
            const item = this.deliveryQueue.shift();
            if (item) {
                await this.deliver(item.agentId, item.payload);
            }
        }

        this.processing = false;
    }

    /**
     * Deliver a webhook to an agent
     */
    private async deliver(agentId: string, payload: WebhookPayload): Promise<void> {
        try {
            const agent = await prisma.agent.findUnique({
                where: { id: agentId },
                select: { webhookUrl: true, pubkey: true }
            });

            if (!agent?.webhookUrl) return;

            console.log(`[Webhook] Delivering ${payload.event} to ${agent.webhookUrl}`);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

            try {
                const response = await fetch(agent.webhookUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Attentium-Event': payload.event,
                        'X-Attentium-Timestamp': payload.timestamp,
                        'X-Agent-Pubkey': agent.pubkey
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal
                });

                clearTimeout(timeout);

                if (response.ok) {
                    console.log(`[Webhook] Delivered ${payload.event} successfully`);
                } else {
                    console.warn(`[Webhook] Delivery failed: ${response.status} ${response.statusText}`);
                }
            } catch (fetchError: unknown) {
                clearTimeout(timeout);
                if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                    console.warn(`[Webhook] Delivery timeout for ${agent.webhookUrl}`);
                } else {
                    console.warn(`[Webhook] Delivery error:`, fetchError);
                }
            }

        } catch (error) {
            console.error('[Webhook] Deliver error:', error);
        }
    }

    /**
     * Send match.created event
     */
    async notifyMatchCreated(
        agentPubkey: string,
        matchId: string,
        bidId: string,
        sessionId: string,
        price: number,
        duration: number
    ): Promise<void> {
        await this.queueEvent(agentPubkey, WebhookEventType.MATCH_CREATED, {
            match_id: matchId,
            bid_id: bidId,
            session_id: sessionId,
            agreed_price_per_second: price,
            duration_seconds: duration
        });
    }

    /**
     * Send match.completed event
     */
    async notifyMatchCompleted(
        agentPubkey: string,
        matchId: string,
        bidId: string,
        actualDuration: number,
        validationAnswer: string | null,
        earnedAmount: number
    ): Promise<void> {
        await this.queueEvent(agentPubkey, WebhookEventType.MATCH_COMPLETED, {
            match_id: matchId,
            bid_id: bidId,
            actual_duration_seconds: actualDuration,
            validation_answer: validationAnswer,
            earned_amount_micros: earnedAmount,
            earned_amount_usdc: earnedAmount / 1_000_000
        });
    }

    /**
     * Send match.failed event
     */
    async notifyMatchFailed(
        agentPubkey: string,
        matchId: string,
        bidId: string,
        reason: string
    ): Promise<void> {
        await this.queueEvent(agentPubkey, WebhookEventType.MATCH_FAILED, {
            match_id: matchId,
            bid_id: bidId,
            reason
        });
    }

    /**
     * Send bid.filled event
     */
    async notifyBidFilled(
        agentPubkey: string,
        bidId: string,
        totalMatches: number,
        totalEarned: number
    ): Promise<void> {
        await this.queueEvent(agentPubkey, WebhookEventType.BID_FILLED, {
            bid_id: bidId,
            total_matches: totalMatches,
            total_earned_micros: totalEarned,
            total_earned_usdc: totalEarned / 1_000_000
        });
    }
}

// Export singleton instance
export const webhookService = WebhookService.getInstance();
