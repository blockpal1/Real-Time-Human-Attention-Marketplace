/**
 * Payment Router Test Suite
 *
 * Integration tests for the Attention Marketplace Payment Router.
 * Run with: anchor test (requires local Solana validator)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
    TOKEN_PROGRAM_ID,
    createMint,
    createAccount,
    mintTo,
    getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

// Import client helpers
import {
    findMarketConfigPDA,
    findEscrowPDA,
    PAYMENT_ROUTER_PROGRAM_ID,
} from "../client/src/index";

/// <reference types="mocha" />

describe("payment_router", () => {
    // Configure the client
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // Placeholder - in real test, load from target/idl
    const program = anchor.workspace.PaymentRouter as any;

    // Test accounts
    let admin: Keypair;
    let agent: Keypair;
    let user: Keypair;
    let usdcMint: PublicKey;
    let vault: PublicKey;
    let agentTokenAccount: PublicKey;
    let userTokenAccount: PublicKey;
    let rentSysvar: PublicKey = anchor.web3.SYSVAR_RENT_PUBKEY;

    // Derived PDAs
    let configPDA: PublicKey;
    let feeVaultStatePDA: PublicKey;
    let feeVaultPDA: PublicKey;

    before(async () => {
        // Generate keypairs
        admin = Keypair.generate();
        agent = Keypair.generate();
        user = Keypair.generate();

        // PDAs
        [configPDA] = findMarketConfigPDA();
        [feeVaultStatePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("fee_vault_state")],
            program.programId
        );
        [feeVaultPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("fee_vault"), feeVaultStatePDA.toBuffer()],
            program.programId
        );

        // Airdrop SOL
        const airdropAmount = 10 * LAMPORTS_PER_SOL;
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(admin.publicKey, airdropAmount)
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(agent.publicKey, airdropAmount)
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(user.publicKey, airdropAmount)
        );

        // Create USDC mock mint
        usdcMint = await createMint(
            provider.connection,
            admin,
            admin.publicKey,
            null,
            6
        );

        // Create token accounts
        agentTokenAccount = await createAccount(
            provider.connection,
            agent,
            usdcMint,
            agent.publicKey
        );

        userTokenAccount = await createAccount(
            provider.connection,
            user,
            usdcMint,
            user.publicKey
        );

        // Vault for escrow (owned by Agent's escrow PDA, initialized during deposit)
        // Wait, the client usually creates the vault AT/Account. 
        // In the test we'll let the program manipulate it, but we need to know what it is.
        // Actually deposit_escrow expects a vault account.
        // Standard pattern: The vault is an ATA or specific account owned by the Escrow PDA.
        // Let's assume for this test we create a vault account owned by someone initially?
        // Checking Lib.rs: constraint = vault.owner == escrow_account.key()
        // So we need to create it properly.

        // Actually, let's create a temporary vault account for the test, 
        // but it must be owned by the Escrow PDA eventually.
        // The deposit_escrow instruction doesn't INIT the vault, it just checks owner.
        // So we need to make sure the vault is created and ownership assigned or it's an ATA.
        // Let's use an ATA for the Escrow PDA as the vault.
    });

    describe("initialization", () => {
        it("should initialize market config and fee vault", async () => {
            const feeBasisPoints = 1500; // 15%

            // 1. Initialize Config
            await program.methods
                .initializeMarketConfig(feeBasisPoints)
                .accounts({
                    admin: admin.publicKey,
                    config: configPDA,
                    systemProgram: SystemProgram.programId,
                })
                .signers([admin])
                .rpc();

            const config = await program.account.marketConfig.fetch(configPDA);
            expect(config.feeBasisPoints).to.equal(feeBasisPoints);

            // 2. Initialize Fee Vault (NEW)
            await program.methods
                .initializeFeeVault()
                .accounts({
                    admin: admin.publicKey,
                    feeVaultState: feeVaultStatePDA,
                    feeVault: feeVaultPDA,
                    mint: usdcMint,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    rent: rentSysvar,
                })
                .signers([admin])
                .rpc();

            const feeState = await program.account.feeVaultState.fetch(feeVaultStatePDA);
            expect(feeState.totalCollected.toNumber()).to.equal(0);
        });
    });

    describe("core flow", () => {
        it("should deposit and settle with fees", async () => {
            const [escrowPDA] = findEscrowPDA(agent.publicKey);

            // Create Vault ATA for Escrow PDA
            vault = await createAccount(
                provider.connection,
                agent, // payer
                usdcMint,
                escrowPDA // owner
            );

            // Mint to Agent
            await mintTo(
                provider.connection,
                admin,
                usdcMint,
                agentTokenAccount,
                admin,
                1_000_000_000 // 1000 USDC
            );

            // Deposit
            const depositAmount = new BN(100_000_000); // 100 USDC
            await program.methods
                .depositEscrow(depositAmount)
                .accounts({
                    agent: agent.publicKey,
                    agentTokenAccount: agentTokenAccount,
                    escrowAccount: escrowPDA,
                    vault: vault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: rentSysvar,
                })
                .signers([agent])
                .rpc();

            const escrow = await program.account.escrowAccount.fetch(escrowPDA);
            expect(escrow.balance.toNumber()).to.equal(depositAmount.toNumber());

            // Close Settlement
            const verifiedSeconds = new BN(60);
            const pricePerSecond = new BN(1_000_000); // 1 USDC
            const nonce = new BN(Date.now());

            await program.methods
                .closeSettlement(verifiedSeconds, pricePerSecond, nonce, null) // No builder
                .accounts({
                    router: admin.publicKey,
                    escrowAccount: escrowPDA,
                    vault: vault,
                    userWallet: userTokenAccount,
                    feeVaultState: feeVaultStatePDA,
                    feeVault: feeVaultPDA,
                    builderBalance: null, // Optional
                    marketConfig: configPDA,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([admin])
                .rpc();

            // Verify Payouts
            // Total: 60 USDC
            // Fee: 15% of 60 = 9 USDC
            // User: 51 USDC

            const userAccount = await getAccount(provider.connection, userTokenAccount);
            expect(Number(userAccount.amount)).to.equal(51_000_000);

            const feeAccount = await getAccount(provider.connection, feeVaultPDA);
            expect(Number(feeAccount.amount)).to.equal(9_000_000);
        });
    });
});
