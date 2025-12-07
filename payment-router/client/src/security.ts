/**
 * Security Checks Module
 *
 * Provides validation helpers for signatures, nonces, and fraud detection.
 */

import { PublicKey } from "@solana/web3.js";
import * as nacl from "tweetnacl";

// Nonce tracking to prevent replay attacks
const usedNonces = new Set<string>();

/**
 * Verify that a nonce hasn't been used before (prevents replay attacks).
 * In production, this should be backed by persistent storage (Redis/DB).
 */
export function validateNonce(nonce: string | bigint): boolean {
    const nonceStr = nonce.toString();
    if (usedNonces.has(nonceStr)) {
        return false;
    }
    usedNonces.add(nonceStr);
    return true;
}

/**
 * Mark a nonce as used (for external tracking).
 */
export function markNonceUsed(nonce: string | bigint): void {
    usedNonces.add(nonce.toString());
}

/**
 * Verify an Ed25519 signature for a given message and public key.
 */
export function verifySignature(
    message: Uint8Array,
    signature: Uint8Array,
    publicKey: PublicKey
): boolean {
    try {
        return nacl.sign.detached.verify(message, signature, publicKey.toBytes());
    } catch {
        return false;
    }
}

/**
 * Validate that a settlement request is legitimate.
 * Checks:
 * 1. Nonce hasn't been used
 * 2. Router signature is valid
 * 3. Verified seconds is reasonable
 */
export interface SettlementValidationParams {
    routerPubkey: PublicKey;
    agentPubkey: PublicKey;
    userPubkey: PublicKey;
    verifiedSeconds: bigint;
    agreedPricePerSecond: bigint;
    nonce: bigint;
    signature: Uint8Array;
}

export function validateSettlementRequest(
    params: SettlementValidationParams
): { valid: boolean; error?: string } {
    // Check nonce
    if (!validateNonce(params.nonce)) {
        return { valid: false, error: "Nonce already used (replay attack)" };
    }

    // Check verified seconds is reasonable (max 24 hours)
    const MAX_SECONDS = BigInt(86400);
    if (params.verifiedSeconds > MAX_SECONDS) {
        return { valid: false, error: "Verified seconds exceeds maximum" };
    }

    // Check price is non-zero
    if (params.agreedPricePerSecond === BigInt(0)) {
        return { valid: false, error: "Price per second cannot be zero" };
    }

    // Construct message for signature verification
    const message = constructSettlementMessage(params);
    if (!verifySignature(message, params.signature, params.routerPubkey)) {
        return { valid: false, error: "Invalid router signature" };
    }

    return { valid: true };
}

/**
 * Construct the canonical message for settlement signature verification.
 */
function constructSettlementMessage(
    params: SettlementValidationParams
): Uint8Array {
    const encoder = new TextEncoder();
    const message = `settle:${params.agentPubkey.toBase58()}:${params.userPubkey.toBase58()}:${params.verifiedSeconds}:${params.agreedPricePerSecond}:${params.nonce}`;
    return encoder.encode(message);
}

/**
 * Slash detection: Check if engagement data appears fraudulent.
 * Returns a score from 0 (definitely fraud) to 1 (definitely legitimate).
 */
export interface EngagementMetrics {
    attentionScore: number;
    isHuman: number;
    livenessScore: number;
    sessionDurationSeconds: number;
    mouseMovements: number;
    scrollEvents: number;
}

export function calculateFraudScore(metrics: EngagementMetrics): number {
    let score = 1.0;

    // Check attention score is reasonable
    if (metrics.attentionScore < 0.1 || metrics.attentionScore > 0.99) {
        score -= 0.2;
    }

    // Check human detection
    if (metrics.isHuman < 0.5) {
        score -= 0.4;
    }

    // Check liveness
    if (metrics.livenessScore < 0.5) {
        score -= 0.3;
    }

    // Check for suspicious lack of interaction
    const expectedInteractions = metrics.sessionDurationSeconds * 0.5; // Expect ~0.5 events/sec
    const actualInteractions = metrics.mouseMovements + metrics.scrollEvents;
    if (actualInteractions < expectedInteractions * 0.1) {
        score -= 0.3;
    }

    return Math.max(0, Math.min(1, score));
}

/**
 * Determine if a session should be slashed based on fraud score.
 */
export function shouldSlash(fraudScore: number, threshold = 0.3): boolean {
    return fraudScore < threshold;
}

/**
 * Calculate the amount to slash based on fraud severity.
 */
export function calculateSlashAmount(
    totalEscrowed: bigint,
    fraudScore: number
): bigint {
    if (fraudScore >= 0.5) {
        return BigInt(0); // No slash
    }

    // Slash proportional to fraud severity
    const slashPercentage = Math.floor((0.5 - fraudScore) * 200); // 0-100%
    return (totalEscrowed * BigInt(slashPercentage)) / BigInt(100);
}

// --- Refund Logic ---

export interface RefundParams {
    escrowBalance: bigint;
    usedAmount: bigint;
    slashedAmount: bigint;
}

export function calculateRefund(params: RefundParams): bigint {
    const { escrowBalance, usedAmount, slashedAmount } = params;
    const totalDeducted = usedAmount + slashedAmount;

    if (totalDeducted >= escrowBalance) {
        return BigInt(0);
    }

    return escrowBalance - totalDeducted;
}
