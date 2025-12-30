
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PaymentRouter } from "../target/types/payment_router";
import { PublicKey, Keypair, Connection, clusterApiUrl } from "@solana/web3.js";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load env from frontend (.env.local or .env)
const frontendEnvPath = path.resolve(__dirname, "../../frontend/.env");
dotenv.config({ path: frontendEnvPath });

async function main() {
    // 1. Setup Connection & Wallet
    const connection = new Connection(process.env.VITE_SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");

    // Load Admin Keypair from env or file
    let adminKeypair: Keypair;
    if (process.env.ROUTER_ADMIN_KEYPAIR) {
        adminKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.ROUTER_ADMIN_KEYPAIR)));
    } else {
        throw new Error("ROUTER_ADMIN_KEYPAIR not found in env");
    }

    const wallet = new anchor.Wallet(adminKeypair);
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    // 2. Program ID
    const PROGRAM_ID = new PublicKey("EZPqKzvizknKZmkYC69NgiBeCs1uDVfET1MQpC7tQvin");
    const program = new Program<PaymentRouter>(require("../target/idl/payment_router.json"), PROGRAM_ID, provider);

    console.log("Initializing Market with Program ID:", PROGRAM_ID.toBase58());
    console.log("Admin Wallet:", adminKeypair.publicKey.toBase58());

    // 3. PDAs
    const [marketConfigPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("market_config")],
        PROGRAM_ID
    );
    const [feeVaultStatePDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_vault_state")],
        PROGRAM_ID
    );
    const [feeVaultPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from("fee_vault"), feeVaultStatePDA.toBuffer()],
        PROGRAM_ID
    );

    // 4. Initialize Market Config
    try {
        const tx = await program.methods.initializeMarketConfig(1500) // 15%
            .accounts({
                admin: adminKeypair.publicKey,
                config: marketConfigPDA,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .rpc();
        console.log("Market Config Initialized! Tx:", tx);
    } catch (e: any) {
        if (e.message.includes("already in use")) {
            console.log("Market Config already initialized.");
        } else {
            console.error("Error initializing Market Config:", e);
        }
    }

    // 5. Initialize Fee Vault
    const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"); // Devnet USDC
    try {
        const tx2 = await program.methods.initializeFeeVault()
            .accounts({
                admin: adminKeypair.publicKey,
                feeVaultState: feeVaultStatePDA,
                feeVault: feeVaultPDA,
                mint: USDC_MINT,
                systemProgram: anchor.web3.SystemProgram.programId,
                tokenProgram: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                rent: anchor.web3.SYSVAR_RENT_PUBKEY,
            })
            .rpc();
        console.log("Fee Vault Initialized! Tx:", tx2);
    } catch (e: any) {
        if (e.message.includes("already in use")) {
            console.log("Fee Vault already initialized.");
        } else {
            console.error("Error initializing Fee Vault:", e);
        }
    }
}

main().then(() => console.log("Done")).catch(console.error);
