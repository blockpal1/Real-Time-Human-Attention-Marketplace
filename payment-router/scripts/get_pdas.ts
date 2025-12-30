
import { PublicKey } from "@solana/web3.js";
import * as fs from "fs";

const PROGRAM_ID = new PublicKey("EZPqKzvizknKZmkYC69NgiBeCs1uDVfET1MQpC7tQvin");

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

const output = {
    MARKET_CONFIG: marketConfigPDA.toBase58(),
    FEE_VAULT_STATE: feeVaultStatePDA.toBase58(),
    FEE_VAULT: feeVaultPDA.toBase58()
};

fs.writeFileSync("payment-router/scripts/pdas.json", JSON.stringify(output, null, 2));
console.log("Written to pdas.json");
