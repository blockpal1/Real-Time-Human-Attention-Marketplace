"use strict";
/**
 * Security Checks Module
 *
 * Provides validation helpers for signatures, nonces, and fraud detection.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateNonce = validateNonce;
exports.markNonceUsed = markNonceUsed;
exports.verifySignature = verifySignature;
exports.validateSettlementRequest = validateSettlementRequest;
exports.calculateFraudScore = calculateFraudScore;
exports.shouldSlash = shouldSlash;
exports.calculateSlashAmount = calculateSlashAmount;
exports.calculateRefund = calculateRefund;
const nacl = __importStar(require("tweetnacl"));
// Nonce tracking to prevent replay attacks
const usedNonces = new Set();
/**
 * Verify that a nonce hasn't been used before (prevents replay attacks).
 * In production, this should be backed by persistent storage (Redis/DB).
 */
function validateNonce(nonce) {
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
function markNonceUsed(nonce) {
    usedNonces.add(nonce.toString());
}
/**
 * Verify an Ed25519 signature for a given message and public key.
 */
function verifySignature(message, signature, publicKey) {
    try {
        return nacl.sign.detached.verify(message, signature, publicKey.toBytes());
    }
    catch {
        return false;
    }
}
function validateSettlementRequest(params) {
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
function constructSettlementMessage(params) {
    const encoder = new TextEncoder();
    const message = `settle:${params.agentPubkey.toBase58()}:${params.userPubkey.toBase58()}:${params.verifiedSeconds}:${params.agreedPricePerSecond}:${params.nonce}`;
    return encoder.encode(message);
}
function calculateFraudScore(metrics) {
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
function shouldSlash(fraudScore, threshold = 0.3) {
    return fraudScore < threshold;
}
/**
 * Calculate the amount to slash based on fraud severity.
 */
function calculateSlashAmount(totalEscrowed, fraudScore) {
    if (fraudScore >= 0.5) {
        return BigInt(0); // No slash
    }
    // Slash proportional to fraud severity
    const slashPercentage = Math.floor((0.5 - fraudScore) * 200); // 0-100%
    return (totalEscrowed * BigInt(slashPercentage)) / BigInt(100);
}
function calculateRefund(params) {
    const { escrowBalance, usedAmount, slashedAmount } = params;
    const totalDeducted = usedAmount + slashedAmount;
    if (totalDeducted >= escrowBalance) {
        return BigInt(0);
    }
    return escrowBalance - totalDeducted;
}
