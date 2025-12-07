/**
 * Webhook Bridge
 * 
 * Listens for on-chain events and triggers off-chain actions.
 * This module handles:
 * - RPC subscriptions for program logs
 * - Webhook dispatching for settlement events
 * - Transaction batching for sub-cent fees
 */

import {
    Connection,
    PublicKey,
    Keypair,
    clusterApiUrl,
} from "@solana/web3.js";
import {
    PaymentRouterClient,
    TransactionBatcher,
    SettlementEvent,
    EscrowDepositEvent,
    PaymentRouterEvent,
    PAYMENT_ROUTER_PROGRAM_ID,
} from "./index";

export interface WebhookConfig {
    endpoint: string;
    authToken?: string;
    retryAttempts?: number;
    retryDelayMs?: number;
}

export interface BridgeConfig {
    rpcEndpoint: string;
    webhooks: WebhookConfig[];
    batchIntervalMs: number;
    maxBatchSize: number;
}

export class PaymentBridge {
    private connection: Connection;
    private subscriptionId: number | null = null;
    private webhooks: WebhookConfig[];
    private eventQueue: PaymentRouterEvent[] = [];
    private batcher: TransactionBatcher | null = null;
    private batchIntervalMs: number;
    private maxBatchSize: number;
    private batchTimer: NodeJS.Timeout | null = null;

    constructor(config: BridgeConfig) {
        this.connection = new Connection(config.rpcEndpoint, "confirmed");
        this.webhooks = config.webhooks;
        this.batchIntervalMs = config.batchIntervalMs;
        this.maxBatchSize = config.maxBatchSize;
    }

    /**
     * Start listening for on-chain events.
     */
    async start(): Promise<void> {
        console.log("[PaymentBridge] Starting event subscription...");

        // Subscribe to program logs
        this.subscriptionId = this.connection.onLogs(
            PAYMENT_ROUTER_PROGRAM_ID,
            async (logs) => {
                await this.processLogs(logs);
            },
            "confirmed"
        );

        // Start batch processing timer
        this.batchTimer = setInterval(() => {
            this.flushWebhookQueue();
        }, this.batchIntervalMs);

        console.log("[PaymentBridge] Subscription active.");
    }

    /**
     * Stop listening for events.
     */
    async stop(): Promise<void> {
        if (this.subscriptionId !== null) {
            await this.connection.removeOnLogsListener(this.subscriptionId);
            this.subscriptionId = null;
        }
        if (this.batchTimer) {
            clearInterval(this.batchTimer);
            this.batchTimer = null;
        }
        console.log("[PaymentBridge] Stopped.");
    }

    /**
     * Process incoming program logs.
     */
    private async processLogs(logs: {
        signature: string;
        logs: string[];
    }): Promise<void> {
        const { signature, logs: logMessages } = logs;

        for (const log of logMessages) {
            // Parse settlement events
            if (log.includes("close_settlement")) {
                const event = await this.parseSettlementEvent(signature, log);
                if (event) {
                    this.eventQueue.push(event);
                }
            }

            // Parse deposit events
            if (log.includes("deposit_escrow")) {
                const event = await this.parseDepositEvent(signature, log);
                if (event) {
                    this.eventQueue.push(event);
                }
            }
        }

        // Check if we should flush early
        if (this.eventQueue.length >= this.maxBatchSize) {
            await this.flushWebhookQueue();
        }
    }

    /**
     * Parse a settlement event from logs.
     */
    private async parseSettlementEvent(
        signature: string,
        log: string
    ): Promise<SettlementEvent | null> {
        // In production, parse actual log data
        // This is a placeholder structure
        try {
            const tx = await this.connection.getTransaction(signature, {
                commitment: "confirmed",
            });

            if (!tx) return null;

            // Extract data from transaction (simplified)
            return {
                type: "settlement",
                escrowAgent: "", // Would parse from tx
                userWallet: "",
                verifiedSeconds: 0,
                agreedPricePerSecond: 0,
                totalPayout: 0,
                fee: 0,
                netPayout: 0,
                txSignature: signature,
                timestamp: tx.blockTime || Date.now() / 1000,
            };
        } catch {
            return null;
        }
    }

    /**
     * Parse a deposit event from logs.
     */
    private async parseDepositEvent(
        signature: string,
        _log: string
    ): Promise<EscrowDepositEvent | null> {
        try {
            const tx = await this.connection.getTransaction(signature, {
                commitment: "confirmed",
            });

            if (!tx) return null;

            return {
                type: "escrow_deposit",
                agent: "",
                amount: 0,
                newBalance: 0,
                txSignature: signature,
                timestamp: tx.blockTime || Date.now() / 1000,
            };
        } catch {
            return null;
        }
    }

    /**
     * Dispatch queued events to all configured webhooks.
     */
    private async flushWebhookQueue(): Promise<void> {
        if (this.eventQueue.length === 0) return;

        const events = [...this.eventQueue];
        this.eventQueue = [];

        for (const webhook of this.webhooks) {
            await this.dispatchToWebhook(webhook, events);
        }
    }

    /**
     * Send events to a single webhook endpoint.
     */
    private async dispatchToWebhook(
        webhook: WebhookConfig,
        events: PaymentRouterEvent[]
    ): Promise<void> {
        const { endpoint, authToken, retryAttempts = 3, retryDelayMs = 1000 } = webhook;

        for (let attempt = 0; attempt < retryAttempts; attempt++) {
            try {
                const response = await fetch(endpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                    },
                    body: JSON.stringify({ events }),
                });

                if (response.ok) {
                    console.log(`[PaymentBridge] Dispatched ${events.length} events to ${endpoint}`);
                    return;
                }

                console.warn(`[PaymentBridge] Webhook returned ${response.status}, retrying...`);
            } catch (err) {
                console.error(`[PaymentBridge] Webhook error: ${err}`);
            }

            // Wait before retry
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
        }

        console.error(`[PaymentBridge] Failed to dispatch to ${endpoint} after ${retryAttempts} attempts`);
    }
}

// --- RPC Call Helpers ---

export async function getRecentBlockhash(
    connection: Connection
): Promise<string> {
    const { blockhash } = await connection.getLatestBlockhash();
    return blockhash;
}

export async function confirmTransaction(
    connection: Connection,
    signature: string,
    maxRetries = 30
): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
        const status = await connection.getSignatureStatus(signature);
        if (status.value?.confirmationStatus === "confirmed" ||
            status.value?.confirmationStatus === "finalized") {
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
}

// --- Transaction Batching for Sub-cent Fees ---

export interface BatchedSettlement {
    agentPubkey: string;
    userWallet: string;
    verifiedSeconds: number;
    pricePerSecond: number;
    nonce: number;
}

/**
 * Batch multiple micro-settlements into a single transaction.
 * This allows sub-cent payments to be economical on Solana.
 */
export class SettlementBatcher {
    private pending: BatchedSettlement[] = [];
    private maxBatchSize: number;

    constructor(maxBatchSize = 10) {
        this.maxBatchSize = maxBatchSize;
    }

    add(settlement: BatchedSettlement): boolean {
        if (this.pending.length >= this.maxBatchSize) {
            return false; // Batch full
        }
        this.pending.push(settlement);
        return true;
    }

    shouldFlush(): boolean {
        return this.pending.length >= this.maxBatchSize;
    }

    flush(): BatchedSettlement[] {
        const batch = [...this.pending];
        this.pending = [];
        return batch;
    }

    get size(): number {
        return this.pending.length;
    }
}
