import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
    PublicKey,
    SystemProgram,
    Connection,
    Keypair
} from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction
} from "@solana/spl-token";

// USDC Mint addresses
const USDC_MINT_MAINNET = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const USDC_MINT_DEVNET = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

// Program ID (update after deployment)
const FEE_SPLITTER_PROGRAM_ID = new PublicKey("FeeSpL1tXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX");

export interface SplitterConfig {
    authority: PublicKey;
    treasury: PublicKey;
    defaultReferrerBps: number;
    totalSplit: BN;
    bump: number;
}

export class FeeSplitterClient {
    private connection: Connection;
    private programId: PublicKey;
    private usdcMint: PublicKey;

    constructor(
        connection: Connection,
        programId: PublicKey = FEE_SPLITTER_PROGRAM_ID,
        usdcMint: PublicKey = USDC_MINT_MAINNET
    ) {
        this.connection = connection;
        this.programId = programId;
        this.usdcMint = usdcMint;
    }

    /**
     * Get the config PDA address
     */
    getConfigPDA(): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("config")],
            this.programId
        );
    }

    /**
     * Initialize the splitter config
     */
    async createInitializeInstruction(
        authority: PublicKey,
        treasury: PublicKey,
        defaultReferrerBps: number = 2000 // 20%
    ): Promise<anchor.web3.TransactionInstruction> {
        const [configPDA] = this.getConfigPDA();

        // Create the instruction data
        const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]); // initialize
        const data = Buffer.alloc(8 + 32 + 2);
        discriminator.copy(data, 0);
        treasury.toBuffer().copy(data, 8);
        data.writeUInt16LE(defaultReferrerBps, 8 + 32);

        return new anchor.web3.TransactionInstruction({
            keys: [
                { pubkey: configPDA, isSigner: false, isWritable: true },
                { pubkey: authority, isSigner: true, isWritable: true },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data,
        });
    }

    /**
     * Create a split payment instruction
     */
    async createSplitPaymentInstruction(
        payer: PublicKey,
        referrer: PublicKey,
        treasury: PublicKey,
        amount: BN,
        referrerBps: number = 2000 // 20%
    ): Promise<anchor.web3.TransactionInstruction[]> {
        const [configPDA] = this.getConfigPDA();
        const instructions: anchor.web3.TransactionInstruction[] = [];

        // Get token accounts
        const payerTokenAccount = await getAssociatedTokenAddress(
            this.usdcMint,
            payer
        );
        const treasuryTokenAccount = await getAssociatedTokenAddress(
            this.usdcMint,
            treasury
        );
        const referrerTokenAccount = await getAssociatedTokenAddress(
            this.usdcMint,
            referrer
        );

        // Check if referrer ATA exists, create if not
        const referrerAccountInfo = await this.connection.getAccountInfo(referrerTokenAccount);
        if (!referrerAccountInfo) {
            instructions.push(
                createAssociatedTokenAccountInstruction(
                    payer,
                    referrerTokenAccount,
                    referrer,
                    this.usdcMint
                )
            );
        }

        // Create the split payment instruction data
        const discriminator = Buffer.from([139, 132, 44, 76, 82, 156, 60, 98]); // split_payment
        const data = Buffer.alloc(8 + 8 + 2);
        discriminator.copy(data, 0);
        data.writeBigUInt64LE(BigInt(amount.toString()), 8);
        data.writeUInt16LE(referrerBps, 16);

        instructions.push(new anchor.web3.TransactionInstruction({
            keys: [
                { pubkey: configPDA, isSigner: false, isWritable: true },
                { pubkey: payer, isSigner: true, isWritable: true },
                { pubkey: payerTokenAccount, isSigner: false, isWritable: true },
                { pubkey: treasuryTokenAccount, isSigner: false, isWritable: true },
                { pubkey: referrerTokenAccount, isSigner: false, isWritable: true },
                { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
            ],
            programId: this.programId,
            data,
        }));

        return instructions;
    }

    /**
     * Calculate the split amounts
     */
    calculateSplit(
        totalAmount: number,
        referrerBps: number = 2000
    ): { treasuryAmount: number; referrerAmount: number } {
        const referrerAmount = Math.floor((totalAmount * referrerBps) / 10000);
        const treasuryAmount = totalAmount - referrerAmount;
        return { treasuryAmount, referrerAmount };
    }

    /**
     * Get the config account data
     */
    async getConfig(): Promise<SplitterConfig | null> {
        const [configPDA] = this.getConfigPDA();
        const accountInfo = await this.connection.getAccountInfo(configPDA);

        if (!accountInfo) {
            return null;
        }

        // Parse the account data (skip 8 byte discriminator)
        const data = accountInfo.data.slice(8);
        return {
            authority: new PublicKey(data.slice(0, 32)),
            treasury: new PublicKey(data.slice(32, 64)),
            defaultReferrerBps: data.readUInt16LE(64),
            totalSplit: new BN(data.slice(66, 74), 'le'),
            bump: data[74],
        };
    }
}

// Export for use in backend
export { FEE_SPLITTER_PROGRAM_ID, USDC_MINT_MAINNET, USDC_MINT_DEVNET };
