const { Connection, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction, PublicKey } = require('@solana/web3.js');
const fs = require('fs');

// CONFIG
const CONNECTION = new Connection("https://api.devnet.solana.com", "confirmed");
const API_URL = "http://localhost:3000/v1/verify";
const WALLET_FILE = 'agent_wallet.json';

async function getOrCreateWallet() {
    if (fs.existsSync(WALLET_FILE)) {
        const secret = JSON.parse(fs.readFileSync(WALLET_FILE));
        return Keypair.fromSecretKey(Uint8Array.from(secret));
    } else {
        const kp = Keypair.generate();
        fs.writeFileSync(WALLET_FILE, JSON.stringify(Array.from(kp.secretKey)));
        console.log("🆕 Generated new wallet and saved to " + WALLET_FILE);
        return kp;
    }
}

async function main() {
    const AGENT_WALLET = await getOrCreateWallet();
    console.log("🤖 Agent Starting...");
    console.log(`   Wallet: ${AGENT_WALLET.publicKey.toBase58()}`);

    // 1. CHECK BALANCE
    const balance = await CONNECTION.getBalance(AGENT_WALLET.publicKey);
    console.log(`   Balance: ${balance / LAMPORTS_PER_SOL} SOL`);

    if (balance < 0.1 * LAMPORTS_PER_SOL) {
        console.log("\n⚠️  CRITICAL: INSUFFICIENT FUNDS");
        console.log("   The auto-airdrop is failing (429 Rate Limit).");
        console.log("   You must manually fund this address:");
        console.log(`   👉 ${AGENT_WALLET.publicKey.toBase58()}`);
        console.log("\n   Go here: https://faucet.solana.com/");
        console.log("   Paste the address above, request 1 SOL, then run this script again.");
        return;
    }

    // 2. THE PAYLOAD
    const payload = {
        duration: 30,
        quantity: 5,
        bid_per_second: 0.05
    };

    console.log("\n🔒 Attempt 1: Requesting Access (Expect 402)...");

    // Initial Request
    const resp = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    if (resp.status === 402) {
        console.log("✅ Server correctly blocked request (402 Payment Required).");

        const data = await resp.json();
        const paymentInfo = data.payment || data.invoice;

        if (!paymentInfo) {
            console.error("❌ Critical: Server did not return payment info.");
            return;
        }

        const price = paymentInfo.amount;
        const vault = paymentInfo.recipient || paymentInfo.destination;

        console.log(`\n💸 Invoice Received: ${price} USDC -> Vault: ${vault}`);

        // 3. PAY THE INVOICE
        console.log("✍️  Signing Transaction...");

        // Verify Vault Key is valid
        let vaultKey;
        try {
            vaultKey = new PublicKey(vault);
        } catch (e) {
            console.error(`❌ Error: Invalid Vault Address '${vault}'.`);
            return;
        }

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: AGENT_WALLET.publicKey,
                toPubkey: vaultKey,
                lamports: Math.floor(price * 0.001 * LAMPORTS_PER_SOL),
            })
        );

        const txHash = await sendAndConfirmTransaction(CONNECTION, transaction, [AGENT_WALLET]);
        console.log(`   Tx Confirmed: ${txHash}`);

        console.log("⏳ Waiting 25s for RPC propagation...");
        await new Promise(r => setTimeout(r, 25000));

        // 4. RETRY WITH PROOF
        console.log("\n🔓 Attempt 2: Retrying with Proof...");
        const validResp = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-Solana-Tx-Signature": txHash
            },
            body: JSON.stringify(payload)
        });

        const finalData = await validResp.json();

        if (validResp.status === 200) {
            console.log("🎉 SUCCESS! Access Granted.");
            console.log("Server Response:", finalData);
        } else {
            console.log("❌ Failed:", finalData);
        }

    } else {
        console.log("❌ Unexpected Response:", resp.status);
    }
}

main().catch(console.error);