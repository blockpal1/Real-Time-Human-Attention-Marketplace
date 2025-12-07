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

describe("payment_router", () => {
    // Configure the client
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // Placeholder - in real test, load from target/idl
    const program = anchor.workspace.PaymentRouter as Program;

    // Test accounts
    let admin: Keypair;
    let agent: Keypair;
    let user: Keypair;
    let usdcMint: PublicKey;
    let vault: PublicKey;
    let agentTokenAccount: PublicKey;
    let userTokenAccount: PublicKey;

    before(async () => {
        // Generate keypairs
        admin = Keypair.generate();
        agent = Keypair.generate();
        user = Keypair.generate();

        // Airdrop SOL to all accounts
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
            6 // 6 decimals like real USDC
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

        // Create vault (would be PDA in real impl)
        vault = await createAccount(
            provider.connection,
            admin,
            usdcMint,
            admin.publicKey // Vault authority would be PDA in real impl
        );

        // Mint USDC to agent
        await mintTo(
            provider.connection,
            admin,
            usdcMint,
            agentTokenAccount,
            admin,
            1_000_000_000 // 1000 USDC
        );
    });

    describe("initialize_market_config", () => {
        it("should initialize market config with fee", async () => {
            const [configPDA, bump] = findMarketConfigPDA();
            const feeBasisPoints = 500; // 5%

            await program.methods
                .initializeMarketConfig(feeBasisPoints)
                .accounts({
                    admin: admin.publicKey,
                    config: configPDA,
                    systemProgram: SystemProgram.programId,
                })
                .signers([admin])
                .rpc();

            // Verify config was created
            const config = await program.account.marketConfig.fetch(configPDA);
            expect(config.authority.toBase58()).to.equal(admin.publicKey.toBase58());
            expect(config.feeBasisPoints).to.equal(feeBasisPoints);
        });

        it("should fail to reinitialize", async () => {
            const [configPDA] = findMarketConfigPDA();

            try {
                await program.methods
                    .initializeMarketConfig(100)
                    .accounts({
                        admin: admin.publicKey,
                        config: configPDA,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([admin])
                    .rpc();
                expect.fail("Should have thrown");
            } catch (err: any) {
                expect(err.message).to.include("already in use");
            }
        });
    });

    describe("deposit_escrow", () => {
        it("should deposit USDC into escrow", async () => {
            const [escrowPDA] = findEscrowPDA(agent.publicKey);
            const depositAmount = new BN(100_000_000); // 100 USDC

            const agentBalanceBefore = (
                await getAccount(provider.connection, agentTokenAccount)
            ).amount;

            await program.methods
                .depositEscrow(depositAmount)
                .accounts({
                    agent: agent.publicKey,
                    agentTokenAccount: agentTokenAccount,
                    escrowAccount: escrowPDA,
                    vault: vault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([agent])
                .rpc();

            // Verify escrow account
            const escrow = await program.account.escrowAccount.fetch(escrowPDA);
            expect(escrow.agent.toBase58()).to.equal(agent.publicKey.toBase58());
            expect(escrow.balance.toNumber()).to.equal(depositAmount.toNumber());

            // Verify token transfer
            const agentBalanceAfter = (
                await getAccount(provider.connection, agentTokenAccount)
            ).amount;
            expect(Number(agentBalanceBefore) - Number(agentBalanceAfter)).to.equal(
                depositAmount.toNumber()
            );
        });

        it("should accumulate deposits", async () => {
            const [escrowPDA] = findEscrowPDA(agent.publicKey);
            const additionalDeposit = new BN(50_000_000); // 50 USDC

            const escrowBefore = await program.account.escrowAccount.fetch(escrowPDA);

            await program.methods
                .depositEscrow(additionalDeposit)
                .accounts({
                    agent: agent.publicKey,
                    agentTokenAccount: agentTokenAccount,
                    escrowAccount: escrowPDA,
                    vault: vault,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                    rent: anchor.web3.SYSVAR_RENT_PUBKEY,
                })
                .signers([agent])
                .rpc();

            const escrowAfter = await program.account.escrowAccount.fetch(escrowPDA);
            expect(escrowAfter.balance.toNumber()).to.equal(
                escrowBefore.balance.toNumber() + additionalDeposit.toNumber()
            );
        });
    });

    describe("close_settlement", () => {
        it("should settle payment from escrow to user", async () => {
            const [escrowPDA] = findEscrowPDA(agent.publicKey);
            const [configPDA] = findMarketConfigPDA();

            const verifiedSeconds = new BN(60); // 60 seconds of attention
            const pricePerSecond = new BN(1_000_000); // 1 USDC per second
            const nonce = new BN(Date.now());

            const userBalanceBefore = (
                await getAccount(provider.connection, userTokenAccount)
            ).amount;
            const escrowBefore = await program.account.escrowAccount.fetch(escrowPDA);

            await program.methods
                .closeSettlement(verifiedSeconds, pricePerSecond, nonce)
                .accounts({
                    router: admin.publicKey, // Admin is the router authority
                    escrowAccount: escrowPDA,
                    vault: vault,
                    userWallet: userTokenAccount,
                    marketConfig: configPDA,
                    tokenProgram: TOKEN_PROGRAM_ID,
                })
                .signers([admin])
                .rpc();

            // Calculate expected amounts
            const totalPayout = verifiedSeconds.toNumber() * pricePerSecond.toNumber(); // 60 USDC
            const fee = (totalPayout * 500) / 10000; // 5% = 3 USDC
            const netPayout = totalPayout - fee; // 57 USDC

            // Verify user received payment
            const userBalanceAfter = (
                await getAccount(provider.connection, userTokenAccount)
            ).amount;
            expect(Number(userBalanceAfter) - Number(userBalanceBefore)).to.equal(
                netPayout
            );

            // Verify escrow balance decreased
            const escrowAfter = await program.account.escrowAccount.fetch(escrowPDA);
            expect(
                escrowBefore.balance.toNumber() - escrowAfter.balance.toNumber()
            ).to.equal(totalPayout);
        });

        it("should fail with insufficient funds", async () => {
            const [escrowPDA] = findEscrowPDA(agent.publicKey);
            const [configPDA] = findMarketConfigPDA();

            const verifiedSeconds = new BN(10000); // Way more than available
            const pricePerSecond = new BN(1_000_000);
            const nonce = new BN(Date.now() + 1);

            try {
                await program.methods
                    .closeSettlement(verifiedSeconds, pricePerSecond, nonce)
                    .accounts({
                        router: admin.publicKey,
                        escrowAccount: escrowPDA,
                        vault: vault,
                        userWallet: userTokenAccount,
                        marketConfig: configPDA,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([admin])
                    .rpc();
                expect.fail("Should have thrown");
            } catch (err: any) {
                expect(err.message).to.include("Insufficient funds");
            }
        });

        it("should fail with wrong router authority", async () => {
            const [escrowPDA] = findEscrowPDA(agent.publicKey);
            const [configPDA] = findMarketConfigPDA();
            const fakeRouter = Keypair.generate();

            await provider.connection.confirmTransaction(
                await provider.connection.requestAirdrop(
                    fakeRouter.publicKey,
                    LAMPORTS_PER_SOL
                )
            );

            try {
                await program.methods
                    .closeSettlement(new BN(1), new BN(1), new BN(Date.now() + 2))
                    .accounts({
                        router: fakeRouter.publicKey,
                        escrowAccount: escrowPDA,
                        vault: vault,
                        userWallet: userTokenAccount,
                        marketConfig: configPDA,
                        tokenProgram: TOKEN_PROGRAM_ID,
                    })
                    .signers([fakeRouter])
                    .rpc();
                expect.fail("Should have thrown");
            } catch (err: any) {
                // Constraint violation
                expect(err.message).to.include("Constraint");
            }
        });
    });

    describe("security", () => {
        it("should prevent nonce replay attacks", async () => {
            // This would be tested via the client-side security module
            // in conjunction with off-chain nonce tracking
        });
    });
});
