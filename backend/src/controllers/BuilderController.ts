import { Request, Response } from 'express';
import {
    Connection,
    PublicKey,
    Transaction,
    TransactionInstruction
} from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { redisClient } from '../utils/redis';

// Config
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const PAYMENT_ROUTER_PROGRAM_ID = new PublicKey(process.env.PAYMENT_ROUTER_PROGRAM_ID || 'EZPqKzvizknKZmkYC69NgiBeCs1uDVfET1MQpC7tQvin');
const connection = new Connection(RPC_URL, 'confirmed');

export class BuilderController {

    static async getBalance(req: Request, res: Response) {
        try {
            const { code } = req.params;

            // Pad code to 32 bytes for PDA derivation
            const codeBuffer = Buffer.alloc(32);
            Buffer.from(code).copy(codeBuffer);

            const [builderPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("builder"), codeBuffer],
                PAYMENT_ROUTER_PROGRAM_ID
            );

            const accountInfo = await connection.getAccountInfo(builderPDA);

            if (!accountInfo) {
                return res.status(404).json({ error: "Builder account not found on-chain" });
            }

            // Parse Data
            // Layout: 8 (disc) + 32 (code) + 32 (wallet) + 8 (balance) + 8 (total) + 1 (bump)
            const data = accountInfo.data;
            if (data.length < 89) {
                return res.status(500).json({ error: "Invalid account data size" });
            }

            let offset = 8; // Skip discriminator
            // Skip code (32)
            offset += 32;

            const wallet = new PublicKey(data.subarray(offset, offset + 32));
            offset += 32;

            const balance = data.readBigUInt64LE(offset);
            offset += 8;

            const totalEarned = data.readBigUInt64LE(offset);

            return res.json({
                code,
                wallet: wallet.toBase58(),
                claimableBalance: Number(balance) / 1_000_000, // Convert USDC atomic to decimal
                lifetimeEarnings: Number(totalEarned) / 1_000_000
            });

        } catch (error: any) {
            console.error("[Builder] Get Balance Error:", error);
            res.status(500).json({ error: error.message });
        }
    }

    static async createClaimTransaction(req: Request, res: Response) {
        try {
            const { code } = req.params;
            const { wallet } = req.body; // Builder's public key who will sign

            if (!wallet) return res.status(400).json({ error: "Wallet public key required" });

            const builderWallet = new PublicKey(wallet);
            const codeBuffer = Buffer.alloc(32);
            Buffer.from(code).copy(codeBuffer);

            const [builderPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("builder"), codeBuffer],
                PAYMENT_ROUTER_PROGRAM_ID
            );

            // Fee Vault PDAs
            const [feeVaultStatePDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("fee_vault_state")],
                PAYMENT_ROUTER_PROGRAM_ID
            );
            const [feeVaultPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("fee_vault"), feeVaultStatePDA.toBuffer()],
                PAYMENT_ROUTER_PROGRAM_ID
            );

            // Discriminator for claim_builder_balance
            // input: global:claim_builder_balance
            // We need to calculate this or pre-compute it.
            // Placeholder: I'll use a hardcoded value if I know it, or we rely on the client lib.
            // Since this is backend, I need the exact discriminator.
            // "global:claim_builder_balance" -> sha256 -> first 8 bytes
            // I'll assume I can't easily calculate sha256 here without import, but I can import crypto.
            // Discriminator: sha256("global:claim_builder_balance")

            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update('global:claim_builder_balance').digest();
            const discriminator = hash.subarray(0, 8);

            // Derive Builder ATA
            const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Devnet
            const builderATA = getAssociatedTokenAddressSync(USDC_MINT, builderWallet);

            const ix = new TransactionInstruction({
                programId: PAYMENT_ROUTER_PROGRAM_ID,
                keys: [
                    { pubkey: builderWallet, isSigner: true, isWritable: true },
                    { pubkey: builderPDA, isSigner: false, isWritable: true },
                    { pubkey: builderATA, isSigner: false, isWritable: true },
                    { pubkey: feeVaultStatePDA, isSigner: false, isWritable: true },
                    { pubkey: feeVaultPDA, isSigner: false, isWritable: true },
                    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
                ],
                data: discriminator
            });

            const { blockhash } = await connection.getLatestBlockhash();
            const tx = new Transaction();
            tx.recentBlockhash = blockhash;
            tx.feePayer = builderWallet;
            tx.add(ix);

            const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');

            res.json({
                transaction: serialized,
                message: "Sign this transaction to claim your earnings."
            });

        } catch (error: any) {
            console.error("[Builder] Create Claim Tx Error:", error);
            res.status(500).json({ error: error.message });
        }
    }

    static async updateWalletTransaction(req: Request, res: Response) {
        try {
            const { code } = req.params;
            const { oldWallet, newWallet } = req.body;

            if (!oldWallet || !newWallet) return res.status(400).json({ error: "oldWallet and newWallet required" });

            const oldKey = new PublicKey(oldWallet);
            const newKey = new PublicKey(newWallet);
            const codeBuffer = Buffer.alloc(32);
            Buffer.from(code).copy(codeBuffer);

            const [builderPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("builder"), codeBuffer],
                PAYMENT_ROUTER_PROGRAM_ID
            );

            // Discriminator: global:update_builder_wallet
            const crypto = require('crypto');
            const hash = crypto.createHash('sha256').update('global:update_builder_wallet').digest();
            const discriminator = hash.subarray(0, 8);

            const ix = new TransactionInstruction({
                programId: PAYMENT_ROUTER_PROGRAM_ID,
                keys: [
                    { pubkey: oldKey, isSigner: true, isWritable: true },
                    { pubkey: builderPDA, isSigner: false, isWritable: true },
                    { pubkey: newKey, isSigner: false, isWritable: false },
                ],
                data: discriminator
            });

            const { blockhash } = await connection.getLatestBlockhash();
            const tx = new Transaction();
            tx.recentBlockhash = blockhash;
            tx.feePayer = oldKey;
            tx.add(ix);

            const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');

            res.json({
                transaction: serialized,
                message: "Sign this transaction with your OLD wallet to authorize the update."
            });

        } catch (error: any) {
            console.error("[Builder] Update Wallet Tx Error:", error);
            res.status(500).json({ error: error.message });
        }
    }
}
