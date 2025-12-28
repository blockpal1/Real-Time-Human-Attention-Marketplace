import { redisClient } from './utils/redis';
import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    console.log("Fixing Redis Data with Correct Agent...");

    // User confirmed this wallet has funded escrow
    const agentPubkey = "2kDpvEhgoLkUbqFJqxMpUXMtr2gVYbfqNF8kGrfoZMAV";
    const userPubkey = "2kDpvEhgoLkUbqFJqxMpUXMtr2gVYbfqNF8kGrfoZMAV";  // Same wallet
    const key = `user:${userPubkey}:pending_settlements`;

    if (!redisClient.client.isOpen) {
        await redisClient.client.connect();
    }

    // Delete all corrupted data
    await redisClient.client.del(key);
    console.log(`Deleted ${key}`);

    // Insert clean test data
    const validItem = {
        bidId: "test_spread_001",
        agent: agentPubkey,
        amount: 0.05,
        points: 5,
        duration: 12,
        price: 0.004,
        timestamp: Date.now()
    };

    await redisClient.client.rPush(key, JSON.stringify(validItem));
    console.log(`Inserted valid test item:`, validItem);

    // Verify
    const items = await redisClient.client.lRange(key, 0, -1);
    console.log(`Verification - Items in list:`, items.length);
    console.log(`First item (raw):`, items[0]);

    // Parse test
    try {
        const parsed = JSON.parse(items[0]);
        console.log("Parse successful:", parsed);
    } catch (e) {
        console.error("Parse FAILED:", e);
    }

    process.exit(0);
}

main();
