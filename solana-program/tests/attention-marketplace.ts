import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AttentionMarketplace } from "../target/types/attention_marketplace";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount } from "@solana/spl-token";
import { assert } from "chai";

describe("attention-marketplace", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace.AttentionMarketplace as Program<AttentionMarketplace>;

    let mint: PublicKey;
    let agent: Keypair;
    let agentTokenAccount: PublicKey;
    let user: Keypair;
    let userTokenAccount: PublicKey;
    let admin: Keypair;
    let feeTreasury: Keypair;
    let feeTreasuryTokenAccount: PublicKey;
    let marketConfig: PublicKey;
    let escrowState: PublicKey;
    let escrowVault: PublicKey;
    let bump: number;
    let configBump: number;

    const taskId = "task_123";

    before(async () => {
        agent = Keypair.generate();
        user = Keypair.generate();
        admin = Keypair.generate();
        feeTreasury = Keypair.generate();

        // Airdrop SOL
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(agent.publicKey, 2 * LAMPORTS_PER_SOL),
            "confirmed"
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(admin.publicKey, 2 * LAMPORTS_PER_SOL),
            "confirmed"
        );

        // Create Mint (USDC Mock)
        mint = await createMint(
            provider.connection,
            agent, // payer
            admin.publicKey,
            null,
            6
        );

        // Create Token Accounts
        agentTokenAccount = await createAccount(provider.connection, agent, mint, agent.publicKey);
        userTokenAccount = await createAccount(provider.connection, agent, mint, user.publicKey);
        feeTreasuryTokenAccount = await createAccount(provider.connection, agent, mint, feeTreasury.publicKey);

        // Mint some tokens to agent
        await mintTo(
            provider.connection,
            agent,
            mint,
            agentTokenAccount,
            admin,
            1000 * 1000000 // 1000 USDC
        );
    });

    it("Is initialized!", async () => {
        [marketConfig, configBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("config")],
            program.programId
        );

        const feeBps = 500; // 5%

        await program.methods
            .initializeConfig(feeBps)
            .accounts({
                admin: admin.publicKey,
                config: marketConfig,
                systemProgram: SystemProgram.programId,
            })
            .signers([admin])
            .rpc();

        const configAccount = await program.account.marketConfig.fetch(marketConfig);
        assert.ok(configAccount.authority.equals(admin.publicKey));
        assert.equal(configAccount.feeBasisPoints, feeBps);
    });

    it("Create Task and Escrow", async () => {
        [escrowState, bump] = PublicKey.findProgramAddressSync(
            [Buffer.from("escrow"), agent.publicKey.toBuffer(), Buffer.from(taskId)],
            program.programId
        );

        [escrowVault] = PublicKey.findProgramAddressSync(
            [Buffer.from("vault"), escrowState.toBuffer()],
            program.programId
        );

        await program.methods
            .createTask(taskId)
            .accounts({
                agent: agent.publicKey,
                escrowState: escrowState,
                escrowVault: escrowVault,
                mint: mint,
                tokenProgram: TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            })
            .signers([agent])
            .rpc();

        const escrowAccount = await program.account.escrowState.fetch(escrowState);
        assert.equal(escrowAccount.taskId, taskId);
        assert.ok(escrowAccount.agent.equals(agent.publicKey));
    });

    it("Fund Escrow", async () => {
        const amount = new anchor.BN(100 * 1000000); // 100 USDC

        await program.methods
            .fundEscrow(amount)
            .accounts({
                agent: agent.publicKey,
                escrowState: escrowState,
                agentTokenAccount: agentTokenAccount,
                escrowVault: escrowVault,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([agent])
            .rpc();

        const escrowVaultAccount = await getAccount(provider.connection, escrowVault);
        assert.equal(escrowVaultAccount.amount.toString(), amount.toString());

        const escrowAccount = await program.account.escrowState.fetch(escrowState);
        assert.equal(escrowAccount.balance.toString(), amount.toString());
    });

    it("Stream Pay Human", async () => {
        const verifiedSeconds = new anchor.BN(60);
        const pricePerSecond = new anchor.BN(100000); // 0.1 USDC
        // Total = 6 USDC
        // Fee 5% = 0.3 USDC
        // User = 5.7 USDC

        await program.methods
            .streamPayHuman(verifiedSeconds, pricePerSecond)
            .accounts({
                router: admin.publicKey, // Admin is set as authority
                config: marketConfig,
                escrowState: escrowState,
                escrowVault: escrowVault,
                userTokenAccount: userTokenAccount,
                feeTreasury: feeTreasuryTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
                authority: admin.publicKey,
            })
            .signers([admin])
            .rpc();

        const userAccount = await getAccount(provider.connection, userTokenAccount);
        assert.equal(userAccount.amount.toString(), "5700000"); // 5.7 USDC

        const feeAccount = await getAccount(provider.connection, feeTreasuryTokenAccount);
        assert.equal(feeAccount.amount.toString(), "300000"); // 0.3 USDC
    });

    it("Refund Remainder", async () => {
        // Initial 100, spent 6. Remaining 94.

        await program.methods
            .refundRemainder()
            .accounts({
                agent: agent.publicKey,
                escrowState: escrowState,
                escrowVault: escrowVault,
                agentTokenAccount: agentTokenAccount,
                tokenProgram: TOKEN_PROGRAM_ID,
            })
            .signers([agent])
            .rpc();

        const escrowAccount = await program.account.escrowState.fetch(escrowState);
        assert.equal(escrowAccount.balance.toString(), "0");

        const escrowVaultAccount = await getAccount(provider.connection, escrowVault);
        assert.equal(escrowVaultAccount.amount.toString(), "0");
    });
});
