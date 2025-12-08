import { Program, AnchorProvider, Idl, BN, web3, utils } from '@coral-xyz/anchor';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

// Explicitly polyfill Buffer for browser environment if needed
if (typeof window !== 'undefined') {
    window.Buffer = Buffer;
}

// TODO: Import the actual IDL JSON
import idl from '../../../../specs/idl.json';

const PROGRAM_ID = new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); // Devnet/Localnet ID

export interface MarketConfig {
    authority: PublicKey;
    feeBasisPoints: number;
}

export interface EscrowAccount {
    agent: PublicKey;
    balance: BN;
    bump: number;
}

export class AnchorClient {
    connection: Connection;
    provider: AnchorProvider | null = null;
    program: Program | null = null;

    constructor(endpoint: string = 'http://127.0.0.1:8899') {
        this.connection = new Connection(endpoint, 'confirmed');
    }

    /**
     * Initialize with a Wallet (e.g. from Privy or Phantom)
     */
    async connect(wallet: any) {
        if (!wallet) return;

        this.provider = new AnchorProvider(
            this.connection,
            wallet,
            AnchorProvider.defaultOptions()
        );

        // @ts-ignore - IDL typing is loose here without generated types
        this.program = new Program(idl as Idl, PROGRAM_ID, this.provider);
        console.log("Anchor Program Initialized:", this.program.programId.toString());
    }

    // --- PDAs ---

    async getMarketConfigPDA() {
        const [pda] = await PublicKey.findProgramAddressSync(
            [utils.bytes.utf8.encode("market_config")],
            PROGRAM_ID
        );
        return pda;
    }

    async getEscrowPDA(agent: PublicKey) {
        const [pda] = await PublicKey.findProgramAddressSync(
            [utils.bytes.utf8.encode("escrow"), agent.toBuffer()],
            PROGRAM_ID
        );
        return pda;
    }

    // --- Reads ---

    async fetchMarketConfig(): Promise<any> {
        if (!this.program) throw new Error("Program not initialized");
        const pda = await this.getMarketConfigPDA();
        return await this.program.account.marketConfig.fetch(pda);
    }

    async fetchEscrowAccount(agent: PublicKey): Promise<any> {
        if (!this.program) throw new Error("Program not initialized");
        const pda = await this.getEscrowPDA(agent);
        try {
            return await this.program.account.escrowAccount.fetch(pda);
        } catch (e) {
            console.warn("Escrow account not found for agent", agent.toString());
            return null;
        }
    }

    // --- Writes ---

    /**
     * Agent deposits USDC to fund their campaigns
     */
    async depositEscrow(amountUSDC: number, usdcMint: PublicKey) {
        if (!this.program || !this.provider) throw new Error("Wallet not connected");

        const agent = this.provider.publicKey;
        // 1. Get/Create Agent's Associated Token Account
        const agentTokenAccount = await utils.token.associatedAddress({
            mint: usdcMint,
            owner: agent
        });

        const escrowPDA = await this.getEscrowPDA(agent);
        const vaultPDA = await utils.token.associatedAddress({
            mint: usdcMint,
            owner: escrowPDA // Vault is owned by the Escrow PDA? Or Program? 
            // Wait, lib.rs says: to: ctx.accounts.vault.to_account_info().
            // Usually vault is an ATA owned by the PDA.
            // Let's assume standard PDA-owned ATA pattern.
        });

        // Amount in atomic units (6 decimals for USDC)
        const amount = new BN(amountUSDC * 1_000_000);

        try {
            const tx = await this.program.methods
                .depositEscrow(amount)
                .accounts({
                    agent: agent,
                    agentTokenAccount: agentTokenAccount,
                    escrowAccount: escrowPDA,
                    vault: vaultPDA,
                    // Auto-resolved: mint, tokenProgram, systemProgram, rent
                })
                .rpc();

            console.log("Deposit Success tx:", tx);
            return tx;
        } catch (err) {
            console.error("Deposit Failed:", err);
            throw err;
        }
    }

    /**
     * Agent withdraws unused funds
     */
    async withdrawEscrow(amountUSDC: number, usdcMint: PublicKey) {
        if (!this.program || !this.provider) throw new Error("Wallet not connected");

        const agent = this.provider.publicKey;
        // 1. Get/Create Agent's Associated Token Account (Destination)
        const agentTokenAccount = await utils.token.associatedAddress({
            mint: usdcMint,
            owner: agent
        });

        const escrowPDA = await this.getEscrowPDA(agent);
        const vaultPDA = await utils.token.associatedAddress({
            mint: usdcMint,
            owner: escrowPDA
        });

        // Amount in atomic units (6 decimals)
        const amount = new BN(amountUSDC * 1_000_000);

        try {
            const tx = await this.program.methods
                .withdrawEscrow(amount)
                .accounts({
                    agent: agent,
                    agentTokenAccount: agentTokenAccount,
                    escrowAccount: escrowPDA,
                    vault: vaultPDA,
                    // Auto-resolved: tokenProgram
                })
                .rpc();

            console.log("Withdraw Success tx:", tx);
            return tx;
        } catch (err) {
            console.error("Withdraw Failed:", err);
            throw err;
        }
    }
}

export const anchorClient = new AnchorClient();
