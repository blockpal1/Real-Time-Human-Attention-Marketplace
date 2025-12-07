/**
 * Load/Stress Test for the Matching Engine
 * 
 * This test measures performance under high load:
 * - 1000+ bids/second
 * - 500+ concurrent users
 * - Target: <50ms latency
 * 
 * Run with: npm run test:stress
 */

import { OrderBook } from '../../src/engine/order-book';
import { UserPool } from '../../src/engine/user-pool';
import { SessionEnforcer } from '../../src/engine/session-enforcer';
import { Matcher } from '../../src/engine/matcher';
import { Bid, BidStatus } from '../../src/types/bid';
import { UserSession, SessionStatus } from '../../src/types/session';

interface LoadTestResult {
    totalBids: number;
    totalUsers: number;
    totalMatches: number;
    totalTimeMs: number;
    avgMatchLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    matchesPerSecond: number;
    successRate: number;
}

function createBid(index: number, now: number): Bid {
    return {
        bidId: `bid-${index}`,
        agentPubkey: `agent-${index % 100}`, // 100 unique agents
        maxPricePerSecond: 50 + Math.floor(Math.random() * 150), // 50-200
        requiredAttentionScore: 0.3 + Math.random() * 0.4, // 0.3-0.7
        minAttentionSeconds: 5,
        expiryTimestamp: now + 60000,
        createdAt: now,
        status: BidStatus.PENDING,
    };
}

function createSession(index: number, now: number): UserSession {
    return {
        sessionId: `session-${index}`,
        userPubkey: `user-${index}`,
        priceFloorMicros: 30 + Math.floor(Math.random() * 100), // 30-130
        currentMatchId: null,
        lastEngagementScore: 0.5 + Math.random() * 0.5, // 0.5-1.0
        lastLivenessScore: 0.8 + Math.random() * 0.2, // 0.8-1.0
        connectedAt: now,
        lastHeartbeat: now,
        status: SessionStatus.AVAILABLE,
    };
}

async function runLoadTest(
    numBids: number,
    numUsers: number
): Promise<LoadTestResult> {
    const orderBook = new OrderBook();
    const userPool = new UserPool();
    const enforcer = new SessionEnforcer();
    const matcher = new Matcher(orderBook, userPool, enforcer, {
        emitEvents: false, // Disable for pure performance test
        maxMatchesPerIteration: 100,
    });

    const now = Date.now();
    const latencies: number[] = [];

    // Add users
    for (let i = 0; i < numUsers; i++) {
        userPool.addUser(createSession(i, now));
    }

    // Add bids
    for (let i = 0; i < numBids; i++) {
        orderBook.addBid(createBid(i, now));
    }

    console.log(`\n📊 Load Test: ${numBids} bids, ${numUsers} users`);
    console.log('─'.repeat(50));

    // Run matching
    const startTime = performance.now();
    let matchCount = 0;

    while (orderBook.size > 0 && userPool.availableCount > 0) {
        const matchStart = performance.now();
        const result = await matcher.tryMatch();
        const matchEnd = performance.now();

        if (result) {
            matchCount++;
            latencies.push(matchEnd - matchStart);
        } else {
            break;
        }
    }

    const totalTime = performance.now() - startTime;

    // Calculate percentiles
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const avg = latencies.length > 0
        ? latencies.reduce((a, b) => a + b, 0) / latencies.length
        : 0;

    const result: LoadTestResult = {
        totalBids: numBids,
        totalUsers: numUsers,
        totalMatches: matchCount,
        totalTimeMs: totalTime,
        avgMatchLatencyMs: avg,
        p50LatencyMs: p50,
        p95LatencyMs: p95,
        p99LatencyMs: p99,
        matchesPerSecond: matchCount / (totalTime / 1000),
        successRate: matchCount / Math.min(numBids, numUsers),
    };

    // Print results
    console.log(`✅ Total matches:     ${result.totalMatches}`);
    console.log(`⏱️  Total time:       ${result.totalTimeMs.toFixed(2)}ms`);
    console.log(`⚡ Matches/sec:       ${result.matchesPerSecond.toFixed(0)}`);
    console.log(`📈 Avg latency:       ${result.avgMatchLatencyMs.toFixed(3)}ms`);
    console.log(`📊 P50 latency:       ${result.p50LatencyMs.toFixed(3)}ms`);
    console.log(`📊 P95 latency:       ${result.p95LatencyMs.toFixed(3)}ms`);
    console.log(`📊 P99 latency:       ${result.p99LatencyMs.toFixed(3)}ms`);
    console.log(`✓  Success rate:      ${(result.successRate * 100).toFixed(1)}%`);

    return result;
}

async function runOrderBookStress(numOperations: number): Promise<void> {
    console.log(`\n📊 OrderBook Stress Test: ${numOperations} operations`);
    console.log('─'.repeat(50));

    const orderBook = new OrderBook();
    const now = Date.now();

    // Add operations
    const addStart = performance.now();
    for (let i = 0; i < numOperations; i++) {
        orderBook.addBid(createBid(i, now));
    }
    const addTime = performance.now() - addStart;
    console.log(`➕ Add ${numOperations}:     ${addTime.toFixed(2)}ms (${(numOperations / addTime * 1000).toFixed(0)} ops/sec)`);

    // Peek operations
    const peekStart = performance.now();
    for (let i = 0; i < numOperations; i++) {
        orderBook.peekTop();
    }
    const peekTime = performance.now() - peekStart;
    console.log(`👀 Peek ${numOperations}:    ${peekTime.toFixed(2)}ms (${(numOperations / peekTime * 1000).toFixed(0)} ops/sec)`);

    // Pop operations
    const popStart = performance.now();
    while (orderBook.size > 0) {
        orderBook.popTop();
    }
    const popTime = performance.now() - popStart;
    console.log(`➖ Pop ${numOperations}:     ${popTime.toFixed(2)}ms (${(numOperations / popTime * 1000).toFixed(0)} ops/sec)`);
}

async function main(): Promise<void> {
    console.log('\n🚀 Matching Engine Stress Test Suite\n');
    console.log('═'.repeat(50));

    try {
        // Test 1: Small scale (warm-up)
        const small = await runLoadTest(100, 50);

        // Test 2: Medium scale
        const medium = await runLoadTest(1000, 500);

        // Test 3: Large scale
        const large = await runLoadTest(5000, 1000);

        // Test 4: OrderBook stress
        await runOrderBookStress(10000);

        // Summary
        console.log('\n═'.repeat(50));
        console.log('📋 SUMMARY');
        console.log('═'.repeat(50));

        const tests = [
            { name: 'Small (100×50)', result: small },
            { name: 'Medium (1000×500)', result: medium },
            { name: 'Large (5000×1000)', result: large },
        ];

        for (const { name, result } of tests) {
            const status = result.p99LatencyMs < 50 ? '✅ PASS' : '❌ FAIL';
            console.log(
                `${status} ${name}: P99=${result.p99LatencyMs.toFixed(3)}ms, ` +
                `${result.matchesPerSecond.toFixed(0)} matches/sec`
            );
        }

        // Verify <50ms target
        if (large.p99LatencyMs < 50) {
            console.log('\n✅ All latency targets met (<50ms P99)');
            process.exit(0);
        } else {
            console.log('\n❌ Latency target NOT met');
            process.exit(1);
        }
    } catch (err) {
        console.error('\n❌ Stress test failed:', err);
        process.exit(1);
    }
}

// Allow running directly or as a test
if (require.main === module) {
    main();
}

// Also export as Jest test
describe('Stress Tests', () => {
    it('should handle medium load with <50ms P99 latency', async () => {
        const result = await runLoadTest(1000, 500);
        expect(result.p99LatencyMs).toBeLessThan(50);
    }, 30000);

    it('should maintain throughput under load', async () => {
        const result = await runLoadTest(1000, 500);
        expect(result.matchesPerSecond).toBeGreaterThan(1000);
    }, 30000);
});
