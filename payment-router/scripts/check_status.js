const { Connection, PublicKey } = require('@solana/web3.js');

const PROGRAM_ID = new PublicKey("FaD881QPFmCu7yoym5BRiwFbaJHN1N5N4KpNhcVVnPmU");
const SEED = Buffer.from("market_config");

async function main() {
    console.log("Connecting to Devnet...");
    const connection = new Connection("https://api.devnet.solana.com");

    const [pda, bump] = PublicKey.findProgramAddressSync([SEED], PROGRAM_ID);
    console.log("Calculated PDA:", pda.toBase58());

    console.log("Fetching account info...");
    const info = await connection.getAccountInfo(pda);

    if (!info) {
        console.log("Result: ACCOUNT_NOT_FOUND");
        console.log("Conclusion: You verified correct! You probably missed the 'initializeMarketConfig' step.");
    } else {
        console.log("Result: ACCOUNT_EXISTS");
        const fees = info.data.readUInt16LE(40); // Offset 40
        console.log("Current Fees:", fees);
    }
}

main().catch(err => console.error(err));
