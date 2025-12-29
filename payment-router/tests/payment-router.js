"use strict";
/**
 * Payment Router Test Suite
 *
 * Integration tests for the Attention Marketplace Payment Router.
 * Run with: anchor test (requires local Solana validator)
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const anchor = __importStar(require("@coral-xyz/anchor"));
const anchor_1 = require("@coral-xyz/anchor");
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const chai_1 = require("chai");
// Import client helpers
const index_1 = require("../client/src/index");
/// <reference types="mocha" />
describe("payment_router", () => {
    // Configure the client
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    // Placeholder - in real test, load from target/idl
    const program = anchor.workspace.PaymentRouter;
    // Test accounts
    let admin;
    let agent;
    let user;
    let usdcMint;
    let vault;
    let agentTokenAccount;
    let userTokenAccount;
    let rentSysvar = anchor.web3.SYSVAR_RENT_PUBKEY;
    // Derived PDAs
    let configPDA;
    let feeVaultStatePDA;
    let feeVaultPDA;
    before(async () => {
        // Generate keypairs
        admin = web3_js_1.Keypair.generate();
        agent = web3_js_1.Keypair.generate();
        user = web3_js_1.Keypair.generate();
        // PDAs
        [configPDA] = (0, index_1.findMarketConfigPDA)();
        [feeVaultStatePDA] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("fee_vault_state")], program.programId);
        [feeVaultPDA] = web3_js_1.PublicKey.findProgramAddressSync([Buffer.from("fee_vault"), feeVaultStatePDA.toBuffer()], program.programId);
        // Airdrop SOL
        const airdropAmount = 10 * web3_js_1.LAMPORTS_PER_SOL;
        await provider.connection.confirmTransaction(await provider.connection.requestAirdrop(admin.publicKey, airdropAmount));
        await provider.connection.confirmTransaction(await provider.connection.requestAirdrop(agent.publicKey, airdropAmount));
        await provider.connection.confirmTransaction(await provider.connection.requestAirdrop(user.publicKey, airdropAmount));
        // Create USDC mock mint
        usdcMint = await (0, spl_token_1.createMint)(provider.connection, admin, admin.publicKey, null, 6);
        // Create token accounts
        agentTokenAccount = await (0, spl_token_1.createAccount)(provider.connection, agent, usdcMint, agent.publicKey);
        userTokenAccount = await (0, spl_token_1.createAccount)(provider.connection, user, usdcMint, user.publicKey);
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
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([admin])
                .rpc();
            const config = await program.account.marketConfig.fetch(configPDA);
            (0, chai_1.expect)(config.feeBasisPoints).to.equal(feeBasisPoints);
            // 2. Initialize Fee Vault (NEW)
            await program.methods
                .initializeFeeVault()
                .accounts({
                admin: admin.publicKey,
                feeVaultState: feeVaultStatePDA,
                feeVault: feeVaultPDA,
                mint: usdcMint,
                systemProgram: web3_js_1.SystemProgram.programId,
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
                rent: rentSysvar,
            })
                .signers([admin])
                .rpc();
            const feeState = await program.account.feeVaultState.fetch(feeVaultStatePDA);
            (0, chai_1.expect)(feeState.totalCollected.toNumber()).to.equal(0);
        });
    });
    describe("core flow", () => {
        it("should deposit and settle with fees", async () => {
            const [escrowPDA] = (0, index_1.findEscrowPDA)(agent.publicKey);
            // Create Vault ATA for Escrow PDA
            vault = await (0, spl_token_1.createAccount)(provider.connection, agent, // payer
            usdcMint, escrowPDA // owner
            );
            // Mint to Agent
            await (0, spl_token_1.mintTo)(provider.connection, admin, usdcMint, agentTokenAccount, admin, 1000000000 // 1000 USDC
            );
            // Deposit
            const depositAmount = new anchor_1.BN(100000000); // 100 USDC
            await program.methods
                .depositEscrow(depositAmount)
                .accounts({
                agent: agent.publicKey,
                agentTokenAccount: agentTokenAccount,
                escrowAccount: escrowPDA,
                vault: vault,
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
                systemProgram: web3_js_1.SystemProgram.programId,
                rent: rentSysvar,
            })
                .signers([agent])
                .rpc();
            const escrow = await program.account.escrowAccount.fetch(escrowPDA);
            (0, chai_1.expect)(escrow.balance.toNumber()).to.equal(depositAmount.toNumber());
            // Close Settlement
            const verifiedSeconds = new anchor_1.BN(60);
            const pricePerSecond = new anchor_1.BN(1000000); // 1 USDC
            const nonce = new anchor_1.BN(Date.now());
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
                tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            })
                .signers([admin])
                .rpc();
            // Verify Payouts
            // Total: 60 USDC
            // Fee: 15% of 60 = 9 USDC
            // User: 51 USDC
            const userAccount = await (0, spl_token_1.getAccount)(provider.connection, userTokenAccount);
            (0, chai_1.expect)(Number(userAccount.amount)).to.equal(51000000);
            const feeAccount = await (0, spl_token_1.getAccount)(provider.connection, feeVaultPDA);
            (0, chai_1.expect)(Number(feeAccount.amount)).to.equal(9000000);
        });
    });
});
