import { Keypair } from '@solana/web3.js';
import { MockLedger } from './ledger';
import { PaymentRouter } from './router';

async function runSimulation() {
    console.log('=== Starting Attention Marketplace Payment Simulation ===\n');

    // 1. Setup Environment
    const ledger = new MockLedger();
    const router = new PaymentRouter(ledger);

    // 2. Setup Actors
    const agent = Keypair.generate();
    const user = Keypair.generate();

    // 3. Fund Agent (Airdrop)
    console.log('-> Airdropping funds to Agent...');
    ledger.airdrop(agent.publicKey, 100); // 100 USDC
    ledger.dump();

    // 4. Session Start: Agent locks funds for a task
    const TASK_BUDGET = 10; // 10 USDC
    const PRICE_PER_SEC = 100_000; // 0.10 USDC/sec (Large for demo)
    const SESSION_ID = "sess_12345";

    console.log(`-> Agent creates Escrow for Task (Budget: ${TASK_BUDGET} USDC)...`);
    await router.createEscrow(SESSION_ID, agent, TASK_BUDGET);
    ledger.dump();

    // 5. Attention Happens (Simulate 5 seconds passing)
    console.log('-> Simulating 5 seconds of verified attention...');
    const VERIFIED_SECONDS = 5;

    // 6. Settlement
    console.log('-> Triggering Settlement...');
    await router.settle(SESSION_ID, user.publicKey, VERIFIED_SECONDS, PRICE_PER_SEC);

    // 7. Final State
    console.log('\n=== Final Ledger State ===');
    ledger.dump();

    // Verify
    const userBal = ledger.getBalance(user.publicKey);
    const expected = (5 * 100000) / 1000000; // 0.5 USDC
    if (userBal === expected) {
        console.log(`SUCCESS: User received exactly ${expected} USDC`);
    } else {
        console.error(`FAILURE: User balance is ${userBal}, expected ${expected}`);
    }
}

runSimulation();
