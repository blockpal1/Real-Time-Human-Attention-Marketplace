import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    SystemProgram,
    Keypair,
    SYSVAR_RENT_PUBKEY,
    TransactionMessage,
    VersionedTransaction
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token';
import { redisClient } from '../utils/redis';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PAYMENT_ROUTER_PROGRAM_ID = new PublicKey(process.env.PAYMENT_ROUTER_PROGRAM_ID || 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"); // Mainnet/Devnet specific
const GAS_STATION_THRESHOLD = 5.00; // $5.00 USDC

const connection = new Connection(RPC_URL, 'confirmed');

// Load Router Admin Keypair (Authority)
// Required for signing close_settlement instructions
const getRouterAdminKeypair = (): Keypair => {
    const secret = process.env.ROUTER_ADMIN_KEYPAIR;
    if (!secret) throw new Error("Missing ROUTER_ADMIN_KEYPAIR env");
    try {
        const secretKey = Uint8Array.from(JSON.parse(secret));
        return Keypair.fromSecretKey(secretKey);
    } catch (e) {
        throw new Error("Invalid ROUTER_ADMIN_KEYPAIR format. Must be JSON array.");
    }
};

// Load Fee Payer Keypair (Platform Wallet)
// Used when subsidizing gas
const getFeePayerKeypair = (): Keypair => {
    const secret = process.env.FEE_PAYER_KEYPAIR || process.env.ROUTER_ADMIN_KEYPAIR;
    if (!secret) throw new Error("Missing FEE_PAYER_KEYPAIR env");
    try {
        const secretKey = Uint8Array.from(JSON.parse(secret));
        return Keypair.fromSecretKey(secretKey);
    } catch (e) {
        throw new Error("Invalid FEE_PAYER_KEYPAIR format.");
    }
};

export class SettlementService {

    /**
     * Phase 1: Prepare Claim
     * Locks pending settlements, aggregates them, and builds the signed transaction.
     * Returns the transaction and claimId.
     */
    static async prepareClaim(userPubkey: string) {
        // Generate Claim ID
        const claimId = `claim_${Date.now()}`;

        // 1. Atomically move logs to processing
        const pendingSettlements = await redisClient.lockPendingSettlements(userPubkey, claimId);

        if (!pendingSettlements || pendingSettlements.length === 0) {
            return { error: "No pending earnings to claim" };
        }

        console.log(`[Settlement] Preparing claim ${claimId} with ${pendingSettlements.length} items for ${userPubkey}`);

        try {

            // 2. Aggregate by Campaign (BidId)
            // Map: bidId -> { totalSeconds, price, agent, points, totalAmount }
            const campaignMap: Record<string, { totalSeconds: number, price: number, agent: string, points: number, totalAmount: number }> = {};

            for (const item of pendingSettlements) {
                // Skip invalid items
                if (!item.agent || !item.price || !item.duration) continue;

                if (!campaignMap[item.bidId]) {
                    campaignMap[item.bidId] = {
                        totalSeconds: 0,
                        price: item.price,
                        agent: item.agent,
                        points: 0,
                        totalAmount: 0
                    };
                }

                campaignMap[item.bidId].totalSeconds += item.duration;
                campaignMap[item.bidId].points += (item.points || 0);
                campaignMap[item.bidId].totalAmount += (item.amount || 0);
            }

            // 3. Build Instructions
            const instructions: TransactionInstruction[] = [];
            const userKey = new PublicKey(userPubkey);
            const routerAdmin = getRouterAdminKeypair();

            let totalUSDCToClaim = 0;

            // Ensure User ATA exists
            const userATA = await getAssociatedTokenAddress(USDC_MINT, userKey);

            // Calculate Total FIRST
            for (const campaign of Object.values(campaignMap)) {
                totalUSDCToClaim += campaign.totalAmount;
            }

            // Conditional Gas Logic
            const isSubsidized = totalUSDCToClaim >= GAS_STATION_THRESHOLD;
            const feePayerKey = isSubsidized ? getFeePayerKeypair().publicKey : userKey;

            // Add ATA creation instruction (Idempotent)
            instructions.push(
                createAssociatedTokenAccountIdempotentInstruction(
                    feePayerKey, // Payer of rent
                    userATA,     // Associated Account
                    userKey,     // Owner
                    USDC_MINT    // Mint
                )
            );

            // Build CloseSettlement instructions
            const discriminator = Buffer.from('2df753b718660044', 'hex'); // close_settlement

            for (const [bidId, data] of Object.entries(campaignMap)) {
                if (data.totalAmount < 0.000001) continue; // Skip dust

                const agentKey = new PublicKey(data.agent);
                const [escrowPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("escrow"), agentKey.toBuffer()],
                    PAYMENT_ROUTER_PROGRAM_ID
                );
                const vaultATA = await getAssociatedTokenAddress(USDC_MINT, escrowPDA, true);
                const [marketConfigPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("market_config")],
                    PAYMENT_ROUTER_PROGRAM_ID
                );

                // Instruction Data: discriminator + verified_seconds + agreed_price + nonce
                const dataBuffer = Buffer.alloc(8 + 8 + 8 + 8);
                dataBuffer.set(discriminator, 0);
                dataBuffer.writeBigUInt64LE(BigInt(Math.floor(data.totalSeconds)), 8);

                // Convert Price to Atomic Units (6 decimals)
                const atomicPrice = BigInt(Math.round(data.price * 1_000_000));
                dataBuffer.writeBigUInt64LE(atomicPrice, 16);

                // Nonce: Use timestamp + random for unique tx
                const nonce = BigInt(Date.now());
                dataBuffer.writeBigUInt64LE(nonce, 24);

                const keys = [
                    { pubkey: routerAdmin.publicKey, isSigner: true, isWritable: false }, // Router Authority
                    { pubkey: escrowPDA, isSigner: false, isWritable: true },
                    { pubkey: vaultATA, isSigner: false, isWritable: true },
                    { pubkey: userATA, isSigner: false, isWritable: true }, // User Wallet (ATA)
                    { pubkey: marketConfigPDA, isSigner: false, isWritable: false },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
                ];

                instructions.push(new TransactionInstruction({
                    keys,
                    programId: PAYMENT_ROUTER_PROGRAM_ID,
                    data: dataBuffer
                }));
            }

            if (totalUSDCToClaim === 0 && instructions.length <= 1) {
                // Nothing to claim, revert lock
                await this.abortClaim(userPubkey, claimId);
                return { error: "No valid USDC settlements found." };
            }

            // 4. Build Transaction
            const { blockhash } = await connection.getLatestBlockhash();
            const tx = new Transaction();
            tx.recentBlockhash = blockhash;
            tx.feePayer = feePayerKey;
            tx.add(...instructions);

            // 5. Signing Logic
            // Router Admin always signs (as Authority)
            tx.partialSign(routerAdmin);

            // If Subsidized, Fee Payer (Server) signs
            if (isSubsidized) {
                const feePayer = getFeePayerKeypair();
                // If feePayer is distinct from routerAdmin, sign with it too
                // Note: If routerAdmin == feePayer, it's already signed both roles
                if (!feePayer.publicKey.equals(routerAdmin.publicKey)) {
                    tx.partialSign(feePayer);
                }
            }

            // 6. Serialize
            const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');

            return {
                transaction: serializedTx,
                isSubsidized,
                amount: totalUSDCToClaim,
                claimId,
                status: 'processing'
            };

        } catch (error) {
            console.error(`[Settlement] CRASH in prepareClaim:`, error);
            // AUTO-ABORT: Restore data to pending so user can retry
            await this.abortClaim(userPubkey, claimId);
            throw error;
        }
    }

    /**
     * Phase 2: Finalize Claim
     * Called after transaction is confirmed on-chain (or if broadcast by backend).
     * Deletes the processing logs, effectively updating the user's ledger.
     */
    static async finalizeClaim(userPubkey: string, claimId: string) {
        await redisClient.deleteProcessingSettlements(claimId);
        console.log(`[Settlement] Claim ${claimId} finalized for ${userPubkey}`);

        // Optionally update the scalar "Virtual Balance" to 0 (or sync) 
        // But since we are aggregating logs, scalar balance might drift or be redundant.
        // For UI consistency, we should decrement the scalar balance by the claimed amount?
        // Wait, Redis scalar balance is for fast display.
        // Ideally we reset it?
        // But we might have new earnings incoming while claim is processing.
        // Complex. For now, leave scalar balance as "Lifetime Earnings" or assume frontend deducts locally?
        // Or we assume log-based truth.
    }

    /**
     * Abort Claim
     * Restores logs from processing back to pending.
     */
    static async abortClaim(userPubkey: string, claimId: string) {
        await redisClient.restoreProcessingToPending(userPubkey, claimId);
        console.log(`[Settlement] Claim ${claimId} aborted/restored for ${userPubkey}`);
    }
}
