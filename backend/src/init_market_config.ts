/**
 * Initialize Market Config - Anchor Compatible
 * 
 * One-time setup script to initialize the market_config PDA on the Payment Router program.
 * Uses the correct Anchor discriminator for 'initialize_market_config'.
 */

import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    sendAndConfirmTransaction
} from '@solana/web3.js';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
dotenv.config();

const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PAYMENT_ROUTER_PROGRAM_ID = new PublicKey(
    process.env.PAYMENT_ROUTER_PROGRAM_ID || 'H4zbWKDAGnrJv9CTptjVvxKCDB59Mv2KpiVDx9d4jDaz'
);

// Calculate Anchor discriminator: sha256("global:<instruction_name>")[0..8]
function getAnchorDiscriminator(instructionName: string): Buffer {
    const hash = crypto.createHash('sha256');
    hash.update(`global:${instructionName}`);
    return hash.digest().slice(0, 8);
}

async function main() {
    console.log("=== Initializing Market Config (Anchor) ===");
    console.log("Program ID:", PAYMENT_ROUTER_PROGRAM_ID.toBase58());
    console.log("RPC URL:", RPC_URL);

    // Load Admin Keypair
    const adminSecret = process.env.ROUTER_ADMIN_KEYPAIR;
    if (!adminSecret) {
        console.error("Missing ROUTER_ADMIN_KEYPAIR in .env");
        process.exit(1);
    }
    const adminKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(adminSecret)));
    console.log("Admin Pubkey:", adminKeypair.publicKey.toBase58());

    const connection = new Connection(RPC_URL, 'confirmed');

    // Check balance
    const balance = await connection.getBalance(adminKeypair.publicKey);
    console.log("Admin balance:", balance / 1e9, "SOL");

    if (balance < 0.01 * 1e9) {
        console.error("Admin needs more SOL for rent. Please airdrop.");
        process.exit(1);
    }

    // Derive market_config PDA
    const [marketConfigPDA, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from("market_config")],
        PAYMENT_ROUTER_PROGRAM_ID
    );
    console.log("Market Config PDA:", marketConfigPDA.toBase58());
    console.log("Bump:", bump);

    // Check if already initialized
    const existingAccount = await connection.getAccountInfo(marketConfigPDA);
    if (existingAccount) {
        console.log("✅ Market Config already initialized!");
        console.log("Account size:", existingAccount.data.length, "bytes");
        console.log("Owner:", existingAccount.owner.toBase58());
        process.exit(0);
    }

    console.log("Market Config NOT initialized. Initializing now...");

    // Build instruction data
    // Discriminator for Anchor instruction 'initialize_market_config'
    const discriminator = getAnchorDiscriminator('initialize_market_config');
    console.log("Discriminator:", discriminator.toString('hex'));

    // Fee basis points (5% = 500 bps)
    const feeBps = 500;
    const dataBuffer = Buffer.alloc(8 + 2);
    discriminator.copy(dataBuffer, 0);
    dataBuffer.writeUInt16LE(feeBps, 8);

    console.log("Instruction data (hex):", dataBuffer.toString('hex'));

    const instruction = new TransactionInstruction({
        keys: [
            { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: marketConfigPDA, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: PAYMENT_ROUTER_PROGRAM_ID,
        data: dataBuffer
    });

    const tx = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = adminKeypair.publicKey;

    try {
        console.log("Sending transaction...");
        const signature = await sendAndConfirmTransaction(connection, tx, [adminKeypair], {
            commitment: 'confirmed'
        });
        console.log("✅ Market Config initialized!");
        console.log("Tx Signature:", signature);
        console.log("Explorer: https://explorer.solana.com/tx/" + signature + "?cluster=devnet");
    } catch (e: any) {
        console.error("❌ Initialization failed:", e.message);
        if (e.logs) {
            console.log("\nProgram logs:");
            e.logs.forEach((log: string) => console.log("  ", log));
        }
    }

    process.exit(0);
}

main();
