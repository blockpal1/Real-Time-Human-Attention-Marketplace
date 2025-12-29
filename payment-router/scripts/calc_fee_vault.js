const { PublicKey } = require('@solana/web3.js');
const fs = require('fs');

const PROGRAM_ID = new PublicKey("FaD881QPFmCu7yoym5BRiwFbaJHN1N5N4KpNhcVVnPmU");

const [feeVaultStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_vault_state")],
    PROGRAM_ID
);

const [feeVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("fee_vault"), feeVaultStatePDA.toBuffer()],
    PROGRAM_ID
);

const output = `feeVaultState: ${feeVaultStatePDA.toBase58()}
feeVault: ${feeVaultPDA.toBase58()}`;

fs.writeFileSync('pdas.txt', output);
console.log("Written to pdas.txt");
