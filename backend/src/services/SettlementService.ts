import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction,
    Keypair,
    SystemProgram
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token';
import crypto from 'crypto';
import { redisClient } from '../utils/redis';

// Configuration
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const IS_DEVNET = RPC_URL.includes('devnet');
const PAYMENT_ROUTER_PROGRAM_ID = new PublicKey(process.env.PAYMENT_ROUTER_PROGRAM_ID || 'H4zbWKDAGnrJv9CTptjVvxKCDB59Mv2KpiVDx9d4jDaz');

// USDC Mint - different on Devnet vs Mainnet
const MAINNET_USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const DEVNET_USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Standard Devnet USDC
const USDC_MINT = IS_DEVNET ? DEVNET_USDC_MINT : MAINNET_USDC_MINT;

const GAS_STATION_THRESHOLD = 5.00; // $5.00 USDC

const connection = new Connection(RPC_URL, 'confirmed');

// Load Router Admin Keypair (Authority)
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
     * Phase 1: Create Claim Intent (Deferred Locking)
     * 
     * READS pending settlements WITHOUT locking them.
     * Builds transaction and stores a "claim intent" with 5-min TTL.
     * If user abandons, intent expires harmlessly - funds never locked.
     */
    static async createClaimIntent(userPubkey: string) {
        // CRIT-5 FIX: Use cryptographically random claim ID instead of predictable Date.now()
        const claimId = `claim_${crypto.randomBytes(16).toString('hex')}`;

        // 1. READ ONLY - no locking
        const pendingSettlements = await redisClient.getPendingSettlements(userPubkey);

        if (!pendingSettlements || pendingSettlements.length === 0) {
            return { error: "No pending earnings to claim" };
        }

        console.log(`[Settlement] Creating intent ${claimId} with ${pendingSettlements.length} items for ${userPubkey}`);

        try {
            // 2. Aggregate by Campaign (BidId)
            const campaignMap: Record<string, {
                totalSeconds: number,
                price: number,
                agent: string,
                points: number,
                totalAmount: number,
                builderCode: string | null
            }> = {};

            for (const item of pendingSettlements) {
                if (!item.agent || !item.price || !item.duration) continue;

                if (!campaignMap[item.bidId]) {
                    campaignMap[item.bidId] = {
                        totalSeconds: 0,
                        price: item.price,
                        agent: item.agent,
                        points: 0,
                        totalAmount: 0,
                        builderCode: item.builderCode || null
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
            const userATA = await getAssociatedTokenAddress(USDC_MINT, userKey);

            for (const campaign of Object.values(campaignMap)) {
                totalUSDCToClaim += campaign.totalAmount;
            }

            const isSubsidized = totalUSDCToClaim >= GAS_STATION_THRESHOLD;
            const feePayerKey = isSubsidized ? getFeePayerKeypair().publicKey : userKey;

            // ATA creation instruction
            instructions.push(
                createAssociatedTokenAccountIdempotentInstruction(
                    feePayerKey,
                    userATA,
                    userKey,
                    USDC_MINT
                )
            );

            // Build CloseSettlement instructions
            // Discriminator for close_settlement: global:close_settlement
            // sha256("global:close_settlement").slice(0, 8) = 2df753b718660044
            const discriminator = Buffer.from('2df753b718660044', 'hex');

            // Fee Vault State derivation
            const [feeVaultStatePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("fee_vault_state")],
                PAYMENT_ROUTER_PROGRAM_ID
            );
            // Fee Vault Token Account (owned by FeeVaultState)
            // Seeds: [b"fee_vault", fee_vault_state.key().as_ref()]
            const [feeVaultPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("fee_vault"), feeVaultStatePDA.toBuffer()],
                PAYMENT_ROUTER_PROGRAM_ID
            );


            for (const [bidId, data] of Object.entries(campaignMap)) {
                if (data.totalAmount < 0.000001) continue;

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

                // Handle Builder Code logic
                let builderBalancePDA = PAYMENT_ROUTER_PROGRAM_ID; // Placeholder if none
                let builderCodeBytes = Buffer.alloc(32);
                let hasBuilder = false;

                if (data.builderCode) {
                    // Pad string to 32 bytes
                    const codeBuffer = Buffer.from(data.builderCode);
                    if (codeBuffer.length <= 32) {
                        codeBuffer.copy(builderCodeBytes);

                        // Derive BuilderBalance PDA
                        const [pda] = PublicKey.findProgramAddressSync(
                            [Buffer.from("builder"), builderCodeBytes],
                            PAYMENT_ROUTER_PROGRAM_ID
                        );
                        builderBalancePDA = pda;
                        hasBuilder = true;
                    }
                }

                // Data Buffer Layout:
                // 8 bytes discriminator
                // 8 bytes verified_seconds (u64)
                // 8 bytes price_per_second (u64)
                // 8 bytes nonce (u64)
                // 1 byte option tag (0 or 1)
                // 32 bytes builder_code (only if option=1)

                const dataSize = 8 + 8 + 8 + 8 + 1 + (hasBuilder ? 32 : 0);
                const dataBuffer = Buffer.alloc(dataSize);

                let offset = 0;
                dataBuffer.set(discriminator, offset); offset += 8;

                dataBuffer.writeBigUInt64LE(BigInt(Math.floor(data.totalSeconds)), offset); offset += 8;

                const atomicPrice = BigInt(Math.round(data.price * 1_000_000));
                dataBuffer.writeBigUInt64LE(atomicPrice, offset); offset += 8;

                const nonce = BigInt(Date.now());
                dataBuffer.writeBigUInt64LE(nonce, offset); offset += 8;

                if (hasBuilder) {
                    dataBuffer.writeUInt8(1, offset); offset += 1; // Some
                    builderCodeBytes.copy(dataBuffer, offset); offset += 32;
                } else {
                    dataBuffer.writeUInt8(0, offset); offset += 1; // None
                }

                const keys = [
                    { pubkey: routerAdmin.publicKey, isSigner: true, isWritable: false },
                    { pubkey: escrowPDA, isSigner: false, isWritable: true },
                    { pubkey: vaultATA, isSigner: false, isWritable: true },
                    { pubkey: userATA, isSigner: false, isWritable: true },

                    // Fee Vault Accounts
                    { pubkey: feeVaultStatePDA, isSigner: false, isWritable: true },
                    { pubkey: feeVaultPDA, isSigner: false, isWritable: true },

                    // Builder Balance (Optional) - Pass ProgramID if None
                    { pubkey: hasBuilder ? builderBalancePDA : PAYMENT_ROUTER_PROGRAM_ID, isSigner: false, isWritable: hasBuilder }, // Writable if real PDA

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
                return { error: "No valid USDC settlements found." };
            }

            // 4. Build Transaction
            const { blockhash } = await connection.getLatestBlockhash();
            const tx = new Transaction();
            tx.recentBlockhash = blockhash;
            tx.feePayer = feePayerKey;
            tx.add(...instructions);

            // 5. Partial sign with Router Admin (Authority)
            tx.partialSign(routerAdmin);

            if (isSubsidized) {
                const feePayer = getFeePayerKeypair();
                if (!feePayer.publicKey.equals(routerAdmin.publicKey)) {
                    tx.partialSign(feePayer);
                }
            }

            // 6. Serialize
            const serializedTx = tx.serialize({ requireAllSignatures: false }).toString('base64');

            // 7. Store Claim Intent (NOT locking funds yet!)
            await redisClient.setClaimIntent(claimId, {
                userPubkey,
                amount: totalUSDCToClaim,
                settlements: pendingSettlements,
                transactionBase64: serializedTx,
                createdAt: Date.now()
            });

            console.log(`[Settlement] Intent ${claimId} created: $${totalUSDCToClaim.toFixed(4)} USDC`);

            return {
                transaction: serializedTx,
                isSubsidized,
                amount: totalUSDCToClaim,
                claimId,
                status: 'pending_signature'
            };

        } catch (error) {
            console.error(`[Settlement] Error creating intent:`, error);
            throw error;
        }
    }

    /**
     * Phase 2: Execute Claim Intent (Deferred Locking)
     * 
     * Called when user submits signed transaction.
     * NOW we atomically lock funds, then broadcast.
     */
    static async executeClaimIntent(claimId: string, signedTransaction: string) {
        // 1. Validate intent exists
        const intent = await redisClient.getClaimIntent(claimId);
        if (!intent) {
            return { error: "Claim expired or already processed. Please try again." };
        }

        console.log(`[Settlement] Executing intent ${claimId} for ${intent.userPubkey}`);

        // 2. Atomically lock the settlements NOW
        const locked = await redisClient.atomicLockSettlements(
            intent.userPubkey,
            claimId,
            intent.settlements
        );

        if (!locked) {
            // Settlements were already claimed (maybe by another intent)
            await redisClient.deleteClaimIntent(claimId);
            return { error: "Settlements already claimed or modified. Please refresh and try again." };
        }

        try {
            // 3. Deserialize the signed transaction
            const txBuffer = Buffer.from(signedTransaction, 'base64');
            const signedTx = Transaction.from(txBuffer);

            // CRIT-2 FIX: Verify signed transaction matches original intent
            const originalTx = Transaction.from(Buffer.from(intent.transactionBase64, 'base64'));

            // Compare instruction count
            if (signedTx.instructions.length !== originalTx.instructions.length) {
                await redisClient.restoreProcessingToPending(intent.userPubkey, claimId);
                await redisClient.deleteClaimIntent(claimId);
                return { error: "Transaction modified: instruction count mismatch" };
            }

            // Compare each instruction's program, data, and accounts
            for (let i = 0; i < signedTx.instructions.length; i++) {
                const signedIx = signedTx.instructions[i];
                const originalIx = originalTx.instructions[i];

                if (!signedIx.programId.equals(originalIx.programId) ||
                    !signedIx.data.equals(originalIx.data) ||
                    signedIx.keys.length !== originalIx.keys.length) {
                    await redisClient.restoreProcessingToPending(intent.userPubkey, claimId);
                    await redisClient.deleteClaimIntent(claimId);
                    return { error: "Transaction modified: instruction data mismatch" };
                }

                // Verify all account keys match (prevents recipient substitution)
                for (let j = 0; j < signedIx.keys.length; j++) {
                    if (!signedIx.keys[j].pubkey.equals(originalIx.keys[j].pubkey)) {
                        await redisClient.restoreProcessingToPending(intent.userPubkey, claimId);
                        await redisClient.deleteClaimIntent(claimId);
                        return { error: "Transaction modified: account keys changed" };
                    }
                }
            }

            console.log(`[Settlement] Transaction verified, broadcasting for ${claimId}...`);
            const txHash = await connection.sendRawTransaction(signedTx.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed'
            });

            console.log(`[Settlement] Transaction sent: ${txHash}`);

            // 4. Wait for confirmation
            const confirmation = await connection.confirmTransaction(txHash, 'confirmed');
            if (confirmation.value.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
            }

            // 5. Success: Cleanup
            await redisClient.deleteClaimIntent(claimId);
            await redisClient.deleteProcessingSettlements(claimId);
            await redisClient.resetBalance(intent.userPubkey);  // Clear pending balance counter

            console.log(`[Settlement] Claim ${claimId} SUCCESS: ${txHash}`);

            return {
                success: true,
                txHash,
                amount: intent.amount
            };

        } catch (error: any) {
            console.error(`[Settlement] Broadcast failed for ${claimId}:`, error);

            // 6. Failure: Restore funds to pending
            await redisClient.restoreProcessingToPending(intent.userPubkey, claimId);
            await redisClient.deleteClaimIntent(claimId);

            return { error: `Transaction failed: ${error.message}` };
        }
    }

    /**
     * Legacy: Abort Claim (for manual recovery if needed)
     */
    static async abortClaim(userPubkey: string, claimId: string) {
        await redisClient.restoreProcessingToPending(userPubkey, claimId);
        console.log(`[Settlement] Claim ${claimId} aborted/restored for ${userPubkey}`);
    }
}
