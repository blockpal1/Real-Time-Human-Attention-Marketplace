import { Request, Response } from 'express';
import { redisClient } from '../utils/redis';
import { configService } from '../services/ConfigService';
import {
    Connection,
    PublicKey,
    Keypair,
    Transaction,
    TransactionInstruction,
    SystemProgram
} from '@solana/web3.js';
import {
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountIdempotentInstruction
} from '@solana/spl-token';

/**
 * Get platform status and configuration
 * GET /v1/admin/status
 */
export const getAdminStatus = async (req: Request, res: Response) => {
    try {
        const config = await configService.getConfig();

        // Count x402 orders from Redis sets
        const x402OrderCount = (await redisClient.getOpenOrders()).length;
        const x402FlaggedCount = (await redisClient.getRejectedOrders()).length;

        res.json({
            platform_mode: config.mode,
            fee_total: config.fee_total,
            fee_protocol: config.fee_protocol,
            fee_builder: config.fee_builder,
            min_version: config.min_version,
            stats: {
                active_x402_orders: x402OrderCount,
                flagged_content: x402FlaggedCount
            }
        });
    } catch (error) {
        console.error('Admin status error:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
};

/**
 * Update platform mode
 * POST /v1/admin/mode
 */
export const updatePlatformMode = async (req: Request, res: Response) => {
    const { mode, fee_rate } = req.body;

    if (mode && !['beta', 'hybrid', 'live'].includes(mode)) {
        return res.status(400).json({
            error: 'Invalid mode',
            valid_modes: ['beta', 'hybrid', 'live']
        });
    }

    try {
        // Update config in Redis
        const updates: any = {};
        if (mode) updates.mode = mode;
        if (fee_rate !== undefined) updates.fee_rate = fee_rate;

        await configService.setConfig(updates);
        const newConfig = await configService.getConfig();

        console.log(`[Admin] Platform config updated:`, updates);

        res.json({
            success: true,
            mode: newConfig.mode,
            fee_total: newConfig.fee_total,
            message: getModeDescription(newConfig.mode)
        });
    } catch (error) {
        console.error('Update mode error:', error);
        res.status(500).json({ error: 'Failed to update mode' });
    }
};

/**
 * Get x402 orders with rejected_tos status
 * GET /v1/admin/content/x402-flagged
 */
export const getX402FlaggedContent = async (req: Request, res: Response) => {
    try {
        const flaggedOrders: Array<{
            tx_hash: string;
            content_url: string | null;
            validation_question: string;
            status: string;
            bid_per_second: number;
            duration: number;
            quantity: number;
            created_at: number;
        }> = [];

        const rejectedIds = await redisClient.getRejectedOrders();

        // Fetch details for all rejected orders
        for (const txHash of rejectedIds) {
            const order = await redisClient.getOrder(txHash) as any;
            if (order && order.status === 'rejected_tos') {
                flaggedOrders.push({
                    tx_hash: txHash,
                    content_url: order.content_url,
                    validation_question: order.validation_question,
                    status: order.status,
                    bid_per_second: order.bid,
                    duration: order.duration,
                    quantity: order.quantity,
                    created_at: order.created_at
                });
            }
        }

        // Sort by created_at (newest first)
        flaggedOrders.sort((a, b) => b.created_at - a.created_at);

        res.json({
            count: flaggedOrders.length,
            source: 'x402',
            orders: flaggedOrders
        });
    } catch (error) {
        console.error('Get x402 flagged content error:', error);
        res.status(500).json({ error: 'Failed to get x402 flagged content' });
    }
};

/**
 * Review x402 flagged content
 * POST /v1/admin/content/x402/:tx_hash/review
 */
export const reviewX402Content = async (req: Request, res: Response) => {
    const { tx_hash } = req.params;
    const { action } = req.body;

    if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: 'Action must be "approve" or "reject"' });
    }

    const order = await redisClient.getOrder(tx_hash) as any;

    if (!order) {
        return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'rejected_tos') {
        return res.status(400).json({
            error: 'Order is not in rejected_tos status',
            current_status: order.status
        });
    }

    // Update order status
    const newStatus = action === 'approve' ? 'open' : 'rejected_tos';
    order.status = newStatus;

    // Save updated order and update set membership via updateOrderStatus helper
    await redisClient.setOrder(tx_hash, order);
    await redisClient.updateOrderStatus(tx_hash, newStatus);

    console.log(`[Admin] x402 content ${action}: ${tx_hash}`);

    res.json({
        success: true,
        tx_hash,
        new_status: order.status,
        action
    });
};

// Helper
function getModeDescription(mode: string): string {
    switch (mode) {
        case 'beta':
            return 'Sandbox mode: Points for users, no escrow required';
        case 'hybrid':
            return 'Hybrid mode: Both points (beta) and real payments active';
        case 'live':
            return 'Live mode: Real USDC escrow and payments only';
        default:
            return '';
    }
}

/**
 * Create a new Genesis Builder Code (and register on-chain)
 * POST /v1/admin/builders/create
 */
export const createBuilderCode = async (req: Request, res: Response) => {
    try {
        let { code, owner_email, description, payout_wallet } = req.body;

        if (!payout_wallet) {
            return res.status(400).json({ error: "payout_wallet is required for on-chain registration" });
        }

        // Generate random code if not provided
        if (!code) {
            const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
            code = `GEN-${randomPart}`;
        }

        // Normalize code to uppercase
        code = code.toUpperCase().trim();

        // Uniqueness check
        const exists = await redisClient.client.sIsMember('builders:registry', code);
        if (exists) {
            return res.status(400).json({
                error: 'code_exists',
                message: `Builder code "${code}" already exists`
            });
        }

        // ==========================================
        // ON-CHAIN REGISTRATION
        // ==========================================
        try {
            const PAYMENT_ROUTER_PROGRAM_ID = new PublicKey(process.env.PAYMENT_ROUTER_PROGRAM_ID || 'EZPqKzvizknKZmkYC69NgiBeCs1uDVfET1MQpC7tQvin');
            const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
            const connection = new Connection(RPC_URL, 'confirmed');

            const secret = process.env.ROUTER_ADMIN_KEYPAIR;
            if (!secret) throw new Error("Missing ROUTER_ADMIN_KEYPAIR env");
            const secretKey = Uint8Array.from(JSON.parse(secret));
            const adminKeypair = Keypair.fromSecretKey(secretKey);

            // Derive Builder PDA
            const codeBuffer = Buffer.alloc(32);
            Buffer.from(code).copy(codeBuffer);

            const [builderPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from("builder"), codeBuffer],
                PAYMENT_ROUTER_PROGRAM_ID
            );

            // Check if already initialized
            const accountInfo = await connection.getAccountInfo(builderPDA);
            if (accountInfo) {
                console.log(`[Admin] Builder PDA already exists for ${code}`);
            } else {
                console.log(`[Admin] Initializing Builder PDA for ${code}...`);

                // Discriminator for register_builder
                // sha256("global:register_builder").slice(0, 8) 
                // Using crypto to calculate
                const crypto = require('crypto');
                const discriminator = crypto.createHash('sha256').update('global:register_builder').digest().subarray(0, 8);

                // Instruction Data: Discriminator + BuilderCode (32 bytes)
                const data = Buffer.concat([discriminator, codeBuffer]);

                const builderWalletKey = new PublicKey(payout_wallet);

                // Derive market_config PDA for authorization check
                const [marketConfigPDA] = PublicKey.findProgramAddressSync(
                    [Buffer.from("market_config")],
                    PAYMENT_ROUTER_PROGRAM_ID
                );

                const ix = new TransactionInstruction({
                    programId: PAYMENT_ROUTER_PROGRAM_ID,
                    keys: [
                        { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
                        { pubkey: marketConfigPDA, isSigner: false, isWritable: false },
                        { pubkey: builderPDA, isSigner: false, isWritable: true },
                        { pubkey: builderWalletKey, isSigner: false, isWritable: false },
                        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                    ],
                    data: data
                });

                const tx = new Transaction().add(ix);
                tx.feePayer = adminKeypair.publicKey;
                const { blockhash } = await connection.getLatestBlockhash();
                tx.recentBlockhash = blockhash;

                // Sign and Send
                tx.sign(adminKeypair);
                const sig = await connection.sendRawTransaction(tx.serialize());
                await connection.confirmTransaction(sig, 'confirmed');
                console.log(`[Admin] On-chain registration success: ${sig}`);
            }
        } catch (chainError: any) {
            console.error('[Admin] On-chain registration failed:', chainError);
            return res.status(500).json({ error: `On-chain registration failed: ${chainError.message}` });
        }

        // ==========================================
        // REDIS SAVE
        // ==========================================

        // Save to registry set
        await redisClient.client.sAdd('builders:registry', code);

        // Save metadata
        await redisClient.client.hSet(`builder:${code}:info`, {
            owner_email: owner_email || '',
            description: description || '',
            payout_wallet: payout_wallet,
            created_at: Date.now().toString(),
            status: 'active'
        });

        console.log(`[Admin] Created builder code: ${code}`);

        res.json({
            success: true,
            code,
            message: `Builder code "${code}" created and registered on-chain successfully`
        });
    } catch (error) {
        console.error('Create builder code error:', error);
        res.status(500).json({ error: 'Failed to create builder code' });
    }
};

/**
 * List all builder codes with balances
 * GET /v1/admin/builders
 */
export const listBuilderCodes = async (req: Request, res: Response) => {
    try {
        // Get all registered codes
        const codes = await redisClient.client.sMembers('builders:registry');

        const builders: Array<{
            code: string;
            balance: number;
            owner_email: string;
            description: string;
            payout_wallet: string;
            created_at: number;
            status: string;
        }> = [];

        // Pipeline fetch for each code
        for (const code of codes) {
            const [info, balanceStr] = await Promise.all([
                redisClient.client.hGetAll(`builder:${code}:info`),
                redisClient.client.get(`builder:${code}:balance`)
            ]);

            builders.push({
                code,
                balance: parseFloat(balanceStr || '0'),
                owner_email: info.owner_email || '',
                description: info.description || '',
                payout_wallet: info.payout_wallet || 'pending',
                created_at: parseInt(info.created_at || '0'),
                status: info.status || 'unknown'
            });
        }

        // Sort by balance descending
        builders.sort((a, b) => b.balance - a.balance);

        res.json({
            count: builders.length,
            builders
        });
    } catch (error) {
        console.error('List builder codes error:', error);
        res.status(500).json({ error: 'Failed to list builder codes' });
    }
};

/**
 * Claim/Sweep Protocol Fees from Fee Vault
 * POST /v1/admin/fees/sweep
 */
export const sweepProtocolFees = async (req: Request, res: Response) => {
    try {
        const PAYMENT_ROUTER_PROGRAM_ID = new PublicKey(process.env.PAYMENT_ROUTER_PROGRAM_ID || 'EZPqKzvizknKZmkYC69NgiBeCs1uDVfET1MQpC7tQvin');
        const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
        const connection = new Connection(RPC_URL, 'confirmed');

        const secret = process.env.ROUTER_ADMIN_KEYPAIR;
        if (!secret) throw new Error("Missing ROUTER_ADMIN_KEYPAIR env");
        const secretKey = Uint8Array.from(JSON.parse(secret));
        const adminKeypair = Keypair.fromSecretKey(secretKey);

        // Fee Payer (Platform Wallet)
        const feePayerSecret = process.env.FEE_PAYER_KEYPAIR || process.env.ROUTER_ADMIN_KEYPAIR;
        const feePayerKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(feePayerSecret!)));

        // Derive Fee Vault State
        const [feeVaultStatePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("fee_vault_state")],
            PAYMENT_ROUTER_PROGRAM_ID
        );

        // Derive Fee Vault ATA
        const [feeVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("fee_vault"), feeVaultStatePDA.toBuffer()],
            PAYMENT_ROUTER_PROGRAM_ID
        );

        // Admin Wallet ATA (Where USDC goes)
        // Use PROTOCOL_FEE_DESTINATION if set, otherwise fallback to admin signer
        const destinationWallet = process.env.PROTOCOL_FEE_DESTINATION
            ? new PublicKey(process.env.PROTOCOL_FEE_DESTINATION)
            : adminKeypair.publicKey;

        const adminATA = await getAssociatedTokenAddress(
            new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"), // Devnet USDC Mint
            destinationWallet
        );
        // Note: USDC_MINT const is not imported here, but I can copy it or move it to a shared file. 
        // For now, I'll use the env check or hardcode devnet since RPC_URL default is devnet.
        // Better:
        const USDC_MINT = RPC_URL.includes('devnet')
            ? new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")
            : new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

        const adminATAResolved = await getAssociatedTokenAddress(USDC_MINT, destinationWallet);

        const tx = new Transaction();

        // Check if ATA exists; if not, create it
        const ataInfo = await connection.getAccountInfo(adminATAResolved);
        if (!ataInfo) {
            console.log(`[Admin] Initializing Admin ATA for ${destinationWallet.toBase58()}...`);
            tx.add(
                createAssociatedTokenAccountIdempotentInstruction(
                    feePayerKeypair.publicKey, // Payer
                    adminATAResolved,          // ATA
                    destinationWallet,         // Owner
                    USDC_MINT,                 // Mint
                    TOKEN_PROGRAM_ID,
                    ASSOCIATED_TOKEN_PROGRAM_ID
                )
            );
        }

        // Discriminator: claim_protocol_fees
        // sha256("global:claim_protocol_fees").slice(0, 8)
        const crypto = require('crypto');
        const discriminator = crypto.createHash('sha256').update('global:claim_protocol_fees').digest().subarray(0, 8);

        const keys = [
            { pubkey: adminKeypair.publicKey, isSigner: true, isWritable: true },
            { pubkey: feeVaultStatePDA, isSigner: false, isWritable: true },
            { pubkey: feeVaultPDA, isSigner: false, isWritable: true },
            { pubkey: adminATAResolved, isSigner: false, isWritable: true }, // admin_wallet
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ];

        const ix = new TransactionInstruction({
            programId: PAYMENT_ROUTER_PROGRAM_ID,
            keys,
            data: discriminator
        });

        tx.add(ix);
        tx.feePayer = feePayerKeypair.publicKey;
        const { blockhash } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        tx.sign(feePayerKeypair, adminKeypair); // Both sign if different, or admin signs as authority

        const sig = await connection.sendRawTransaction(tx.serialize());
        await connection.confirmTransaction(sig, 'confirmed');

        console.log(`[Admin] Protocol fees swept: ${sig}`);

        res.json({
            success: true,
            tx_hash: sig,
            message: "Protocol fees swept successfully"
        });

    } catch (error: any) {
        console.error('Sweep fees error:', error);
        res.status(500).json({ error: `Failed to sweep fees: ${error.message}` });
    }
};
