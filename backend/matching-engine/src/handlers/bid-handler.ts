import { v4 as uuidv4 } from 'uuid';
import { StreamConsumer, StreamMessage, STREAM_BIDS_INCOMING } from '../infra';
import { StreamProducer } from '../infra/producer';
import { OrderBook } from '../engine/order-book';
import { Bid, BidStatus, CreateBidInput } from '../types/bid';
import { BidCreatedEvent, BidCancelledEvent } from '../types/events';

/**
 * BidHandler - Consumes incoming bid events and adds them to the OrderBook
 */
export class BidHandler {
    private consumer: StreamConsumer;
    private readonly orderBook: OrderBook;

    constructor(orderBook: OrderBook) {
        this.orderBook = orderBook;
        this.consumer = new StreamConsumer({
            streamKey: STREAM_BIDS_INCOMING,
            consumerName: `bid-handler-${process.pid}`,
        });
    }

    /**
     * Start consuming bid events
     */
    async start(): Promise<void> {
        await this.consumer.initialize();
        console.log('[BidHandler] Starting bid consumer');

        // Don't await - runs in background
        this.consumer.start(async (message) => {
            await this.handleMessage(message);
        });
    }

    /**
     * Stop the consumer
     */
    async stop(): Promise<void> {
        await this.consumer.stop();
    }

    /**
     * Handle a single message
     */
    private async handleMessage(message: StreamMessage): Promise<void> {
        const { type } = message.fields;

        switch (type) {
            case 'bid_created':
                await this.handleBidCreated(message);
                break;
            case 'bid_cancelled':
                await this.handleBidCancelled(message);
                break;
            default:
                console.warn(`[BidHandler] Unknown event type: ${type}`);
        }
    }

    /**
     * Handle bid creation
     */
    private async handleBidCreated(message: StreamMessage): Promise<void> {
        try {
            const event = StreamProducer.parseEvent<BidCreatedEvent>(message.fields);
            const { bid: input } = event;

            // Create full bid object
            const now = Date.now();
            const bid: Bid = {
                bidId: input.bidId || uuidv4(),
                agentPubkey: input.agentPubkey,
                targetUrl: input.targetUrl,
                maxPricePerSecond: input.maxPricePerSecond,
                requiredAttentionScore: input.requiredAttentionScore,
                minAttentionSeconds: input.minAttentionSeconds ?? 5,
                expiryTimestamp: now + (input.expirySeconds ?? 60) * 1000,
                createdAt: now,
                status: BidStatus.PENDING,
            };

            // Validate bid
            if (!this.validateBid(bid)) {
                console.warn(`[BidHandler] Invalid bid rejected: ${bid.bidId}`);
                return;
            }

            // Add to order book
            this.orderBook.addBid(bid);
            console.log(
                `[BidHandler] Added bid ${bid.bidId} at ${bid.maxPricePerSecond} micro-USDC/sec`
            );
        } catch (err) {
            console.error('[BidHandler] Error handling bid_created:', err);
        }
    }

    /**
     * Handle bid cancellation
     */
    private async handleBidCancelled(message: StreamMessage): Promise<void> {
        try {
            const event = StreamProducer.parseEvent<BidCancelledEvent>(message.fields);
            const removed = this.orderBook.removeBid(event.bidId);

            if (removed) {
                console.log(`[BidHandler] Cancelled bid ${event.bidId}`);
            }
        } catch (err) {
            console.error('[BidHandler] Error handling bid_cancelled:', err);
        }
    }

    /**
     * Validate a bid before adding to order book
     */
    private validateBid(bid: Bid): boolean {
        // Price must be positive
        if (bid.maxPricePerSecond <= 0) return false;

        // Attention score must be in range
        if (bid.requiredAttentionScore < 0 || bid.requiredAttentionScore > 1) {
            return false;
        }

        // Expiry must be in the future
        if (bid.expiryTimestamp <= Date.now()) return false;

        // Agent pubkey must be present
        if (!bid.agentPubkey || bid.agentPubkey.length === 0) return false;

        return true;
    }

    /**
     * Manually add a bid (for testing or direct API calls)
     */
    addBidDirect(input: CreateBidInput): Bid {
        const now = Date.now();
        const bid: Bid = {
            bidId: uuidv4(),
            agentPubkey: input.agentPubkey,
            targetUrl: input.targetUrl,
            maxPricePerSecond: input.maxPricePerSecond,
            requiredAttentionScore: input.requiredAttentionScore,
            minAttentionSeconds: input.minAttentionSeconds ?? 5,
            expiryTimestamp: now + (input.expirySeconds ?? 60) * 1000,
            createdAt: now,
            status: BidStatus.PENDING,
        };

        if (!this.validateBid(bid)) {
            throw new Error('Invalid bid parameters');
        }

        this.orderBook.addBid(bid);
        return bid;
    }
}
